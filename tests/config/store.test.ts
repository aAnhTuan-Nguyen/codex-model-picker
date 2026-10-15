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
})
