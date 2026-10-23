import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'smol-toml'
import { ConfigStore } from '../../src/main/config/store'
let root: string, file: string, history: string, store: ConfigStore
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'picker-test-'))
  file = path.join(root, 'config.toml'); history = path.join(root, 'history')
  await fs.writeFile(file, 'model = "old" # keep\nother = "private"\n')
  store = new ConfigStore(file, history)
})
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })
const next = { model: 'new', effort: { kind: 'set' as const, value: 'high' } }
describe('guarded config store', () => {
  it('backs up exact bytes and writes a parseable patch', async () => {
    const original = await fs.readFile(file)
    const s = await store.read(); const result = await store.save({ expectedRevision: s.revision, selection: next })
    expect(parse(await fs.readFile(file, 'utf8'))).toEqual({ model: 'new', model_reasoning_effort: 'high', other: 'private' })
    expect(await fs.readFile(path.join(history, result.historyId + '.toml'))).toEqual(original)
    expect((await store.listHistory())[0].after.model).toBe('new')
  })
  it('binds an equivalent native canonical name before reading and saving', async () => {
    // Two names for one inode model the realpath result of a Windows 8.3 name.
    // Unlike symlinks, both directory entries are ordinary files.
    const short = path.join(root, 'alias.toml'); await fs.link(file, short)
    const canonical = await fs.realpath(file)
    const alias = new ConfigStore(short, history, { rename: fs.rename, realpath: async value => String(value) === short ? canonical : fs.realpath(value) })
    const s = await alias.read()
    expect(s.displayPath).toBe(canonical)
    await alias.save({ expectedRevision: s.revision, selection: next })
    expect(parse(await fs.readFile(canonical, 'utf8')).model).toBe('new')
  })
  it('rejects stale revisions without touching the changed file', async () => {
    const s = await store.read(); await fs.writeFile(file, 'model="someone-else"\n')
    await expect(store.save({ expectedRevision: s.revision, selection: next })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await fs.readFile(file, 'utf8')).toBe('model="someone-else"\n')
  })
  it('does not create missing files merely by reading', async () => {
    await fs.unlink(file)
    expect((await store.read()).revision).toBe('missing')
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
    await store.save({ expectedRevision: 'missing', selection: next })
    expect(parse(await fs.readFile(file, 'utf8')).model).toBe('new')
  })
  it('does not overwrite a file which appears after an empty snapshot', async () => {
    await fs.unlink(file); await store.read(); await fs.writeFile(file, '# another editor\n')
    await expect(store.save({ expectedRevision: 'missing', selection: next })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
  it('keeps original if the backup directory cannot be used', async () => {
    await fs.writeFile(history, 'not a directory')
    const s = await store.read()
    await expect(store.save({ expectedRevision: s.revision, selection: next })).rejects.toThrow()
    expect(await fs.readFile(file, 'utf8')).toContain('model = "old"')
  })
  it('respects a read-only file instead of replacing it through a writable directory', async () => {
    await fs.chmod(file, 0o444)
    try {
      await expect(store.save({ expectedRevision: (await store.read()).revision, selection: next })).rejects.toThrow()
      expect(await fs.readFile(file, 'utf8')).toContain('model = "old"')
    } finally { await fs.chmod(file, 0o600) }
  })
  it('keeps original and cleans temporary files if rename fails', async () => {
    const blocked = new ConfigStore(file, history, { rename: async () => { throw Object.assign(new Error('locked'), { code: 'EPERM' }) } })
    await expect(blocked.save({ expectedRevision: (await blocked.read()).revision, selection: next })).rejects.toThrow()
    expect(await fs.readFile(file, 'utf8')).toContain('model = "old"')
    expect((await fs.readdir(root)).filter(s => s.endsWith('.tmp'))).toEqual([])
    expect(await blocked.listHistory()).toEqual([])
  })
  it.skipIf(process.platform === 'win32')('rejects symlinks without following them', async () => {
    const link = path.join(root, 'link.toml'); await fs.symlink(file, link)
    await expect(new ConfigStore(link, history).read()).rejects.toMatchObject({ code: 'UNSAFE_PATH' })
  })
  it('preserves later unrelated edits when undoing both keys', async () => {
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: next })
    await fs.appendFile(file, 'manual=true\n')
    const result = await store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })
    expect(parse(await fs.readFile(file, 'utf8'))).toEqual({ model: 'old', other: 'private', manual: true })
    expect(result.snapshot.values.modelReasoningEffort).toBeUndefined()
  })
  it('rejects undo if a managed key has been edited manually', async () => {
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: next })
    await fs.writeFile(file, 'model="manual"\nmodel_reasoning_effort="high"\n')
    await expect(store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
  it('undoes only the keys changed by that save, preserving a later effort edit', async () => {
    await fs.writeFile(file, 'model="old"\nmodel_reasoning_effort="medium"\n')
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: { model: 'new', effort: { kind: 'keep' } } })
    await fs.writeFile(file, 'model="new"\nmodel_reasoning_effort="high"\n')
    await store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })
    expect(parse(await fs.readFile(file, 'utf8'))).toEqual({ model: 'old', model_reasoning_effort: 'high' })
  })
  it('rejects corrupt history and history belonging to another config', async () => {
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: next })
    await fs.writeFile(path.join(history, saved.historyId + '.json'), '{}')
    await expect(store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })).rejects.toThrow()
    expect((await store.read()).values.model).toBe('new')
  })
  it('writes v2 records and can undo all five managed paths without replacing other agent settings', async () => {
    const original = 'model="old"\nmodel_reasoning_effort="low"\nmodel_context_window=272000\n[agents]\nenabled=false\n[agents.explorer]\ndescription="keep"\n'
    await fs.writeFile(file, original)
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: { model: 'new', effort: { kind: 'set', value: 'high' }, contextWindow: { kind: 'set', value: 500000 }, subagentModel: { kind: 'set', value: 'child' }, subagentEffort: { kind: 'set', value: 'medium' } } })
    const metadata = JSON.parse(await fs.readFile(path.join(history, saved.historyId + '.json'), 'utf8'))
    expect(metadata.version).toBe(2)
    expect((await store.listHistory())[0].after).toEqual({ model: 'new', modelReasoningEffort: 'high', modelContextWindow: 500000, subagentModel: 'child', subagentReasoningEffort: 'medium' })
    await fs.appendFile(file, 'note="manual"\n')
    await store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })
    expect(parse(await fs.readFile(file, 'utf8'))).toEqual({ model: 'old', model_reasoning_effort: 'low', model_context_window: 272000, agents: { enabled: false, explorer: { description: 'keep', note: 'manual' } } })
  })
  it('undoes context alone while preserving later changes to other managed fields', async () => {
    await fs.writeFile(file, 'model="old"\nmodel_context_window=272000\n[agents]\ndefault_subagent_model="child"\n')
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: { model: 'old', effort: { kind: 'keep' }, contextWindow: { kind: 'set', value: 500000 } } })
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('"child"', '"manual-child"'))
    await store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })
    expect((await store.read()).values).toEqual({ model: 'old', modelContextWindow: 272000, subagentModel: 'manual-child' })
  })
  it('refuses undo if the changed subagent field was edited afterward', async () => {
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: { model: 'old', effort: { kind: 'keep' }, subagentModel: { kind: 'set', value: 'child' } } })
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('"child"', '"manual-child"'))
    await expect(store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await store.read()).values.subagentModel).toBe('manual-child')
  })
  it('reads and undoes legacy v1 history without deleting new defaults added later', async () => {
    const saved = await store.save({ expectedRevision: (await store.read()).revision, selection: next })
    const metadataFile = path.join(history, saved.historyId + '.json')
    const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'))
    metadata.version = 1
    await fs.writeFile(metadataFile, JSON.stringify(metadata))
    await fs.appendFile(file, 'model_context_window=872000\n[agents]\ndefault_subagent_model="later"\ndefault_subagent_reasoning_effort="low"\n')
    expect(await store.listHistory()).toHaveLength(1)
    await store.undo({ historyId: saved.historyId, expectedRevision: (await store.read()).revision })
    expect((await store.read()).values).toEqual({ model: 'old', modelContextWindow: 872000, subagentModel: 'later', subagentReasoningEffort: 'low' })
  })
})
