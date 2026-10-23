import { createHash } from 'node:crypto'
import { parse, stringify } from 'smol-toml'
import { parseForESLint, type AST } from 'toml-eslint-parser'
import type { ChangePreview, ConfigSnapshot, ManagedValues } from '../../shared/contracts'
import { applySelection, changesBetween, managedFields, type PatchSelection } from '../../shared/values'

export class ConfigError extends Error {
  constructor(public code: 'INVALID_CONFIG' | 'CONFLICT' | 'UNSAFE_PATH' | 'IO_ERROR' | 'INVALID_SELECTION', message: string) { super(message) }
}
export const revisionOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
function decode(bytes: Buffer): string {
  const source = bytes.toString('utf8')
  if (!Buffer.from(source).equals(bytes)) throw new ConfigError('INVALID_CONFIG', 'Tệp cấu hình cần dùng UTF-8 hợp lệ.')
  return source
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}
function lookup(data: Record<string, unknown>, path: string[]): unknown {
  let value: unknown = data
  for (const key of path) value = object(value) && Object.hasOwn(value, key) ? value[key] : undefined
  return value
}
function document(bytes: Buffer) {
  const source = decode(bytes)
  try {
    const data = parse(source.replace(/^\uFEFF/, ''))
    if (Object.hasOwn(data, 'agents') && !object(data.agents)) throw new Error('agents type')
    for (const { key, property } of managedFields) {
      const value = lookup(data, key.split('.'))
      if (value === undefined) continue
      if (property === 'modelContextWindow') {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('context type')
        // JS numbers erase TOML's integer/float distinction (500000.0 and 5e5
        // are both Number.isSafeInteger), but Codex requires a TOML integer.
        const entry = syntax(source).body[0].body.find(item => item.type === 'TOMLKeyValue' && sameKeys(keyParts(item.key), ['model_context_window']))
        if (entry?.type !== 'TOMLKeyValue' || entry.value.type !== 'TOMLValue' || entry.value.kind !== 'integer') throw new Error('context literal type')
      } else if (typeof value !== 'string') throw new Error('string type')
    }
    return { source, data }
  } catch { throw new ConfigError('INVALID_CONFIG', 'TOML không hợp lệ hoặc cấu hình model, context, subagent sai kiểu. Hãy sửa tệp trước khi lưu.') }
}
function valuesOf(data: Record<string, unknown>): ManagedValues {
  const entries = managedFields.flatMap(({ key, property }) => {
    const value = lookup(data, key.split('.'))
    return value === undefined ? [] : [[property, value]]
  })
  return Object.fromEntries(entries) as ManagedValues
}
export function parseSnapshot(bytes: Buffer, canonicalPath: string): ConfigSnapshot {
  const { data } = document(bytes)
  const warnings: string[] = []
  if (data.profile || data.profiles) warnings.push('Tệp có profile; lựa chọn trong profile hoặc Codex có thể ưu tiên hơn mặc định này.')
  if (data.plan_mode_reasoning_effort) warnings.push('Plan có mức suy luận riêng; công cụ giữ nguyên mục đó.')
  if (Object.hasOwn(data, 'model_auto_compact_token_limit')) warnings.push('Tệp có ngưỡng tự thu gọn lịch sử riêng; lịch sử có thể được thu gọn trước context đã chọn. Công cụ giữ nguyên ngưỡng này.')
  return { revision: revisionOf(bytes), values: valuesOf(data), warnings, exists: true, displayPath: canonicalPath }
}

