import { expect, it } from 'vitest'
import { appliedValues, deriveSelection, deriveSubagentSelection, deriveEffortSteps, effortLabel, isDirty, previewOf, selectionIssue } from '../../src/renderer/picker/state'
import type { ConfigSnapshot, ModelOption } from '../../src/shared/contracts'
const snapshot: ConfigSnapshot = { revision: 'x', exists: true, displayPath: 'config.toml', warnings: [], values: { model: 'a', modelReasoningEffort: 'medium' } }
const a: ModelOption = { id: 'a', displayName: 'A', efforts: ['low', 'medium', 'high', 'high'], defaultEffort: 'medium', source: 'cli' }
it('uses only actual discrete steps and does not dirty loaded values', () => {
  expect(deriveEffortSteps(a)).toEqual(['low', 'medium', 'high'])
  expect(isDirty(snapshot, deriveSelection({ snapshot, model: a, previous: null }))).toBe(false)
})
it('uses the new model default if previous effort is unsupported', () => {
  const b: ModelOption = { ...a, id: 'b', efforts: ['low', 'high'], defaultEffort: 'high' }
  expect(deriveSelection({ snapshot, model: b, previous: { model: 'a', effort: { kind: 'set', value: 'medium' } } })).toEqual({ model: 'b', effort: { kind: 'set', value: 'high' } })
})
it('keeps inherited effort absent and unsets stale effort on manual models', () => {
  expect(deriveSelection({ snapshot: { ...snapshot, values: { model: 'a' } }, model: a, previous: null }).effort).toEqual({ kind: 'keep' })
  expect(deriveSelection({ snapshot, model: { ...a, id: 'manual', efforts: null, source: 'manual' }, previous: { model: 'a', effort: { kind: 'keep' } } }).effort).toEqual({ kind: 'unset' })
})
it('preserves unsupported persisted effort on load, metadata refresh and discard', () => {
  const old = { ...snapshot, values: { model: 'a', modelReasoningEffort: 'legacy' } }
  const model = { ...a, efforts: ['low', 'high'], defaultEffort: 'high' }
  const initial = deriveSelection({ snapshot: old, model, previous: null })
  expect(initial.effort).toEqual({ kind: 'keep' })
  expect(isDirty(old, initial)).toBe(false)
  expect(deriveSelection({ snapshot: old, model, previous: initial }).effort).toEqual({ kind: 'keep' })
  const reset = deriveSelection({ snapshot: old, model, previous: null })
  expect(isDirty(old, reset)).toBe(false)
})
it('previews context and subagent edits independently of main settings', () => {
  const selection = { model: 'a', effort: { kind: 'keep' as const }, contextWindow: { kind: 'set' as const, value: 500000 }, subagentModel: { kind: 'set' as const, value: 'b' }, subagentEffort: { kind: 'set' as const, value: 'high' } }
  expect(appliedValues(snapshot, selection)).toEqual({ model: 'a', modelReasoningEffort: 'medium', modelContextWindow: 500000, subagentModel: 'b', subagentReasoningEffort: 'high' })
  expect(previewOf(snapshot, selection).changes.map(c => c.key)).toEqual(['model_context_window', 'agents.default_subagent_model', 'agents.default_subagent_reasoning_effort'])
})
it('preserves custom context and subagent edits across main model changes', () => {
  const previous = { model: 'a', effort: { kind: 'keep' as const }, contextWindow: { kind: 'set' as const, value: 872000 }, subagentModel: { kind: 'set' as const, value: 'child' }, subagentEffort: { kind: 'set' as const, value: 'low' } }
  const next = deriveSelection({ snapshot, model: { ...a, id: 'b' }, previous })
  expect(next.contextWindow).toEqual(previous.contextWindow)
  expect(next.subagentModel).toEqual(previous.subagentModel)
  expect(next.subagentEffort).toEqual(previous.subagentEffort)
})
it('keeps stored custom context and subagent legacy effort unchanged on load', () => {
  const stored = { ...snapshot, values: { ...snapshot.values, modelContextWindow: 1000000, subagentModel: 'child', subagentReasoningEffort: 'legacy' } }
  const loaded = deriveSelection({ snapshot: stored, model: a, previous: null })
  expect(isDirty(stored, loaded)).toBe(false)
  expect(appliedValues(stored, loaded)).toEqual(stored.values)
})
it('changes subagent model without changing main model or context, resolving incompatible effort visibly', () => {
  const stored = { ...snapshot, values: { ...snapshot.values, modelContextWindow: 500000, subagentModel: 'child', subagentReasoningEffort: 'medium' } }
  const previous = deriveSelection({ snapshot: stored, model: a, previous: null })
  const next = deriveSubagentSelection({ snapshot: stored, model: { ...a, id: 'b', efforts: ['low', 'high'], defaultEffort: 'high' }, previous })
  expect(appliedValues(stored, next)).toEqual({ ...stored.values, subagentModel: 'b', subagentReasoningEffort: 'high' })
  expect(next.model).toBe('a')
})
it('clears only the subagent model when choosing default and preserves compatible effort', () => {
  const stored = { ...snapshot, values: { ...snapshot.values, subagentModel: 'child', subagentReasoningEffort: 'high' } }
  const next = deriveSubagentSelection({ snapshot: stored, model: null, inheritedModel: a, previous: { model: 'a', effort: { kind: 'keep' } } })
  expect(appliedValues(stored, next)).toEqual({ model: 'a', modelReasoningEffort: 'medium', subagentReasoningEffort: 'high' })
})
it.each([undefined, { ...a, efforts: null }])('preserves subagent effort when choosing default without known inherited capabilities (%s)', inheritedModel => {
  const stored = { ...snapshot, values: { ...snapshot.values, subagentModel: 'child', subagentReasoningEffort: 'high' } }
  const next = deriveSubagentSelection({ snapshot: stored, model: null, inheritedModel, previous: { model: 'a', effort: { kind: 'keep' } } })
  expect(appliedValues(stored, next)).toEqual({ model: 'a', modelReasoningEffort: 'medium', subagentReasoningEffort: 'high' })
  expect(previewOf(stored, next).changes.map(change => change.key)).toEqual(['agents.default_subagent_model'])
})
it('still proposes dropping stale effort for a specific manual or effortless subagent model', () => {
  const stored = { ...snapshot, values: { ...snapshot.values, subagentModel: 'child', subagentReasoningEffort: 'high' } }
  for (const efforts of [null, []]) {
    const next = deriveSubagentSelection({ snapshot: stored, model: { ...a, id: 'new-child', efforts, defaultEffort: null }, previous: { model: 'a', effort: { kind: 'keep' } } })
    expect(appliedValues(stored, next)).toEqual({ model: 'a', modelReasoningEffort: 'medium', subagentModel: 'new-child' })
    expect(next.subagentEffort).toEqual({ kind: 'unset' })
  }
})
it('flags incompatible inherited subagent effort after a main-model change', () => {
  const stored = { ...snapshot, values: { ...snapshot.values, subagentReasoningEffort: 'medium' } }
  const main = { ...a, id: 'b', efforts: ['high'], defaultEffort: 'high' }
  const selected = deriveSelection({ snapshot: stored, model: main, previous: { model: 'a', effort: { kind: 'keep' } } })
  expect(selectionIssue(stored, main, selected, { ...main, id: '' })).toMatch(/subagent/i)
})
it('rejects unsafe context numbers and keeps valid context edits selectable without a catalog', () => {
  const manual = { ...a, efforts: null }
  expect(selectionIssue(snapshot, manual, { model: 'a', effort: { kind: 'keep' }, contextWindow: { kind: 'set', value: -1 } })).toMatch(/context/i)
  expect(selectionIssue(snapshot, manual, { model: 'a', effort: { kind: 'keep' }, contextWindow: { kind: 'set', value: 500000 } })).toBeNull()
})
it('labels Max, Ultra and Persistent distinctly without aliasing their IDs', () => {
  expect(['xhigh', 'max', 'ultra', 'persistent'].map(effortLabel)).toEqual(['XHigh', 'Max', 'Ultra', 'Persistent'])
})
it('preserves advertised reasoning order and never invents Max or Ultra', () => {
  expect(deriveEffortSteps({ ...a, efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] })).toEqual(['low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
  expect(deriveEffortSteps({ ...a, efforts: ['ultra', 'max', 'high', 'max'] })).toEqual(['ultra', 'max', 'high'])
  expect(deriveEffortSteps(a)).toEqual(['low', 'medium', 'high'])
})
it.each(['max', 'ultra'])('preserves subagent %s exactly through values and preview', value => {
  const selected = { model: 'a', effort: { kind: 'keep' as const }, subagentEffort: { kind: 'set' as const, value } }
  const available = { ...a, efforts: ['low', 'max', 'ultra'] }
  expect(appliedValues(snapshot, selected).subagentReasoningEffort).toBe(value)
  expect(previewOf(snapshot, selected).changes).toEqual([{ key: 'agents.default_subagent_reasoning_effort', before: undefined, after: value }])
  expect(selectionIssue(snapshot, a, selected, available)).toBeNull()
})
