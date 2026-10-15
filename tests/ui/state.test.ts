import { expect, it } from 'vitest'
import { deriveSelection, deriveEffortSteps, isDirty } from '../../src/renderer/picker/state'
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
