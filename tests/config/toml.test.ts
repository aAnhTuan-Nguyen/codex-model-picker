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
  it('sets numeric context and shared defaults while preserving existing agent roles and compact settings', () => {
    const original = '\uFEFFmodel="a"\r\nmodel_auto_compact_token_limit=180000 # leave\r\n[agents]\r\nenabled=false # leave\r\n[agents.explorer]\r\ndescription="keep"\r\n'
    const { bytes, preview } = buildPatch(Buffer.from(original), { model: 'a', effort: { kind: 'keep' }, contextWindow: { kind: 'set', value: 500000 }, subagentModel: { kind: 'set', value: 'child' }, subagentEffort: { kind: 'set', value: 'high' } })
    expect(parse(bytes.toString().replace(/^\uFEFF/, ''))).toEqual({ model: 'a', model_context_window: 500000, model_auto_compact_token_limit: 180000, agents: { enabled: false, default_subagent_model: 'child', default_subagent_reasoning_effort: 'high', explorer: { description: 'keep' } } })
    expect(bytes.toString()).toContain('model_auto_compact_token_limit=180000 # leave\r\n')
    expect(bytes.toString()).toContain('enabled=false # leave\r\n[agents.explorer]\r\ndescription="keep"\r\n')
    expect(preview.changes).toEqual([{ key: 'model_context_window', before: undefined, after: 500000 }, { key: 'agents.default_subagent_model', before: undefined, after: 'child' }, { key: 'agents.default_subagent_reasoning_effort', before: undefined, after: 'high' }])
  })
  it.each([
    'agents.default_subagent_model="old"\nagents.enabled=true\n',
    '["agents"]\n"default_subagent_model"="old" # keep\nenabled=true\n',
    'agents = { default_subagent_model="old", enabled=true, explorer={description="keep"} } # keep\n'
  ])('patches semantic agent paths without flattening unrelated content: %s', original => {
    const bytes = buildPatch(Buffer.from(original), { model: 'main', effort: { kind: 'keep' }, subagentModel: { kind: 'set', value: 'child' }, subagentEffort: { kind: 'set', value: 'high' } }).bytes
    const data = parse(bytes.toString())
    expect(data.agents).toMatchObject({ enabled: true, default_subagent_model: 'child', default_subagent_reasoning_effort: 'high' })
    expect(bytes.toString()).toContain(original.includes('# keep') ? '# keep' : 'agents.enabled=true')
    if (original.includes('explorer=')) expect(bytes.toString()).toContain('explorer={description="keep"}')
  })
  it.each([
    'agents={default_subagent_model="child",default_subagent_reasoning_effort="high",enabled=true}',
    'agents={enabled=true,default_subagent_model="child",default_subagent_reasoning_effort="high"}',
    'agents={default_subagent_reasoning_effort="high",enabled=true,default_subagent_model="child"}'
  ])('unsets both inline defaults without removing the agents container or siblings: %s', source => {
    const { bytes } = buildPatch(Buffer.from(source), { model: 'a', effort: { kind: 'keep' }, subagentModel: { kind: 'unset' }, subagentEffort: { kind: 'unset' } })
    expect(parse(bytes.toString())).toEqual({ model: 'a', agents: { enabled: true } })
  })
  it('adds root dotted defaults without redefining implicit agents or touching literal dotted keys', () => {
    const original = '"agents.default_subagent_model"="literal"\n[agents.explorer]\ndescription="keep"\n'
    const { bytes } = buildPatch(Buffer.from(original), { model: 'a', effort: { kind: 'keep' }, subagentModel: { kind: 'set', value: 'child' } })
    expect(parse(bytes.toString())).toEqual({ model: 'a', 'agents.default_subagent_model': 'literal', agents: { default_subagent_model: 'child', explorer: { description: 'keep' } } })
    expect(bytes.toString()).toContain('[agents.explorer]\ndescription="keep"\n')
  })
  it('preserves custom context by default and reports a configured compact threshold', () => {
    const original = 'model="a"\nmodel_context_window=1000000\nmodel_auto_compact_token_limit=100000\n'
    const snap = parseSnapshot(Buffer.from(original), '/tmp/config.toml')
    expect(snap.values).toEqual({ model: 'a', modelContextWindow: 1000000 })
    expect(snap.warnings.join(' ')).toMatch(/thu gọn/)
    expect(buildPatch(Buffer.from(original), { model: 'b', effort: { kind: 'keep' } }).bytes.toString()).toContain('model_context_window=1000000\nmodel_auto_compact_token_limit=100000\n')
  })
  it.each(['model_context_window="500000"', 'model_context_window=0', 'model_context_window=-1', 'model_context_window=5.2', 'model_context_window=9007199254740993', 'agents=true', 'agents.default_subagent_model=123', 'agents.default_subagent_reasoning_effort=[]'])('refuses invalid new managed types: %s', source => {
    expect(() => parseSnapshot(Buffer.from(source), '/tmp/config.toml')).toThrow()
  })
  it('does not move indentation from an existing agents setting when inserting defaults', () => {
    const original = 'model="a"\n[agents]\n  enabled = true # keep indentation\n'
    const { bytes } = buildPatch(Buffer.from(original), { model: 'a', effort: { kind: 'keep' }, subagentModel: { kind: 'set', value: 'child' } })
    expect(bytes.toString()).toContain('\n  enabled = true # keep indentation\n')
    expect(parse(bytes.toString()).agents).toEqual({ enabled: true, default_subagent_model: 'child' })
  })
  it('rejects a date value where the agents table is required', () => {
    expect(() => parseSnapshot(Buffer.from('agents = 2026-10-23'), '/tmp/config.toml')).toThrow()
  })
  it('inserts root keys after a BOM without moving indentation of the first table', () => {
    const original = '\uFEFF  [agents]\r\n  enabled=true\r\n'
    const { bytes } = buildPatch(Buffer.from(original), { model: 'a', effort: { kind: 'keep' }, contextWindow: { kind: 'set', value: 500000 } })
    expect(bytes.toString()).toBe('\uFEFFmodel = "a"\r\nmodel_context_window = 500000\r\n  [agents]\r\n  enabled=true\r\n')
  })
  it.each([
    'model_context_window=500000.0', 'model_context_window=5e5',
    '"model_context_window"=500000.0', '"model_context_window"=5e5'
  ])('refuses integer-valued TOML floats before reading or unrelated edits: %s', context => {
    const source = Buffer.from(`model="a"\n${context}\n`)
    expect(() => parseSnapshot(source, '/tmp/config.toml')).toThrow()
    expect(() => buildPatch(source, { model: 'b', effort: { kind: 'keep' } })).toThrow()
  })
  it.each([
    ['500_000', 500000], ['+500000', 500000], ['0x10', 16], ['0o20', 16], ['0b10000', 16]
  ])('accepts and preserves TOML integer literal %s', (literal, expected) => {
    const source = Buffer.from(`model="a"\n"model_context_window"=${literal}\n`)
    expect(parseSnapshot(source, '/tmp/config.toml').values.modelContextWindow).toBe(expected)
    expect(buildPatch(source, { model: 'b', effort: { kind: 'keep' } }).bytes.toString()).toBe(`model="b"\n"model_context_window"=${literal}\n`)
  })
})
