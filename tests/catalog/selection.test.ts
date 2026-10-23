import { expect, it } from 'vitest'
import type { CatalogResult, ManagedValues, Selection } from '../../src/shared/contracts'
import { assertSupportedEfforts } from '../../src/main/catalog/selection'

const catalog: CatalogResult = { status: 'available', models: [
  { id: 'main', displayName: 'Main', efforts: ['low', 'high'], defaultEffort: 'high', source: 'cli' },
  { id: 'child', displayName: 'Child', efforts: ['low'], defaultEffort: 'low', source: 'cli' },
  { id: 'saved', displayName: 'Saved', efforts: ['medium'], defaultEffort: 'medium', source: 'cli' },
  { id: 'unknown-efforts', displayName: 'Unknown', efforts: null, defaultEffort: null, source: 'cli' }
] }
const base: Selection = { model: 'main', effort: { kind: 'keep' } }

it('rejects an explicit main effort unsupported by the selected main model', () => {
  expect(() => assertSupportedEfforts({ ...base, effort: { kind: 'set', value: 'medium' } }, {}, catalog)).toThrow()
})
it('does not trust stale capabilities inside an unavailable catalog for main effort', () => {
  expect(() => assertSupportedEfforts({ ...base, effort: { kind: 'set', value: 'high' } }, {}, { ...catalog, status: 'unavailable' })).toThrow()
})
it.each(['child', 'manual', 'unknown-efforts'])('rejects an unsupported or unverified explicit subagent effort for %s even when main effort is valid', id => {
  expect(() => assertSupportedEfforts({ ...base, effort: { kind: 'set', value: 'high' }, subagentModel: { kind: 'set', value: id }, subagentEffort: { kind: 'set', value: 'high' } }, {}, catalog)).toThrow()
})
it.each([null, { status: 'unavailable', models: catalog.models } as CatalogResult])('refuses explicit subagent effort when capability verification is unavailable', unavailable => {
  expect(() => assertSupportedEfforts({ ...base, subagentEffort: { kind: 'set', value: 'high' } }, {}, unavailable)).toThrow()
})
it.each([
  [{ ...base, subagentEffort: { kind: 'set', value: 'high' } }, {}],
  [{ ...base, subagentModel: { kind: 'set', value: 'child' }, subagentEffort: { kind: 'set', value: 'low' } }, {}],
  [{ ...base, subagentModel: { kind: 'keep' }, subagentEffort: { kind: 'set', value: 'medium' } }, { subagentModel: 'saved' }],
  [{ ...base, subagentEffort: { kind: 'set', value: 'medium' } }, { subagentModel: 'saved' }],
  [{ ...base, subagentModel: { kind: 'unset' }, subagentEffort: { kind: 'set', value: 'high' } }, { subagentModel: 'saved' }]
] as [Selection, ManagedValues][])('validates explicit subagent effort against the resulting model selection', (selection, current) => {
  expect(() => assertSupportedEfforts(selection, current, catalog)).not.toThrow()
})
it.each([
  { ...base, subagentEffort: { kind: 'keep' } },
  { ...base, effort: { kind: 'unset' }, subagentModel: { kind: 'set', value: 'manual' }, subagentEffort: { kind: 'unset' } },
  base
] as Selection[])('allows keep and unset edits offline without validating preserved legacy efforts', selection => {
  expect(() => assertSupportedEfforts(selection, { modelReasoningEffort: 'legacy', subagentModel: 'manual', subagentReasoningEffort: 'legacy' }, null)).not.toThrow()
})
