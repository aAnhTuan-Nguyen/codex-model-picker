import { _electron as electron, expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
test('real sandboxed desktop saves and undoes temporary TOML without touching other keys', async () => {
  test.skip(process.platform !== 'win32' && !process.env.DISPLAY, 'Desktop requires Windows or a supported display and Chromium sandbox; renderer runs separately.')
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'picker-desktop-'))
  const home = path.join(root, 'cấu hình codex'); await fs.mkdir(home)
  const file = path.join(home, 'config.toml')
  await fs.writeFile(file, '# user comment\r\nmodel = "original"\r\nmodel_reasoning_effort = "medium"\r\nother = "keep"\r\n')
  const original = await fs.readFile(file)
  const packaged = process.env.MODEL_PICKER_EXECUTABLE
  const app = await electron.launch({ ...(packaged ? { executablePath: packaged } : {}), args: [...(packaged ? [] : ['out/main/index.js']), '--user-data-dir=' + path.join(root, 'appdata')], env: { ...process.env, CODEX_HOME: home } })
  try {
    const page = await app.firstWindow()
    await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toBeVisible()
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
    expect(await page.evaluate(() => typeof window.modelPicker?.readConfig)).toBe('function')
    await expect(page.getByText('DEV · dữ liệu minh họa')).toHaveCount(0)
    expect(await fs.readFile(file)).toEqual(original)
    await page.getByRole('combobox', { name: 'Model', exact: true }).click()
    await page.getByRole('textbox', { name: 'Tìm model' }).fill('manual-model')
    await page.getByRole('option', { name: /Dùng “manual-model”/ }).click()
    await page.getByRole('button', { name: 'Lưu mặc định' }).click()
    await expect(page.getByText('Đã lưu cấu hình mặc định', { exact: true })).toBeVisible()
    const saved = await fs.readFile(file, 'utf8')
    expect(saved).toContain('model = "manual-model"'); expect(saved).toContain('# user comment\r\n'); expect(saved).toContain('other = "keep"')
    await fs.appendFile(file, 'later = true\r\n')
    await expect(page.getByRole('button', { name: 'Tải lại' })).toBeEnabled({ timeout: 20000 })
    await page.getByRole('button', { name: 'Tải lại' }).click()
    await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Lịch sử / Hoàn tác' }).click()
    await page.getByRole('button', { name: 'Hoàn tác', exact: true }).first().click()
    await page.getByRole('button', { name: 'Xác nhận hoàn tác' }).click()
    await expect(page.getByText('Đã hoàn tác các mục cấu hình')).toBeVisible()
    const undone = await fs.readFile(file, 'utf8')
    expect(undone).toContain('model = "original"'); expect(undone).toContain('model_reasoning_effort = "medium"'); expect(undone).toContain('later = true')
  } finally { await app.close(); await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) }
})
