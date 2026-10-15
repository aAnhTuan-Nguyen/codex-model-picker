import type { ChangePreview, ConfigSnapshot, ManagedValues, ModelOption, Selection } from '../../shared/contracts'
export const effortLabel = (value: string) => ({ none: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', ultra: 'Ultra' }[value] ?? value)
export const deriveEffortSteps = (model: ModelOption) => [...new Set(model.efforts ?? [])]
export function appliedValues(snapshot: ConfigSnapshot, selection: Selection): ManagedValues {
  const after: ManagedValues = { ...snapshot.values, model: selection.model }
  if (selection.effort.kind === 'unset') delete after.modelReasoningEffort
  if (selection.effort.kind === 'set') after.modelReasoningEffort = selection.effort.value
  return after
}
export function previewOf(snapshot: ConfigSnapshot, selection: Selection): ChangePreview {
  const before = snapshot.values, after = appliedValues(snapshot, selection)
  const changes: ChangePreview['changes'] = []
  for (const [key, prop] of [['model', 'model'], ['model_reasoning_effort', 'modelReasoningEffort']] as const) {
    if (before[prop] !== after[prop]) changes.push({ key, before: before[prop], after: after[prop] })
  }
  return { before, after, changes }
}
export const isDirty = (snapshot: ConfigSnapshot, selection: Selection) => previewOf(snapshot, selection).changes.length > 0
export function deriveSelection({ snapshot, model, previous }: { snapshot: ConfigSnapshot; model: ModelOption; previous: Selection | null }): Selection {
  const base = previous?.effort ?? { kind: 'keep' as const }
  const effective = base.kind === 'set' ? base.value : base.kind === 'keep' ? snapshot.values.modelReasoningEffort : undefined
  if (base.kind === 'unset') return { model: model.id, effort: base }
  if (!effective) return { model: model.id, effort: { kind: 'keep' } }
  if (model.efforts?.includes(effective)) return { model: model.id, effort: { kind: 'set', value: effective } }
  const changed = model.id !== (previous?.model ?? snapshot.values.model)
  if (changed && model.efforts === null) return { model: model.id, effort: { kind: 'unset' } }
  if (model.defaultEffort && model.efforts?.includes(model.defaultEffort)) return { model: model.id, effort: { kind: 'set', value: model.defaultEffort } }
  if (changed && !model.efforts?.length) return { model: model.id, effort: { kind: 'unset' } }
  return { model: model.id, effort: { kind: 'keep' } }
}
export function selectionIssue(snapshot: ConfigSnapshot, model: ModelOption, selection: Selection): string | null {
  if (!selection.model || /\s|[\u0000-\u001f\u007f]/u.test(selection.model) || selection.model.length > 200) return 'Model ID cần từ 1–200 ký tự, không có khoảng trắng hoặc ký tự điều khiển.'
  if (selection.effort.kind === 'set' && !model.efforts?.includes(selection.effort.value)) return 'Chọn một mức được model hỗ trợ hoặc dùng mặc định Codex.'
  if (selection.effort.kind === 'keep' && model.efforts !== null && snapshot.values.modelReasoningEffort && !model.efforts.includes(snapshot.values.modelReasoningEffort)) return 'Mức đang lưu không thuộc danh mục này. Chọn một nấc hoặc dùng mặc định Codex.'
  return null
}
