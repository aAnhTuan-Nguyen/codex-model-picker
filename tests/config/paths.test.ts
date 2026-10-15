import { expect, it } from 'vitest'
import path from 'node:path'
import { resolveConfigPath } from '../../src/main/config/paths'
it('prefers chosen config then CODEX_HOME then user home', async () => {
  expect(await resolveConfigPath({ userHome: '/user', codexHome: '/custom' })).toBe(path.resolve('/custom/config.toml'))
  expect(await resolveConfigPath({ userHome: '/user' })).toBe(path.resolve('/user/.codex/config.toml'))
  expect(await resolveConfigPath({ userHome: '/user', codexHome: '/custom', chosenPath: '/other.toml' })).toBe(path.resolve('/other.toml'))
})
