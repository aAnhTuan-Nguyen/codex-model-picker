import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ChangePreview, ConfigSnapshot, HistoryEntry, ManagedValues, SaveResult, Selection, ValueEdit } from '../../shared/contracts'
import { managedFields } from '../../shared/values'
import { buildPatch, ConfigError, parseSnapshot, revisionOf } from './toml'
import { durableWrite, publicEntry, readRecord, type HistoryRecord } from './history'
const isMissing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT'
const samePath = (a: string, b: string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
export class ConfigStore {
  private selectedFile: string
  private bound = false
  private busy = false
  get file(): string { return this.selectedFile }
  constructor(file: string, private historyDir: string, private io: { rename: typeof fs.rename; realpath?: (value: string) => Promise<string> } = { rename: fs.rename }) { this.selectedFile = path.resolve(file) }
  private async safePath(): Promise<void> {
    const { root } = path.parse(this.file)
    let cursor = root, nearest = root
    for (const part of this.file.slice(root.length).split(path.sep)) {
      cursor = path.join(cursor, part)
      try {
        const stat = await fs.lstat(cursor)
        if (stat.isSymbolicLink() || (!stat.isDirectory() && cursor !== this.file) || (cursor === this.file && !stat.isFile())) throw new ConfigError('UNSAFE_PATH', 'Hãy chọn tệp gốc; không ghi qua liên kết hoặc thư mục.')
        nearest = cursor
      } catch (e) { if (isMissing(e)) break; throw e }
    }
    const real = await (this.io.realpath ?? fs.realpath)(nearest)
    if (!samePath(nearest, real)) {
      const [selected, canonical] = await Promise.all([fs.stat(nearest), fs.stat(real)])
      if (selected.dev !== canonical.dev || selected.ino !== canonical.ino) throw new ConfigError('UNSAFE_PATH', 'Đường dẫn không trỏ tới cùng tệp gốc.')
    }
    const canonicalFile = path.join(real, path.relative(nearest, this.file))
    // Windows 8.3 names are normal directory entries, not symlinks. Bind the
    // native canonical name once (including a missing file's existing parent).
    if (!this.bound) { this.selectedFile = canonicalFile; this.bound = true }
    else if (!samePath(canonicalFile, this.file)) throw new ConfigError('UNSAFE_PATH', 'Đường dẫn tệp đã thay đổi. Hãy chọn lại tệp gốc.')
  }
  private async load(): Promise<{ bytes: Buffer; snapshot: ConfigSnapshot }> {
    await this.safePath()
    try {
      const handle = await fs.open(this.file, 'r')
      try {
        const stat = await handle.stat()
        if (stat.size > 4 * 1024 * 1024) throw new ConfigError('INVALID_CONFIG', 'Tệp quá lớn để chỉnh an toàn (giới hạn 4 MiB).')
        const bytes = await handle.readFile()
        return { bytes, snapshot: parseSnapshot(bytes, this.file) }
      } finally { await handle.close() }
    } catch (e) {
      if (!isMissing(e)) throw e
      return { bytes: Buffer.alloc(0), snapshot: { revision: 'missing', values: {}, warnings: [], exists: false, displayPath: this.file } }
    }
  }
  async read(): Promise<ConfigSnapshot> { return (await this.load()).snapshot }
  async preview(selection: Selection): Promise<ChangePreview> { return buildPatch((await this.load()).bytes, selection).preview }
  private async exclusive<T>(run: () => Promise<T>): Promise<T> {
    if (this.busy) throw new ConfigError('CONFLICT', 'Đang lưu một thay đổi khác. Hãy tải lại khi hoàn tất.')
    this.busy = true
    try { return await run() } finally { this.busy = false }
  }
  async save(input: { expectedRevision: string; selection: Selection }): Promise<SaveResult> {
    return this.exclusive(async () => {
      const current = await this.load()
      this.checkRevision(current.snapshot, input.expectedRevision)
      return this.commit(current, buildPatch(current.bytes, input.selection))
    })
  }
  private checkRevision(snapshot: ConfigSnapshot, expected: string) {
    if (snapshot.revision !== expected) throw new ConfigError('CONFLICT', 'Tệp đã được chỉnh bên ngoài. Tải lại và xem thay đổi trước khi lưu.')
  }
  private async ensureWritable(exists: boolean): Promise<void> {
    if (!exists) return
    if (((await fs.stat(this.file)).mode & 0o222) === 0) throw new ConfigError('IO_ERROR', 'Tệp đang ở chế độ chỉ đọc. Hãy kiểm tra quyền trước khi lưu.')
    await fs.access(this.file, fs.constants.W_OK)
  }
  private async commit(current: { bytes: Buffer; snapshot: ConfigSnapshot }, patch: ReturnType<typeof buildPatch>): Promise<SaveResult> {
    if (!patch.preview.changes.length) throw new ConfigError('INVALID_SELECTION', 'Không có thay đổi để lưu.')
    const id = randomUUID()
    const { before, after } = patch.preview
    const metadata: HistoryRecord = { id, createdAt: new Date().toISOString(), displayPath: this.file, before, after, version: 2, state: 'prepared', beforeRevision: current.snapshot.revision, afterRevision: revisionOf(patch.bytes) }
    const temp = path.join(path.dirname(this.file), `.model-picker-${id}.tmp`)
    await this.ensureWritable(current.snapshot.exists)
    await fs.mkdir(this.historyDir, { recursive: true, mode: 0o700 })
    await fs.chmod(this.historyDir, 0o700)
    await durableWrite(path.join(this.historyDir, `${id}.toml`), current.bytes)
    await durableWrite(path.join(this.historyDir, `${id}.json`), JSON.stringify(metadata))
    await fs.mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 })
    await this.safePath()
    try {
      // Preserve owner permission bits on Unix; Windows inherits directory ACLs.
      let mode = 0o600
      if (current.snapshot.exists) mode = (await fs.stat(this.file)).mode & 0o777
      await durableWrite(temp, patch.bytes)
      await fs.chmod(temp, mode)
      this.checkRevision((await this.load()).snapshot, current.snapshot.revision)
      await this.ensureWritable(current.snapshot.exists)
      await this.io.rename(temp, this.file)
    } finally { await fs.unlink(temp).catch(e => { if (!isMissing(e)) throw e }) }
    const snapshot = await this.read()
    if (snapshot.revision !== metadata.afterRevision) throw new ConfigError('CONFLICT', 'Tệp vừa được ghi nhưng đã thay đổi tiếp. Tải lại để xem trạng thái thực tế.')
    // Prepared record can be recovered by comparing the destination hash if finalization fails.
    const metaTemp = path.join(this.historyDir, `${id}.json.tmp`)
    try {
      await durableWrite(metaTemp, JSON.stringify({ ...metadata, state: 'applied' }))
      await fs.rename(metaTemp, path.join(this.historyDir, `${id}.json`))
    } catch {
      snapshot.warnings.push('Cấu hình đã lưu; lịch sử chưa hoàn tất. Giữ bản sao lưu và tải lại trước thao tác tiếp theo.')
    } finally { await fs.unlink(metaTemp).catch(() => {}) }
    return { snapshot, historyId: id }
  }
  async listHistory(): Promise<HistoryEntry[]> {
    let names: string[]
    try { names = await fs.readdir(this.historyDir) } catch (e) { if (isMissing(e)) return []; throw e }
    const revision = (await this.read()).revision
    const entries: HistoryEntry[] = []
    for (const name of names.filter(n => /^[a-f0-9-]{36}\.json$/.test(n))) {
      try {
        const record = await readRecord(this.historyDir, name.slice(0, -5))
        if (samePath(record.displayPath, this.file) && (record.state === 'applied' || record.afterRevision === revision)) entries.push(publicEntry(record))
      } catch { /* A damaged record is not exposed or used for undo. */ }
    }
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
  }
  async undo(input: { historyId: string; expectedRevision: string }): Promise<SaveResult> {
    return this.exclusive(async () => {
      const current = await this.load()
      this.checkRevision(current.snapshot, input.expectedRevision)
      const record = await readRecord(this.historyDir, input.historyId)
      if (!samePath(record.displayPath, this.file) || (record.state !== 'applied' && record.afterRevision !== current.snapshot.revision)) throw new ConfigError('CONFLICT', 'Bản ghi không áp dụng cho cấu hình đang chọn.')
      const before: ManagedValues = record.before, after: ManagedValues = record.after
      for (const { property } of managedFields) if (before[property] !== after[property] && current.snapshot.values[property] !== after[property]) throw new ConfigError('CONFLICT', 'Mục cần hoàn tác đã được sửa sau lần lưu này. Không ghi đè thay đổi đó.')
      const restore = <T>(previous: T | undefined, saved: T | undefined): ValueEdit<T> => previous === saved ? { kind: 'keep' } : previous === undefined ? { kind: 'unset' } : { kind: 'set', value: previous }
      return this.commit(current, buildPatch(current.bytes, {
        model: before.model !== after.model ? before.model : current.snapshot.values.model,
        effort: restore(before.modelReasoningEffort, after.modelReasoningEffort),
        contextWindow: restore(before.modelContextWindow, after.modelContextWindow),
        subagentModel: restore(before.subagentModel, after.subagentModel),
        subagentEffort: restore(before.subagentReasoningEffort, after.subagentReasoningEffort)
      }))
    })
  }
}
