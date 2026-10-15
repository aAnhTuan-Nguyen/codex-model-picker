import { expect, it } from 'vitest'
import fs from 'node:fs/promises'
import vm from 'node:vm'
it('executes the production preload with only the sandbox-supported electron module', async () => {
  const exposed = new Map<string, unknown>()
  const code = await fs.readFile('out/preload/index.cjs', 'utf8')
  vm.runInNewContext(code, { require: (name: string) => {
    if (name !== 'electron') throw new Error('Sandbox cannot load ' + name)
    return { contextBridge: { exposeInMainWorld: (key: string, value: unknown) => exposed.set(key, value) }, ipcRenderer: { invoke: async () => ({ ok: true, data: null }) } }
  } })
  expect(exposed.get('modelPicker')).toHaveProperty('readConfig')
  expect(exposed.get('modelPicker')).not.toHaveProperty('invoke')
})
