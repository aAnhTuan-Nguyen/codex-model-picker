import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { HistoryEntry } from '../../shared/contracts'
const legacyValues = z.object({ model: z.string().optional(), modelReasoningEffort: z.string().optional() }).strict()
const values = legacyValues.extend({ modelContextWindow: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(), subagentModel: z.string().optional(), subagentReasoningEffort: z.string().optional() }).strict()
const base = z.object({ id: z.string().uuid(), createdAt: z.string(), displayPath: z.string(), state: z.enum(['prepared', 'applied']), beforeRevision: z.string(), afterRevision: z.string() }).strict()
export const recordSchema = z.discriminatedUnion('version', [
  base.extend({ version: z.literal(1), before: legacyValues, after: legacyValues }).strict(),
  base.extend({ version: z.literal(2), before: values, after: values }).strict()
])
export type HistoryRecord = z.infer<typeof recordSchema>
export function publicEntry(record: HistoryRecord): HistoryEntry {
  const { id, createdAt, displayPath, before, after } = record
  return { id, createdAt, displayPath, before, after }
}
export async function durableWrite(file: string, data: string | Buffer, exclusive = true): Promise<void> {
  const handle = await fs.open(file, exclusive ? 'wx' : 'w', 0o600)
  try { await handle.writeFile(data); await handle.sync() } finally { await handle.close() }
}
export async function readRecord(directory: string, id: string): Promise<HistoryRecord> {
  z.string().uuid().parse(id)
  const record = recordSchema.parse(JSON.parse(await fs.readFile(path.join(directory, `${id}.json`), 'utf8')))
  if (record.id !== id) throw new Error('History ID mismatch')
  return record
}
