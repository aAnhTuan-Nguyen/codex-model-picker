import { afterEach, beforeEach, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadCatalog } from '../../src/main/catalog/client'
import { normalizeModels } from '../../src/main/catalog/normalize'
let root: string
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'picker-rpc-')) })
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }) })
it('normalizes real capabilities without inventing efforts', () => {
  expect(normalizeModels({ data: [{ id: 'a', model: 'a', displayName: 'A', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'high' }, { reasoningEffort: 'high' }], defaultReasoningEffort: 'high' }] })[0]).toMatchObject({ id: 'a', efforts: ['low', 'high'], defaultEffort: 'high', source: 'cli' })
  expect(normalizeModels({ data: [{ model: 'b', supportedReasoningEfforts: [] }] })[0].efforts).toEqual([])
  expect(() => normalizeModels({ token: 'secret' })).toThrow()
})
it('initializes, reads pages and never sends inference', async () => {
  const cli = path.join(root, 'fake cli.cjs')
  await fs.writeFile(cli, `const rl=require('readline').createInterface({input:process.stdin});rl.on('line',line=>{const m=JSON.parse(line);require('fs').appendFileSync(${JSON.stringify(path.join(root, 'calls'))},m.method+'\\n');if(m.id){const result=m.method==='initialize'?{}:m.method==='config/read'?{config:{model_provider:'openai'}}:{data:[{model:m.params.cursor?'b':'a',supportedReasoningEfforts:[{reasoningEffort:'high'}],defaultReasoningEffort:'high'}],nextCursor:m.params.cursor?null:'next'};const s=JSON.stringify({id:m.id,result})+'\\n';process.stdout.write(s.slice(0,5));setTimeout(()=>process.stdout.write(s.slice(5)),5)}});`)
  const config = path.join(root, 'config.toml'); await fs.writeFile(config, 'model="a"\n')
  const result = await loadCatalog({ executable: process.execPath, prefixArgs: [cli], codexHome: root, configPath: config, cwd: root, timeoutMs: 1500 })
  expect(result.status).toBe('available')
  expect(result.models.map(m => m.id)).toEqual(['a', 'b'])
  expect(await fs.readFile(path.join(root, 'calls'), 'utf8')).toBe('initialize\ninitialized\nconfig/read\nmodel/list\nmodel/list\n')
})
it('times out and closes its process without leaking raw stderr', async () => {
  const cli = path.join(root, 'hang.cjs'); await fs.writeFile(cli, 'process.stderr.write("SECRET_VALUE");setInterval(()=>{},1000)')
  const config = path.join(root, 'config.toml'); await fs.writeFile(config, '')
  const result = await loadCatalog({ executable: process.execPath, prefixArgs: [cli], codexHome: root, configPath: config, cwd: root, timeoutMs: 100 })
  expect(result.status).toBe('unavailable'); expect(JSON.stringify(result)).not.toContain('SECRET_VALUE')
})
it('rejects mismatched homes and cmd wrappers without starting them', async () => {
  const base = { codexHome: root, configPath: path.join(root, 'different.toml'), cwd: root, timeoutMs: 100 }
  expect((await loadCatalog({ ...base, executable: process.execPath })).status).toBe('unavailable')
  expect((await loadCatalog({ ...base, configPath: path.join(root, 'config.toml'), executable: 'codex.cmd' })).status).toBe('unavailable')
})
