import { _electron as electron, expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { parse } from 'smol-toml'
test('sandboxed desktop saves all defaults and preserves new keys through v1 and v2 undo', async () => {
  test.setTimeout(60000)
  test.skip(process.platform !== 'win32' && !process.env.DISPLAY, 'Desktop requires Windows or a supported display and Chromium sandbox; renderer runs separately.')
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'picker-desktop-'))
  const home = path.join(root, 'cấu hình codex'); await fs.mkdir(home)
  const file = path.join(home, 'config.toml')
  await fs.writeFile(file, '# user comment\r\nmodel = "original"\r\nmodel_reasoning_effort = "medium"\r\nmodel_context_window = 272000\r\nmodel_auto_compact_token_limit = 220000\r\nother = "keep"\r\n[agents]\r\ndefault_subagent_model = "original-child"\r\ndefault_subagent_reasoning_effort = "medium"\r\nenabled = true\r\n[agents.reviewer]\r\ndescription = "Keep my role"\r\n')
  const original = await fs.readFile(file)
  const appData = path.join(root, 'appdata')
  const history = path.join(appData, 'history')
  await fs.mkdir(history, { recursive: true })
  const legacyId = randomUUID()
  await fs.writeFile(path.join(history, `${legacyId}.json`), JSON.stringify({
    id: legacyId, createdAt: '2000-01-01T00:00:00.000Z', displayPath: await fs.realpath(file),
    before: { model: 'legacy-original', modelReasoningEffort: 'low' }, after: { model: 'original', modelReasoningEffort: 'medium' },
    version: 1, state: 'applied', beforeRevision: 'legacy-before', afterRevision: 'legacy-after'
  }))
  await fs.writeFile(path.join(history, `${legacyId}.toml`), 'model = "legacy-original"\nmodel_reasoning_effort = "low"\n')
  const packaged = process.env.MODEL_PICKER_EXECUTABLE
  const app = await electron.launch({ ...(packaged ? { executablePath: packaged } : {}), args: [...(packaged ? [] : ['out/main/index.js']), '--user-data-dir=' + appData], env: { ...process.env, CODEX_HOME: home } })
  try {
    const page = await app.firstWindow()
    await expect(page.getByRole('combobox', { name: 'Model chính', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Model subagent', exact: true })).toBeVisible()
    expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
    expect(await page.evaluate(() => typeof window.modelPicker?.readConfig)).toBe('function')
    await expect(page.getByText(/DEV ·/)).toHaveCount(0)
    expect(await fs.readFile(file)).toEqual(original)
    await expect(page.getByRole('button', { name: 'Lưu mặc định', exact: true })).toBeDisabled()
    await page.getByRole('combobox', { name: 'Model chính', exact: true }).click()
    await page.getByRole('textbox', { name: 'Tìm model' }).fill('manual-model')
    await page.getByRole('option', { name: /Dùng “manual-model”/ }).click()
    await page.getByRole('combobox', { name: 'Model subagent', exact: true }).click()
    await page.getByRole('textbox', { name: 'Tìm model subagent', exact: true }).fill('manual-child')
    await page.getByRole('option', { name: /Dùng “manual-child”/ }).click()
    await page.getByRole('radio', { name: '500K', exact: true }).check()
    expect(await fs.readFile(file)).toEqual(original)
    await page.getByRole('button', { name: 'Lưu mặc định' }).click()
    await expect(page.getByText('Đã lưu cấu hình mặc định', { exact: true })).toBeVisible()
    const saved = await fs.readFile(file, 'utf8')
    const savedValues = parse(saved)
    expect(savedValues).toMatchObject({ model: 'manual-model', model_context_window: 500000, model_auto_compact_token_limit: 220000, other: 'keep', agents: { default_subagent_model: 'manual-child', enabled: true, reviewer: { description: 'Keep my role' } } })
    expect(savedValues).not.toHaveProperty('model_reasoning_effort')
    expect(savedValues.agents).not.toHaveProperty('default_subagent_reasoning_effort')
    expect(saved).toContain('# user comment\r\n')
    await fs.writeFile(file, 'later = true\r\n' + saved.replace('enabled = true', 'enabled = false'))
    await expect(page.getByRole('button', { name: 'Tải lại' })).toBeEnabled({ timeout: 20000 })
    await page.getByRole('button', { name: 'Tải lại' }).click()
    await expect(page.getByRole('combobox', { name: 'Model chính', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Lịch sử / Hoàn tác' }).click()
    await page.getByRole('button', { name: 'Hoàn tác', exact: true }).first().click()
    await page.getByRole('button', { name: 'Xác nhận hoàn tác' }).click()
    await expect(page.getByText('Đã hoàn tác các mục cấu hình')).toBeVisible()
    const undone = await fs.readFile(file, 'utf8')
    expect(parse(undone)).toMatchObject({ model: 'original', model_reasoning_effort: 'medium', model_context_window: 272000, model_auto_compact_token_limit: 220000, other: 'keep', later: true, agents: { default_subagent_model: 'original-child', default_subagent_reasoning_effort: 'medium', enabled: false, reviewer: { description: 'Keep my role' } } })

    await page.getByRole('button', { name: 'Lịch sử / Hoàn tác' }).click()
    await page.locator('.history-list li').filter({ hasText: '2000' }).getByRole('button', { name: 'Hoàn tác', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận hoàn tác', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Model chính', exact: true })).toContainText('legacy-original')
    const legacyUndone = parse(await fs.readFile(file, 'utf8'))
    expect(legacyUndone).toMatchObject({ model: 'legacy-original', model_reasoning_effort: 'low', model_context_window: 272000, model_auto_compact_token_limit: 220000, later: true, agents: { default_subagent_model: 'original-child', default_subagent_reasoning_effort: 'medium', enabled: false } })
  } finally { await app.close(); await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) }
})
