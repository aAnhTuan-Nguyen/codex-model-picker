import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'smol-toml'
import type { CatalogResult, ModelOption } from '../../shared/contracts'
import { normalizeModels } from './normalize'
const unavailable = (): CatalogResult => ({ status: 'unavailable', models: [], message: 'Chưa lấy được danh mục tương thích. Kiểm tra Codex CLI, đăng nhập và tệp cấu hình; bạn vẫn có thể nhập model ID thủ công.' })
export async function loadCatalog(input: { executable: string; prefixArgs?: string[]; codexHome: string; configPath: string; cwd: string; timeoutMs: number; signal?: AbortSignal }): Promise<CatalogResult> {
  const source = path.resolve(input.configPath), expected = path.resolve(input.codexHome, 'config.toml')
  if (/\.(?:cmd|bat)$/i.test(input.executable) || (process.platform === 'win32' ? source.toLowerCase() !== expected.toLowerCase() : source !== expected)) return unavailable()
  let provider = 'openai'
  try {
    const content = await fs.readFile(input.configPath, 'utf8').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return ''; throw e })
    const config = parse(content.replace(/^\uFEFF/, ''))
    if (config.profile) return unavailable()
    provider = typeof config.model_provider === 'string' ? config.model_provider : 'openai'
  } catch { return unavailable() }
  const child = spawn(input.executable, [...(input.prefixArgs ?? []), 'app-server', '--stdio'], { cwd: input.cwd, env: { ...process.env, CODEX_HOME: input.codexHome }, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], signal: input.signal })
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()))
  let sequence = 0, buffer = '', size = 0, stopped = false
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  const abort = () => {
    stopped = true
    for (const waiter of pending.values()) waiter.reject(new Error('Catalog unavailable'))
    pending.clear()
    child.kill()
  }
  const timeout = setTimeout(abort, input.timeoutMs)
  child.on('error', abort); child.on('exit', abort)
  child.stdin.on('error', abort)
  child.stderr.on('data', (data: Buffer) => { size += data.length; if (size > 5 * 1024 * 1024) abort() })
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    size += Buffer.byteLength(chunk)
    if (size > 5 * 1024 * 1024) return abort()
    buffer += chunk
    let point: number
    while ((point = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, point); buffer = buffer.slice(point + 1)
      if (!line.trim()) continue
      try {
        const message = JSON.parse(line)
        const waiter = pending.get(message.id)
        if (waiter) { pending.delete(message.id); if (message.error) waiter.reject(new Error('RPC rejected')); else waiter.resolve(message.result) }
      } catch { return abort() }
    }
  })
  const request = (method: string, params: unknown): Promise<any> => new Promise((resolve, reject) => {
    if (stopped) return reject(new Error('Stopped'))
    const id = ++sequence
    pending.set(id, { resolve, reject })
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n')
  })
  try {
    await request('initialize', { clientInfo: { name: 'codex-model-picker', title: 'Codex Model Picker', version: '0.1.0' }, capabilities: {} })
    child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
    const effective = await request('config/read', { includeLayers: false })
    if (!effective?.config || typeof effective.config !== 'object') return unavailable()
    if ((effective?.config?.model_provider ?? effective?.config?.modelProvider ?? 'openai') !== provider) return unavailable()
    const models: ModelOption[] = [], cursors = new Set<string>()
    let cursor: string | null = null
    do {
      const response = await request('model/list', { cursor, limit: 100 })
      models.push(...normalizeModels(response))
      if (models.length > 5000) return unavailable()
      cursor = response.nextCursor ?? null
      if (cursor && (typeof cursor !== 'string' || cursors.has(cursor))) return unavailable()
      if (cursor) cursors.add(cursor)
    } while (cursor)
    return { status: 'available', models: models.filter((m, i, all) => all.findIndex(x => x.id === m.id) === i) }
  } catch { return unavailable() }
  finally { clearTimeout(timeout); child.stdin.end(); child.kill(); await closed }
}
