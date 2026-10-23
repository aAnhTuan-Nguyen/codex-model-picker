import type { ChangePreview, ConfigSnapshot, EffortEdit, ManagedValues, ModelOption, Selection } from '../../shared/contracts'
import { applySelection, changesBetween } from '../../shared/values'
export const effortLabel = (value: string) => ({ none: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max', ultra: 'Ultra', persistent: 'Persistent' }[value] ?? value)
export const deriveEffortSteps = (model: ModelOption) => [...new Set(model.efforts ?? [])]
export function appliedValues(snapshot: ConfigSnapshot, selection: Selection): ManagedValues {
  return applySelection(snapshot.values, selection)
}
export function previewOf(snapshot: ConfigSnapshot, selection: Selection): ChangePreview {
  const before = snapshot.values, after = appliedValues(snapshot, selection)
  return { before, after, changes: changesBetween(before, after) }
}
export const isDirty = (snapshot: ConfigSnapshot, selection: Selection) => previewOf(snapshot, selection).changes.length > 0
function deriveReasoning(persisted: string | undefined, base: EffortEdit, model: ModelOption, changed: boolean): EffortEdit {
  const effective = base.kind === 'set' ? base.value : base.kind === 'keep' ? persisted : undefined
  if (base.kind === 'unset') return base
  if (!effective) return { kind: 'keep' }
  if (model.efforts?.includes(effective)) return { kind: 'set', value: effective }
  // Loading metadata or discarding edits must preserve the file, even if a
  // legacy effort is no longer supported. selectionIssue explains that state.
  if (!changed) return base
  if (model.efforts === null) return { kind: 'unset' }
  if (model.defaultEffort && model.efforts?.includes(model.defaultEffort)) return { kind: 'set', value: model.defaultEffort }
  if (!model.efforts?.length) return { kind: 'unset' }
  return { kind: 'keep' }
}
export function deriveSelection({ snapshot, model, previous }: { snapshot: ConfigSnapshot; model: ModelOption; previous: Selection | null }): Selection {
  return {
    ...previous,
    model: model.id,
    effort: deriveReasoning(snapshot.values.modelReasoningEffort, previous?.effort ?? { kind: 'keep' }, model, model.id !== (previous?.model ?? snapshot.values.model))
  }
}
export function deriveSubagentSelection({ snapshot, model, inheritedModel, previous }: { snapshot: ConfigSnapshot; model: ModelOption | null; inheritedModel?: ModelOption; previous: Selection }): Selection {
  const before = appliedValues(snapshot, previous)
  const selectedId = model?.id
  const effectiveModel = model ?? inheritedModel ?? { id: '', displayName: '', efforts: null, defaultEffort: null, source: 'current-config' }
  const effort = previous.subagentEffort ?? { kind: 'keep' as const }
  return {
    ...previous,
    subagentModel: selectedId ? { kind: 'set', value: selectedId } : { kind: 'unset' },
    // Clearing the model default is not a request to clear its separate effort.
    // Without inherited metadata, keep that effort until compatibility is known.
    subagentEffort: model === null && effectiveModel.efforts === null ? effort : deriveReasoning(snapshot.values.subagentReasoningEffort, effort, effectiveModel, selectedId !== before.subagentModel)
  }
}
export function resolveSubagentModel(snapshot: ConfigSnapshot, selection: Selection, mainModel: ModelOption, models: ModelOption[]): ModelOption {
  const id = appliedValues(snapshot, selection).subagentModel
  if (!id) return { ...mainModel, id: '', displayName: 'Mặc định Codex' }
  return models.find(model => model.id === id) ?? { id, displayName: id, efforts: null, defaultEffort: null, source: 'current-config' }
}
export function selectionIssue(snapshot: ConfigSnapshot, model: ModelOption, selection: Selection, subagentModel?: ModelOption): string | null {
  if (!selection.model || /\s|[\u0000-\u001f\u007f]/u.test(selection.model) || selection.model.length > 200) return 'Model ID cần từ 1–200 ký tự, không có khoảng trắng hoặc ký tự điều khiển.'
  if (selection.effort.kind === 'set' && !model.efforts?.includes(selection.effort.value)) return 'Chọn một mức được model hỗ trợ hoặc dùng mặc định Codex.'
  if (selection.effort.kind === 'keep' && model.efforts !== null && snapshot.values.modelReasoningEffort && !model.efforts.includes(snapshot.values.modelReasoningEffort)) return 'Mức đang lưu không thuộc danh mục này. Chọn một nấc hoặc dùng mặc định Codex.'
  const after = appliedValues(snapshot, selection)
  if (after.modelContextWindow !== undefined && (!Number.isSafeInteger(after.modelContextWindow) || after.modelContextWindow <= 0)) return 'Context window cần là số nguyên token dương trong phạm vi an toàn.'
  if (after.subagentModel && (/\s|[\u0000-\u001f\u007f]/u.test(after.subagentModel) || after.subagentModel.length > 200)) return 'Model ID subagent cần từ 1–200 ký tự, không có khoảng trắng hoặc ký tự điều khiển.'
  const effectiveSubagent = subagentModel ?? (!after.subagentModel || after.subagentModel === model.id ? model : undefined)
  const effort = selection.subagentEffort ?? { kind: 'keep' }
  if (effort.kind === 'set' && !effectiveSubagent?.efforts?.includes(effort.value)) return 'Chọn mức suy luận được model subagent hỗ trợ hoặc dùng mặc định Codex.'
  if (effort.kind === 'keep' && effectiveSubagent?.efforts !== null && effectiveSubagent?.efforts && after.subagentReasoningEffort && !effectiveSubagent.efforts.includes(after.subagentReasoningEffort)) return 'Mức đang lưu không thuộc model subagent này. Chọn một nấc hoặc dùng mặc định Codex.'
  return null
}
