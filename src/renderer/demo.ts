import type { ConfigSnapshot, HistoryEntry, PickerBridge, Result } from '../shared/contracts'
import { appliedValues, previewOf } from './picker/state'
export function createDemoBridge(): PickerBridge {
  let snapshot: ConfigSnapshot = { revision: 'demo-0', values: { model: 'gpt-5.3-codex', modelReasoningEffort: 'medium' }, exists: true, displayPath: 'C:\\Users\\Bạn\\.codex\\config.toml', warnings: [] }
  const history: HistoryEntry[] = []
  const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
  return {
    readConfig: async () => ok(snapshot), chooseConfig: async () => ok(null), chooseCli: async () => ok(false), openConfigFolder: async () => ok(undefined),
    getCatalog: async () => ok({ status: 'available', models: [{ id: 'gpt-5.3-codex', displayName: 'GPT-5.3 Codex', efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'medium', source: 'cli' }, { id: 'gpt-5.4', displayName: 'GPT-5.4', efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'medium', source: 'cli' }] }),
    previewChange: async selection => ok(previewOf(snapshot, selection)),
    saveConfig: async input => {
      const before = snapshot.values, after = appliedValues(snapshot, input.selection), id = crypto.randomUUID()
      history.unshift({ id, createdAt: new Date().toISOString(), displayPath: snapshot.displayPath, before, after })
      snapshot = { ...snapshot, revision: id, values: after }
      return ok({ snapshot, historyId: id })
    },
    listHistory: async () => ok([...history]),
    undoChange: async input => {
      const entry = history.find(h => h.id === input.historyId)
      if (!entry) return { ok: false, error: { code: 'CONFLICT', message: 'Không có bản ghi minh họa này.' } }
      snapshot = { ...snapshot, values: entry.before, revision: crypto.randomUUID() }
      return ok({ snapshot, historyId: snapshot.revision })
    }
  }
}
