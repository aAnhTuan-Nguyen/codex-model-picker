import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ChangePreview, ConfigSnapshot, HistoryEntry, SaveResult, Selection } from '../../shared/contracts'
import { buildPatch, ConfigError, parseSnapshot, revisionOf } from './toml'
import { durableWrite, publicEntry, readRecord, type HistoryRecord } from './history'
const isMissing = (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT'
const samePath = (a: string, b: string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
export class ConfigStore {
  readonly file: string
  private busy = false
  constructor(file: string, private historyDir: string, private io: { rename: typeof fs.rename } = { rename: fs.rename }) { this.file = path.resolve(file) }
  private async safePath(): Promise<void> {
    const { root } = path.parse(this.file)
    let cursor = root
    for (const part of this.file.slice(root.length).split(path.sep)) {
      cursor = path.join(cursor, part)
      try {
        const stat = await fs.lstat(cursor)
        if (stat.isSymbolicLink() || (!stat.isDirectory() && cursor !== this.file) || (cursor === this.file && !stat.isFile())) throw new ConfigError('UNSAFE_PATH', 'Hãy chọn tệp gốc; không ghi qua liên kết hoặc thư mục.')
      } catch (e) { if (isMissing(e)) break; throw e }
    }
    try { if (!samePath(await fs.realpath(this.file), this.file)) throw new ConfigError('UNSAFE_PATH', 'Đường dẫn tệp đã thay đổi. Hãy chọn lại tệp gốc.') } catch (e) { if (!isMissing(e)) throw e }
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
  private async commit(current: { bytes: Buffer; snapshot: ConfigSnapshot }, patch: ReturnType<typeof buildPatch>): Promise<SaveResult> {
    if (!patch.preview.changes.length) throw new ConfigError('INVALID_SELECTION', 'Không có thay đổi để lưu.')
    const id = randomUUID()
    const record: HistoryRecord = { id, createdAt: new Date().toISOString(), displayPath: this.file, ...patch.preview,
      version: 1, state: 'prepared', beforeRevision: current.snapshot.revision, afterRevision: revisionOf(patch.bytes) }
    // The preview's changes are not part of the persisted metadata contract.
    const { before, after } = patch.preview
    const metadata: HistoryRecord = { id, createdAt: record.createdAt, displayPath: this.file, before, after, version: 1, state: 'prepared', beforeRevision: record.beforeRevision, afterRevision: record.afterRevision }
    const temp = path.join(path.dirname(this.file), `.model-picker-${id}.tmp`)
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
      if (current.snapshot.values.model !== record.after.model || current.snapshot.values.modelReasoningEffort !== record.after.modelReasoningEffort) throw new ConfigError('CONFLICT', 'Model hoặc mức suy luận đã được sửa sau lần lưu này. Không ghi đè thay đổi đó.')
      return this.commit(current, buildPatch(current.bytes, { model: record.before.model, effort: record.before.modelReasoningEffort === undefined ? { kind: 'unset' } : { kind: 'set', value: record.before.modelReasoningEffort } }))
    })
  }
}
