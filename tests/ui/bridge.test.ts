import { describe, expect, it } from 'vitest'
import { selectionSchema, saveSchema, createBridge } from '../../src/shared/contracts'
describe('narrow desktop bridge', () => {
  it('rejects arbitrary paths and unknown fields on save', () => {
    expect(saveSchema.safeParse({ expectedRevision: 'abc', selection: { model: 'model-a', effort: { kind: 'keep' } }, path: '/arbitrary' }).success).toBe(false)
  })
  it('rejects control characters and invalid effort payloads', () => {
    expect(selectionSchema.safeParse({ model: 'a\nb', effort: { kind: 'keep' } }).success).toBe(false)
    expect(selectionSchema.safeParse({ model: 'a', effort: { kind: 'set', value: 'bad\nvalue' } }).success).toBe(false)
  })
  it('exposes only fixed channels, never general invoke', async () => {
    const seen: unknown[] = []
    const bridge = createBridge(async (...args) => { seen.push(args); return { ok: true, data: null } })
    await bridge.readConfig()
    expect(seen).toEqual([['picker:read']])
    expect(Object.keys(bridge)).not.toContain('invoke')
  })
})
