import type { ChangePreview, ManagedKey, ManagedValues, Selection, ValueEdit } from './contracts'

export const managedFields = [
  { key: 'model', property: 'model', label: 'Model chính' },
  { key: 'model_reasoning_effort', property: 'modelReasoningEffort', label: 'Reasoning chính' },
  { key: 'model_context_window', property: 'modelContextWindow', label: 'Context window' },
  { key: 'agents.default_subagent_model', property: 'subagentModel', label: 'Model subagent' },
  { key: 'agents.default_subagent_reasoning_effort', property: 'subagentReasoningEffort', label: 'Reasoning subagent' }
] as const satisfies readonly { key: ManagedKey; property: keyof ManagedValues; label: string }[]

export type PatchSelection = Omit<Selection, 'model'> & { model?: string }
function edit<T>(before: T | undefined, change?: ValueEdit<T>): T | undefined {
  return change?.kind === 'unset' ? undefined : change?.kind === 'set' ? change.value : before
}
export function applySelection(before: ManagedValues, selection: PatchSelection): ManagedValues {
  const values: ManagedValues = {
    ...before, model: selection.model,
    modelReasoningEffort: edit(before.modelReasoningEffort, selection.effort),
    modelContextWindow: edit(before.modelContextWindow, selection.contextWindow),
    subagentModel: edit(before.subagentModel, selection.subagentModel),
    subagentReasoningEffort: edit(before.subagentReasoningEffort, selection.subagentEffort)
  }
  for (const { property } of managedFields) if (values[property] === undefined) delete values[property]
  return values
}
export function changesBetween(before: ManagedValues, after: ManagedValues): ChangePreview['changes'] {
  return managedFields.flatMap(({ key, property }) => before[property] === after[property] ? [] : [{ key, before: before[property], after: after[property] }])
}
