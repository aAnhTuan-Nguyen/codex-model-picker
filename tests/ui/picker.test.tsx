// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/renderer/App'
import type { PickerBridge, ConfigSnapshot } from '../../src/shared/contracts'
afterEach(() => { cleanup(); delete window.modelPicker })
function setup(effort = 'medium') {
  let snapshot: ConfigSnapshot = { revision: 'original', exists: true, displayPath: 'C:\\Users\\Me\\.codex\\config.toml', warnings: [], values: { model: 'a', modelReasoningEffort: effort } }
  const save = vi.fn(async (input) => { snapshot = { ...snapshot, revision: 'saved', values: { model: input.selection.model, modelReasoningEffort: input.selection.effort.value } }; return { ok: true, data: { snapshot, historyId: 'id' } } })
  window.modelPicker = {
    readConfig: async () => ({ ok: true, data: snapshot }),
    getCatalog: async () => ({ ok: true, data: { status: 'available', models: [{ id: 'a', displayName: 'Model A', efforts: ['low', 'medium', 'high'], defaultEffort: 'medium', source: 'cli' }] } }),
    previewChange: async () => ({ ok: true, data: { before: snapshot.values, after: { model: 'a', modelReasoningEffort: 'high' }, changes: [{ key: 'model_reasoning_effort', before: 'medium', after: 'high' }] } }),
    saveConfig: save, listHistory: async () => ({ ok: true, data: [] }),
    chooseConfig: async () => ({ ok: true, data: null }), chooseCli: async () => ({ ok: true, data: false }), openConfigFolder: async () => ({ ok: true, data: undefined }), undoChange: vi.fn()
  } as PickerBridge
  render(<App />)
  return { save }
}
it('does not autosave on loading or sliding, and saves only on explicit action', async () => {
  const { save } = setup()
  const slider = await screen.findByRole('slider', { name: 'Mức suy luận' })
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Lưu mặc định' })).toBeDisabled()
  fireEvent.keyDown(slider, { key: 'End' })
  expect(save).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: 'Lưu mặc định' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  await screen.findByText('Đã lưu cấu hình mặc định')
  expect(save).toHaveBeenCalledWith({ expectedRevision: 'original', selection: { model: 'a', effort: { kind: 'set', value: 'high' } } })
  expect(screen.queryByText('Đã áp dụng cho chat')).not.toBeInTheDocument()
})
it('keeps selection and shows reload when saving finds an external edit', async () => {
  const { save } = setup()
  save.mockResolvedValueOnce({ ok: false, error: { code: 'CONFLICT', message: 'Tệp đã được chỉnh bên ngoài.' } } as any)
  fireEvent.keyDown(await screen.findByRole('slider', { name: 'Mức suy luận' }), { key: 'End' })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mặc định' }))
  await screen.findByText('Tệp đã được chỉnh bên ngoài.')
  expect(screen.getByRole('slider', { name: 'Mức suy luận' })).toHaveAttribute('aria-valuetext', 'High')
  expect(screen.getByRole('button', { name: 'Tải lại' })).toBeInTheDocument()
})
it('shows context presets without 1M and independent shared subagent controls', async () => {
  const { save } = setup()
  await screen.findByRole('slider', { name: 'Mức suy luận' })
  expect(screen.getByRole('group', { name: 'Context window' })).toBeInTheDocument()
  for (const name of ['Mặc định', '272K', '500K', '872K']) expect(screen.getByRole('radio', { name })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: /1M/ })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Model subagent' })).toBeInTheDocument()
  const subagent = screen.getByRole('slider', { name: 'Mức suy luận subagent' })
  fireEvent.keyDown(subagent, { key: 'End' })
  expect(screen.getByRole('slider', { name: 'Mức suy luận' })).toHaveAttribute('aria-valuetext', 'Medium')
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: '500K' }))
  expect(screen.getByRole('button', { name: 'Lưu mặc định' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }))
  expect(screen.getByRole('radio', { name: 'Mặc định' })).toBeChecked()
  expect(screen.getByRole('button', { name: 'Lưu mặc định' })).toBeDisabled()
})
it('does not propose rewriting an unsupported stored effort and can discard an explicit change', async () => {
  const { save } = setup('legacy')
  const slider = await screen.findByRole('slider', { name: 'Mức suy luận' })
  expect(screen.getByRole('button', { name: 'Lưu mặc định' })).toBeDisabled()
  await screen.findByText('Mức đang lưu không thuộc danh mục này. Chọn một nấc hoặc dùng mặc định Codex.')
  fireEvent.keyDown(slider, { key: 'End' })
  expect(screen.getByRole('button', { name: 'Lưu mặc định' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }))
  expect(screen.getByRole('button', { name: 'Lưu mặc định' })).toBeDisabled()
  expect(save).not.toHaveBeenCalled()
})
