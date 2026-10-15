import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolveConfigPath } from './config/paths'
import { installHandlers } from './ipc'
const here = path.dirname(fileURLToPath(import.meta.url))
let win: BrowserWindow | null = null
const dataArgument = app.commandLine.getSwitchValue('user-data-dir')
if (dataArgument) app.setPath('userData', path.resolve(dataArgument))
app.setAppUserModelId('dev.aanhtuan.codex-model-picker')
async function createWindow() {
  win = new BrowserWindow({ title: 'Codex Model Picker', icon: path.join(app.getAppPath(), 'build/icon.png'), width: 760, height: 752, minWidth: 640, minHeight: 600, backgroundColor: '#171a20', autoHideMenuBar: true,
    webPreferences: { preload: path.join(here, '../preload/index.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } })
  const cleanup = installHandlers(win, await resolveConfigPath({ codexHome: process.env.CODEX_HOME, userHome: os.homedir() }), app.getPath('userData'))
  win.on('closed', () => { cleanup(); win = null })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', e => e.preventDefault())
  const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  if (devUrl && ['localhost', '127.0.0.1'].includes(new URL(devUrl).hostname)) await win.loadURL(devUrl)
  else await win.loadFile(path.join(here, '../renderer/index.html'))
}
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const dev = !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL)
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [dev ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*; img-src 'self' data:" : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:"] } })
  })
  await createWindow()
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
