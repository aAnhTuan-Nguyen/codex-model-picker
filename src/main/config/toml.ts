import { createHash } from 'node:crypto'
import { parse, stringify } from 'smol-toml'
import { parseForESLint } from 'toml-eslint-parser'
import type { ChangePreview, ConfigSnapshot, EffortEdit, ManagedValues } from '../../shared/contracts'
export class ConfigError extends Error {
  constructor(public code: 'INVALID_CONFIG' | 'CONFLICT' | 'UNSAFE_PATH' | 'IO_ERROR' | 'INVALID_SELECTION', message: string) { super(message) }
}
export const revisionOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
function decode(bytes: Buffer): string {
  const source = bytes.toString('utf8')
  if (!Buffer.from(source).equals(bytes)) throw new ConfigError('INVALID_CONFIG', 'Tệp cấu hình cần dùng UTF-8 hợp lệ.')
  return source
}
function document(bytes: Buffer) {
  const source = decode(bytes)
  try {
    const data = parse(source.replace(/^\uFEFF/, ''))
    for (const key of ['model', 'model_reasoning_effort']) if (key in data && typeof data[key] !== 'string') throw new Error('type')
    return { source, data }
  } catch { throw new ConfigError('INVALID_CONFIG', 'TOML không hợp lệ hoặc model/mức suy luận không phải chuỗi. Hãy sửa tệp trước khi lưu.') }
}
function valuesOf(data: Record<string, unknown>): ManagedValues {
  return { ...(typeof data.model === 'string' ? { model: data.model } : {}), ...(typeof data.model_reasoning_effort === 'string' ? { modelReasoningEffort: data.model_reasoning_effort } : {}) }
}
export function parseSnapshot(bytes: Buffer, canonicalPath: string): ConfigSnapshot {
  const { data } = document(bytes)
  const warnings: string[] = []
  if (data.profile || data.profiles) warnings.push('Tệp có profile; model trong profile hoặc lựa chọn của Codex có thể ưu tiên hơn mặc định này.')
  if (data.plan_mode_reasoning_effort) warnings.push('Plan có mức suy luận riêng; công cụ giữ nguyên mục đó.')
  return { revision: revisionOf(bytes), values: valuesOf(data), warnings, exists: true, displayPath: canonicalPath }
}
export function buildPatch(bytes: Buffer, selection: { model?: string; effort: EffortEdit }): { bytes: Buffer; preview: ChangePreview } {
  const { source, data } = document(bytes)
  const before = valuesOf(data)
  const after: ManagedValues = { ...before }
  if (selection.model === undefined) delete after.model
  else after.model = selection.model
  if (selection.effort.kind === 'unset') delete after.modelReasoningEffort
  if (selection.effort.kind === 'set') after.modelReasoningEffort = selection.effort.value
  const changes: ChangePreview['changes'] = []
  // The AST parser rejects BOM. A single space keeps every UTF-16 range aligned.
  const ast = parseForESLint(source.replace(/^\uFEFF/, ' '), { filePath: 'config.toml' }).ast
  const root = ast.body[0]
  const operations: { from: number; to: number; text: string }[] = []
  const additions: string[] = []
  const encode = (value: string) => stringify({ v: value }).slice('v = '.length).trimEnd()
  for (const [key, property] of [['model', 'model'], ['model_reasoning_effort', 'modelReasoningEffort']] as const) {
    if (before[property] === after[property]) continue
    changes.push({ key, before: before[property], after: after[property] })
    const entry = root.body.find(item => item.type === 'TOMLKeyValue' && item.key.keys.length === 1 && (item.key.keys[0].type === 'TOMLBare' ? item.key.keys[0].name : item.key.keys[0].value) === key)
    if (entry?.type === 'TOMLKeyValue') {
      if (after[property] === undefined) operations.push({ from: entry.range[0], to: entry.range[1], text: '' })
      else operations.push({ from: entry.value.range[0], to: entry.value.range[1], text: encode(after[property]!) })
    } else if (after[property] !== undefined) additions.push(`${key} = ${encode(after[property]!)}`)
  }
  if (additions.length) {
    const point = root.body.find(item => item.type === 'TOMLTable')?.range[0] ?? source.length
    const newline = source.includes('\r\n') ? '\r\n' : '\n'
    const prefix = point > 0 && !/[\r\n\uFEFF]/.test(source[point - 1]) ? newline : ''
    operations.push({ from: point, to: point, text: `${prefix}${additions.join(newline)}${newline}` })
  }
  let output = source
  for (const op of operations.sort((a, b) => b.from - a.from)) output = output.slice(0, op.from) + op.text + output.slice(op.to)
  const result = Buffer.from(output)
  document(result)
  return { bytes: result, preview: { before, after, changes } }
}
