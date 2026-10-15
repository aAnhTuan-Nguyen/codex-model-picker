import { z } from 'zod'
import type { ModelOption } from '../../shared/contracts'
const effort = z.string().regex(/^[a-z][a-z0-9_-]{0,40}$/)
const model = z.object({ id: z.string().optional(), model: z.string().min(1).max(200), displayName: z.string().max(300).optional(), hidden: z.boolean().optional(), supportedReasoningEfforts: z.array(z.object({ reasoningEffort: effort })).max(30), defaultReasoningEffort: effort.optional() })
export function normalizeModels(response: unknown): ModelOption[] {
  const parsed = z.object({ data: z.array(model).max(5000) }).parse(response)
  return parsed.data.filter(m => !m.hidden).map(m => {
    const efforts = [...new Set(m.supportedReasoningEfforts.map(e => e.reasoningEffort))]
    return { id: m.model, displayName: m.displayName || m.model, efforts, defaultEffort: m.defaultReasoningEffort && efforts.includes(m.defaultReasoningEffort) ? m.defaultReasoningEffort : null, source: 'cli' }
  })
}
