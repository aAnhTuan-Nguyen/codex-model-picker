// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { CatalogResult, ConfigSnapshot, ModelOption, PickerBridge, Result } from '../../src/shared/contracts'
import { usePicker } from '../../src/renderer/picker/usePicker'
import { applySelection } from '../../src/shared/values'

const models: ModelOption[] = [
  { id: 'a', displayName: 'A', efforts: ['low', 'medium', 'high'], defaultEffort: 'medium', source: 'cli' },
  { id: 'b', displayName: 'B', efforts: ['low', 'high'], defaultEffort: 'high', source: 'cli' }
]
afterEach(() => { cleanup(); delete window.modelPicker })
function setup() {
  let snapshot: ConfigSnapshot = { revision: 'old', values: { model: 'a', modelReasoningEffort: 'medium', modelContextWindow: 1000000 }, warnings: [], displayPath: 'config.toml', exists: true }
  let resolveCatalog!: (value: Result<CatalogResult>) => void
  const catalog = new Promise<Result<CatalogResult>>(resolve => { resolveCatalog = resolve })
  window.modelPicker = {
    readConfig: async () => ({ ok: true, data: snapshot }),
    getCatalog: () => catalog,
    previewChange: async () => ({ ok: true, data: { before: {}, after: {}, changes: [] } }),
    saveConfig: async input => {
      snapshot = { ...snapshot, revision: 'saved', values: applySelection(snapshot.values, input.selection) }
      return { ok: true, data: { snapshot, historyId: 'saved' } }
    },
    chooseConfig: async () => ({ ok: true, data: null }), chooseCli: async () => ({ ok: true, data: false }),
    listHistory: async () => ({ ok: true, data: [] }), openConfigFolder: async () => ({ ok: true, data: undefined }),
    undoChange: async () => ({ ok: false, error: { code: 'CONFLICT', message: 'No history in this fixture.' } })
  } as PickerBridge
  return { finishCatalog: () => resolveCatalog({ ok: true, data: { status: 'available', models } }) }
}

it('retains context and subagent choices made while catalog loads', async () => {
  const { finishCatalog } = setup()
  const { result } = renderHook(usePicker)
  await waitFor(() => expect(result.current.catalogLoading).toBe(true))
  act(() => {
    result.current.setContextWindow({ kind: 'set', value: 500000 })
    result.current.selectSubagentModel(models[1])
    result.current.setSubagentEffort({ kind: 'set', value: 'high' })
  })
  await act(async () => { finishCatalog() })
  expect(result.current.preview?.after).toEqual({ model: 'a', modelReasoningEffort: 'medium', modelContextWindow: 500000, subagentModel: 'b', subagentReasoningEffort: 'high' })
  expect(result.current.selectedSubagentModel.id).toBe('b')
  expect(result.current.selectedModel.id).toBe('a')
  act(() => result.current.reset())
  expect(result.current.dirty).toBe(false)
  expect(result.current.preview?.after.modelContextWindow).toBe(1000000)
  expect(result.current.subagentInheritsModel).toBe(true)
})

it('does not resurrect an effort removed by a save before catalog arrives', async () => {
  const { finishCatalog } = setup()
  const { result } = renderHook(usePicker)
  await waitFor(() => expect(result.current.catalogLoading).toBe(true))
  act(() => result.current.setEffort({ kind: 'unset' }))
  await act(async () => { await result.current.apply() })
  expect(result.current.snapshot?.values.modelReasoningEffort).toBeUndefined()
  await act(async () => { finishCatalog() })
  expect(result.current.dirty).toBe(false)
  expect(result.current.preview?.after.modelReasoningEffort).toBeUndefined()
})
