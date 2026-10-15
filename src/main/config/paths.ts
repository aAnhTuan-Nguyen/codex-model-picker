import path from 'node:path'
export async function resolveConfigPath(input: { codexHome?: string; userHome: string; chosenPath?: string }): Promise<string> {
  return path.resolve(input.chosenPath ?? path.join(input.codexHome || path.join(input.userHome, '.codex'), 'config.toml'))
}
