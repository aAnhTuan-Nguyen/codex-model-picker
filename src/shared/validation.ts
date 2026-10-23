import { z } from 'zod'
const modelId = z.string().min(1).max(200).regex(/^[^\s\u0000-\u001f\u007f]+$/u)
export const effortSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('keep') }).strict(), z.object({ kind: z.literal('unset') }).strict(), z.object({ kind: z.literal('set'), value: z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/) }).strict()])
const editSchema = <T extends z.ZodType>(value: T) => z.discriminatedUnion('kind', [z.object({ kind: z.literal('keep') }).strict(), z.object({ kind: z.literal('unset') }).strict(), z.object({ kind: z.literal('set'), value }).strict()])
export const selectionSchema = z.object({ model: modelId, effort: effortSchema, contextWindow: editSchema(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).optional(), subagentModel: editSchema(modelId).optional(), subagentEffort: effortSchema.optional() }).strict()
export const saveSchema = z.object({ expectedRevision: z.string().min(1).max(64), selection: selectionSchema }).strict()
export const undoSchema = z.object({ historyId: z.string().uuid(), expectedRevision: z.string().min(1).max(64) }).strict()
