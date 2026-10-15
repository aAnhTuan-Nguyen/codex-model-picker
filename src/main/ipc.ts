import { dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { saveSchema, selectionSchema, undoSchema, type CatalogResult, type Result } from '../shared/contracts'
import { ConfigStore } from './config/store'
import { ConfigError } from './config/toml'
import { loadCatalog } from './catalog/client'
async function findCli(): Promise<string | null> {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    const file = path.join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex')
    try { await fs.access(file, fs.constants.X_OK); return file } catch { /* Next PATH entry. */ }
  }
  return null
}
export function installHandlers(win: BrowserWindow, initialPath: string, dataDir: string) {
  let store = new ConfigStore(initialPath, path.join(dataDir, 'history'))
  let executable: string | null = null
  let catalog: CatalogResult | null = null
  const register = (channel: string, schema: z.ZodType, handler: (payload: any) => Promise<unknown>) => {
    ipcMain.handle(channel, async (event, payload): Promise<Result<unknown>> => {
      try {
        if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Invalid sender')
        const parsed = schema.safeParse(payload)
        if (!parsed.success) return { ok: false, error: { code: 'INVALID_SELECTION', message: 'Yêu cầu không hợp lệ.' } }
        return { ok: true, data: await handler(parsed.data) }
      } catch (e) {
        return { ok: false, error: e instanceof ConfigError ? { code: e.code, message: e.message } : { code: 'IO_ERROR', message: 'Không hoàn tất được thao tác. Kiểm tra quyền truy cập, tệp đang bị khóa hoặc chọn tệp khác rồi tải lại.' } }
      }
    })
  }
  const none = z.undefined()
  register('picker:read', none, () => store.read())
  register('picker:preview', selectionSchema, s => store.preview(s))
  register('picker:save', saveSchema, async input => {
    if (input.selection.effort.kind === 'set') {
      const model = catalog?.models.find(m => m.id === input.selection.model)
      if (!model?.efforts?.includes(input.selection.effort.value)) throw new ConfigError('INVALID_SELECTION', 'Chưa xác minh mức suy luận này cho model. Tải lại danh mục hoặc dùng mặc định Codex.')
    }
    return store.save(input)
  })
  register('picker:history', none, () => store.listHistory())
  register('picker:undo', undoSchema, input => store.undo(input))
  register('picker:folder', none, async () => {
    const error = await shell.openPath(path.dirname(store.file))
    if (error) throw new Error('Folder unavailable')
  })
  register('picker:choose', none, async () => {
    const chosen = await dialog.showOpenDialog(win, { title: 'Chọn cấu hình Codex', defaultPath: store.file, properties: ['openFile'], filters: [{ name: 'TOML', extensions: ['toml'] }] })
    if (chosen.canceled || !chosen.filePaths[0]) return null
    const candidate = new ConfigStore(chosen.filePaths[0], path.join(dataDir, 'history'))
    const snapshot = await candidate.read()
    store = candidate; catalog = null
    return snapshot
  })
  register('picker:choose-cli', none, async () => {
    const chosen = await dialog.showOpenDialog(win, { title: 'Chọn Codex CLI executable', properties: ['openFile'], ...(process.platform === 'win32' ? { filters: [{ name: 'Executable', extensions: ['exe'] }] } : {}) })
    if (chosen.canceled || !chosen.filePaths[0]) return false
    executable = chosen.filePaths[0]; catalog = null
    return true
  })
  register('picker:catalog', none, async () => {
    executable ??= await findCli()
    if (!executable || path.basename(store.file) !== 'config.toml') return { status: 'unavailable', models: [], message: 'Chọn Codex CLI để lấy các mức suy luận tương thích. Tệp tùy chỉnh cần có tên config.toml.' }
    const cwd = path.join(dataDir, 'catalog')
    await fs.mkdir(cwd, { recursive: true, mode: 0o700 })
    catalog = await loadCatalog({ executable, codexHome: path.dirname(store.file), configPath: store.file, cwd, timeoutMs: 15000 })
    return catalog
  })
  return () => { for (const name of ['read', 'preview', 'save', 'history', 'undo', 'folder', 'choose', 'choose-cli', 'catalog']) ipcMain.removeHandler('picker:' + name) }
}
