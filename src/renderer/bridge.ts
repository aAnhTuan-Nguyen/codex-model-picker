import type { PickerBridge } from '../shared/contracts'
import { createDemoBridge } from './demo'
export function resolveBridge(): { api: PickerBridge; demo: boolean } {
  if (window.modelPicker) return { api: window.modelPicker, demo: false }
  if (import.meta.env.DEV) return { api: createDemoBridge(), demo: true }
  const unavailable = async () => ({ ok: false as const, error: { code: 'IO_ERROR' as const, message: 'Hãy mở ứng dụng desktop để sử dụng cấu hình thật.' } })
  return { demo: false, api: { readConfig: unavailable, chooseConfig: unavailable, chooseCli: unavailable, getCatalog: unavailable, previewChange: unavailable, saveConfig: unavailable, listHistory: unavailable, undoChange: unavailable, openConfigFolder: unavailable } }
}