type Operation = { from: number; to: number; text: string }
const sameKeys = (a: (string | number)[], b: string[]) => a.length === b.length && a.every((key, i) => key === b[i])
const keyParts = (key: AST.TOMLKey) => key.keys.map(part => part.type === 'TOMLBare' ? part.name : part.value)
const encode = (value: string | number) => stringify({ v: value }).slice('v = '.length).trimEnd()
function splice(source: string, operations: Operation[]): string {
  for (const op of operations.sort((a, b) => b.from - a.from)) source = source.slice(0, op.from) + op.text + source.slice(op.to)
  return source
}
function syntax(source: string) {
  // Replacing the BOM with one UTF-16 code unit keeps all AST ranges aligned.
  return parseForESLint(source.replace(/^\uFEFF/, ' '), { filePath: 'config.toml' }).ast
}
function appendLine(source: string, point: number, line: string): string {
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const prefix = point > 0 && !/[\r\n\uFEFF]/.test(source[point - 1]) ? newline : ''
  return splice(source, [{ from: point, to: point, text: `${prefix}${line}${newline}` }])
}
function lineStart(source: string, offset: number): number {
  const start = source.lastIndexOf('\n', offset - 1) + 1
  return start === 0 && source.startsWith('\uFEFF') ? 1 : start
}
function patchPath(source: string, path: string[], value: string | number | undefined): string {
  const ast = syntax(source), root = ast.body[0]
  let found: AST.TOMLKeyValue | undefined, inlineAgents: AST.TOMLInlineTable | undefined
  function visit(entry: AST.TOMLKeyValue, prefix: (string | number)[]) {
    const resolved = [...prefix, ...keyParts(entry.key)]
    if (sameKeys(resolved, path)) found = entry
    if (sameKeys(resolved, ['agents']) && entry.value.type === 'TOMLInlineTable') inlineAgents = entry.value
    if (entry.value.type === 'TOMLInlineTable') for (const child of entry.value.body) visit(child, resolved)
  }
  for (const item of root.body) {
    if (item.type === 'TOMLKeyValue') visit(item, [])
    else for (const entry of item.body) visit(entry, item.resolvedKey)
  }
  if (found) {
    if (value !== undefined) return splice(source, [{ from: found.value.range[0], to: found.value.range[1], text: encode(value) }])
    const operations: Operation[] = [{ from: found.range[0], to: found.range[1], text: '' }]
    if (found.parent.type === 'TOMLInlineTable' && found.parent.body.length > 1) {
      const siblings = found.parent.body, index = siblings.indexOf(found)
      const start = index < siblings.length - 1 ? found.range[1] : siblings[index - 1].range[1]
      const end = index < siblings.length - 1 ? siblings[index + 1].range[0] : found.range[0]
      const comma = ast.tokens.find(token => token.type === 'Punctuator' && token.value === ',' && token.range[0] >= start && token.range[1] <= end)
      if (!comma) throw new ConfigError('INVALID_CONFIG', 'Không xác định được dấu phân cách TOML an toàn; tệp chưa được sửa.')
      operations.push({ from: comma.range[0], to: comma.range[1], text: '' })
    }
    return splice(source, operations)
  }
  if (value === undefined) return source
  if (path.length === 2 && path[0] === 'agents') {
    if (inlineAgents) {
      const point = inlineAgents.range[1] - 1
      return splice(source, [{ from: point, to: point, text: `${inlineAgents.body.length ? ', ' : ''}${path[1]} = ${encode(value)}` }])
    }
    const table = root.body.find(item => item.type === 'TOMLTable' && item.kind === 'standard' && sameKeys(item.resolvedKey, ['agents']))
    if (table?.type === 'TOMLTable') {
      const lineEnd = source.indexOf('\n', table.key.range[1])
      const point = table.body[0] ? lineStart(source, table.body[0].range[0]) : (lineEnd < 0 ? source.length : lineEnd + 1)
      return appendLine(source, point, `${path[1]} = ${encode(value)}`)
    }
  }
  // Dotted root keys extend an implicit agents table without redeclaring it.
  const firstTable = root.body.find(item => item.type === 'TOMLTable')
  const point = firstTable ? lineStart(source, firstTable.range[0]) : source.length
  return appendLine(source, point, `${path.join('.')} = ${encode(value)}`)
}
export function buildPatch(bytes: Buffer, selection: PatchSelection): { bytes: Buffer; preview: ChangePreview } {
  const { source, data } = document(bytes)
  const before = valuesOf(data), after = applySelection(before, selection)
  const changes = changesBetween(before, after)
  let output = source
  try {
    for (const { key, property } of managedFields) if (before[property] !== after[property]) output = patchPath(output, key.split('.'), after[property])
    const result = Buffer.from(output)
    const actual = valuesOf(document(result).data)
    if (changesBetween(actual, after).length) throw new Error('result differs')
    return { bytes: result, preview: { before, after, changes } }
  } catch (error) {
    if (error instanceof ConfigError) throw error
    throw new ConfigError('INVALID_CONFIG', 'Cấu trúc TOML này chưa chỉnh được an toàn. Tệp chưa được sửa.')
  }
}
