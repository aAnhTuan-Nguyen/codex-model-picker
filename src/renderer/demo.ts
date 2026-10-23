import type { ConfigSnapshot, HistoryEntry, PickerBridge, Result } from '../shared/contracts'
import { managedFields, changesBetween } from '../shared/values'
import { appliedValues, previewOf } from './picker/state'
export function createDemoBridge(): PickerBridge {
  let snapshot: ConfigSnapshot = { revision: 'demo-0', values: { model: 'gpt-6-astra', modelReasoningEffort: 'high', modelContextWindow: 272000, subagentReasoningEffort: 'high' }, exists: true, displayPath: 'C:\\Users\\Bạn\\.codex\\config.toml', warnings: [] }
  const history: HistoryEntry[] = []
  const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
  const conflict = (): Result<never> => ({ ok: false, error: { code: 'CONFLICT', message: 'Dữ liệu minh họa đã đổi. Hãy tải lại.' } })
  return {
    readConfig: async () => ok(snapshot), chooseConfig: async () => ok(null), chooseCli: async () => ok(false), openConfigFolder: async () => ok(undefined),
    getCatalog: async () => ok({ status: 'available', models: [{ id: 'gpt-6-astra', displayName: 'GPT-6 Astra', efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'medium', source: 'cli' }, { id: 'gpt-6.1-sol', displayName: 'GPT-6.1 Sol', efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'], defaultEffort: 'medium', source: 'cli' }] }),
    previewChange: async selection => ok(previewOf(snapshot, selection)),
    saveConfig: async input => {
      if (input.expectedRevision !== snapshot.revision) return conflict()
      const before = snapshot.values, after = appliedValues(snapshot, input.selection), id = crypto.randomUUID()
      history.unshift({ id, createdAt: new Date().toISOString(), displayPath: snapshot.displayPath, before, after })
      snapshot = { ...snapshot, revision: id, values: after }
      return ok({ snapshot, historyId: id })
    },
    listHistory: async () => ok([...history]),
    undoChange: async input => {
      if (input.expectedRevision !== snapshot.revision) return conflict()
      const entry = history.find(h => h.id === input.historyId)
      if (!entry) return conflict()
      const after = { ...snapshot.values }
      for (const { key, property } of managedFields) {
        if (!changesBetween(entry.before, entry.after).some(change => change.key === key)) continue
        if (after[property] !== entry.after[property]) return conflict()
        if (entry.before[property] === undefined) delete after[property]
        else Object.assign(after, { [property]: entry.before[property] })
      }
      const id = crypto.randomUUID()
      history.unshift({ id, createdAt: new Date().toISOString(), displayPath: snapshot.displayPath, before: snapshot.values, after })
      snapshot = { ...snapshot, values: after, revision: id }
      return ok({ snapshot, historyId: id })
    }
  }
}
