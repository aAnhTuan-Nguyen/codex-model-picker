import { describe, expect, it } from 'vitest'
import { parse } from 'smol-toml'
import { buildPatch, parseSnapshot } from '../../src/main/config/toml'
describe('precise TOML updates', () => {
  it('preserves BOM CRLF comments and unrelated tables byte for byte', () => {
    const original = '\uFEFF# riêng tư\r\n"model" = "old" # keep\r\nmodel_reasoning_effort = "medium"\r\n\r\n[profiles.work]\r\nmodel = "profile"\r\nnote = """line\r\ntext"""\r\n'
    const result = buildPatch(Buffer.from(original), { model: 'new', effort: { kind: 'set', value: 'high' } })
    expect(result.bytes.toString()).toBe(original.replace('"old"', '"new"').replace('"medium"', '"high"'))
    expect(result.preview.changes).toHaveLength(2)
  })
  it('inserts missing root keys before tables without changing nested model', () => {
    const original = '# keep\n[profiles.work]\nmodel = "nested"\n'
    const { bytes } = buildPatch(Buffer.from(original), { model: 'root', effort: { kind: 'keep' } })
    const data = parse(bytes.toString())
    expect(data.model).toBe('root')
    expect((data.profiles as any).work.model).toBe('nested')
    expect(bytes.toString()).toContain('[profiles.work]\nmodel = "nested"\n')
  })
  it('encodes model strings and preserves unrelated dotted keys', () => {
    const { bytes } = buildPatch(Buffer.from('model = "old"\nprovider.name = "unchanged"\n'), { model: 'model/"quoted"', effort: { kind: 'keep' } })
    expect(parse(bytes.toString())).toEqual({ model: 'model/"quoted"', provider: { name: 'unchanged' } })
  })
  it('unsets an effort without deleting its comment', () => {
    const { bytes } = buildPatch(Buffer.from('model = "a"\nmodel_reasoning_effort = "high" # my note\n'), { model: 'a', effort: { kind: 'unset' } })
    expect(parse(bytes.toString()).model_reasoning_effort).toBeUndefined()
    expect(bytes.toString()).toContain('# my note')
  })
  it('does not insert an inherited effort', () => {
    const { bytes } = buildPatch(Buffer.from('model="a"\n'), { model: 'b', effort: { kind: 'keep' } })
    expect(parse(bytes.toString())).toEqual({ model: 'b' })
  })
  it('rejects invalid TOML and incorrect managed types', () => {
    expect(() => parseSnapshot(Buffer.from('model = ['), '/tmp/config.toml')).toThrow()
    expect(() => parseSnapshot(Buffer.from('model = 123'), '/tmp/config.toml')).toThrow()
    expect(() => parseSnapshot(Buffer.from('model_reasoning_effort = true'), '/tmp/config.toml')).toThrow()
  })
  it('reports profile overrides and hashes exact original bytes', () => {
    const snapshot = parseSnapshot(Buffer.from('profile="work"\nmodel="a"\n'), '/tmp/config.toml')
    expect(snapshot.revision).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.warnings.join(' ')).toContain('profile')
    expect(snapshot.values).toEqual({ model: 'a' })
  })
  it('restores absent model and effort while retaining comments', () => {
    const { bytes } = buildPatch(Buffer.from('model="a" # label\nmodel_reasoning_effort="high"\nother=1\n'), { model: undefined, effort: { kind: 'unset' } })
    expect(parse(bytes.toString())).toEqual({ other: 1 })
    expect(bytes.toString()).toContain('# label')
  })
})
