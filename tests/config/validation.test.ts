import { expect, it } from 'vitest'
import { selectionSchema } from '../../src/shared/validation'

const selection = { model: 'main', effort: { kind: 'keep' }, contextWindow: { kind: 'set', value: 500000 }, subagentModel: { kind: 'set', value: 'child' }, subagentEffort: { kind: 'set', value: 'high' } }
it('accepts typed shared defaults and retains exact numeric tokens across the IPC boundary', () => {
  expect(selectionSchema.parse(selection)).toEqual(selection)
})
it.each([0, -1, 2.5, '500000', Infinity, Number.MAX_SAFE_INTEGER + 1])('refuses invalid numeric context payload %s', value => {
  expect(selectionSchema.safeParse({ ...selection, contextWindow: { kind: 'set', value } }).success).toBe(false)
})
it('refuses malformed subagent model IDs and extra write capabilities', () => {
  expect(selectionSchema.safeParse({ ...selection, subagentModel: { kind: 'set', value: 'with space' } }).success).toBe(false)
  expect(selectionSchema.safeParse({ ...selection, arbitraryFile: '/tmp/other' }).success).toBe(false)
  expect(selectionSchema.safeParse({ ...selection, contextWindow: { kind: 'unset', value: 500000 } }).success).toBe(false)
})
