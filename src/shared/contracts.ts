export type ManagedValues = { model?: string; modelReasoningEffort?: string; modelContextWindow?: number; subagentModel?: string; subagentReasoningEffort?: string }
export type ValueEdit<T> = { kind: 'keep' } | { kind: 'set'; value: T } | { kind: 'unset' }
export type EffortEdit = ValueEdit<string>
export type Selection = { model: string; effort: EffortEdit; contextWindow?: ValueEdit<number>; subagentModel?: ValueEdit<string>; subagentEffort?: EffortEdit }
export type ManagedKey = 'model' | 'model_reasoning_effort' | 'model_context_window' | 'agents.default_subagent_model' | 'agents.default_subagent_reasoning_effort'
export type ConfigSnapshot = { revision: string; values: ManagedValues; warnings: string[]; exists: boolean; displayPath: string }
export type ChangePreview = { before: ManagedValues; after: ManagedValues; changes: { key: ManagedKey; before?: string | number; after?: string | number }[] }
export type SaveResult = { snapshot: ConfigSnapshot; historyId: string }
export type HistoryEntry = { id: string; createdAt: string; displayPath: string; before: ManagedValues; after: ManagedValues }
export type ModelOption = { id: string; displayName: string; efforts: string[] | null; defaultEffort: string | null; source: 'cli' | 'current-config' | 'manual' }
export type CatalogResult = { status: 'available' | 'unavailable'; models: ModelOption[]; message?: string }
export type AppError = { code: 'INVALID_CONFIG' | 'CONFLICT' | 'UNSAFE_PATH' | 'IO_ERROR' | 'INVALID_SELECTION'; message: string }
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
export interface PickerBridge {
  readConfig(): Promise<Result<ConfigSnapshot>>
  chooseConfig(): Promise<Result<ConfigSnapshot | null>>
  chooseCli(): Promise<Result<boolean>>
  getCatalog(): Promise<Result<CatalogResult>>
  previewChange(selection: Selection): Promise<Result<ChangePreview>>
  saveConfig(input: { expectedRevision: string; selection: Selection }): Promise<Result<SaveResult>>
  listHistory(): Promise<Result<HistoryEntry[]>>
  undoChange(input: { historyId: string; expectedRevision: string }): Promise<Result<SaveResult>>
  openConfigFolder(): Promise<Result<void>>
}
export function createBridge(invoke: (channel: string, payload?: unknown) => Promise<unknown>): PickerBridge {
  return Object.freeze({
    readConfig: () => invoke('picker:read'), chooseConfig: () => invoke('picker:choose'), chooseCli: () => invoke('picker:choose-cli'),
    getCatalog: () => invoke('picker:catalog'), previewChange: (s: Selection) => invoke('picker:preview', s),
    saveConfig: (s: Parameters<PickerBridge['saveConfig']>[0]) => invoke('picker:save', s),
    listHistory: () => invoke('picker:history'), undoChange: (s: Parameters<PickerBridge['undoChange']>[0]) => invoke('picker:undo', s),
    openConfigFolder: () => invoke('picker:folder')
  }) as PickerBridge
}
declare global { interface Window { modelPicker?: PickerBridge } }
