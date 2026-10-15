import { z } from 'zod'
const modelId = z.string().min(1).max(200).regex(/^[^\s\u0000-\u001f\u007f]+$/u)
export const effortSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('keep') }).strict(), z.object({ kind: z.literal('unset') }).strict(), z.object({ kind: z.literal('set'), value: z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/) }).strict()])
export const selectionSchema = z.object({ model: modelId, effort: effortSchema }).strict()
export const saveSchema = z.object({ expectedRevision: z.string().min(1).max(64), selection: selectionSchema }).strict()
export const undoSchema = z.object({ historyId: z.string().uuid(), expectedRevision: z.string().min(1).max(64) }).strict()
