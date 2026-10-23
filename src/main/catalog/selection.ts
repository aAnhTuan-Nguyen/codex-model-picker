import type { CatalogResult, ManagedValues, Selection } from '../../shared/contracts'
import { applySelection } from '../../shared/values'
import { ConfigError } from '../config/toml'

export function assertSupportedEfforts(selection: Selection, currentValues: ManagedValues, catalog: CatalogResult | null): void {
  const after = applySelection(currentValues, selection)
  const models = catalog?.status === 'available' ? catalog.models : []
  for (const { edit, modelId, label } of [
    { edit: selection.effort, modelId: after.model, label: 'model' },
    { edit: selection.subagentEffort, modelId: after.subagentModel ?? after.model, label: 'model subagent' }
  ]) {
    // Kept legacy values and removals need no new capability assertion.
    if (edit?.kind !== 'set') continue
    const model = models.find(item => item.id === modelId)
    if (!model?.efforts?.includes(edit.value)) throw new ConfigError('INVALID_SELECTION', `Chưa xác minh mức suy luận này cho ${label}. Tải lại danh mục hoặc dùng mặc định Codex.`)
  }
}
