import { useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogResult, ConfigSnapshot, EffortEdit, HistoryEntry, ModelOption, Selection } from '../../shared/contracts'
import { resolveBridge } from '../bridge'
import { deriveSelection, isDirty, previewOf, selectionIssue } from './state'
export type Notice = { tone: 'success' | 'error' | 'info'; title: string; detail?: string }
export function usePicker() {
  const { api, demo } = useMemo(resolveBridge, [])
  const [snapshot, setSnapshot] = useState<ConfigSnapshot | null>(null)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selection, setSelection] = useState<Selection>({ model: '', effort: { kind: 'keep' } })
  const [busy, setBusy] = useState(true), [catalogLoading, setCatalogLoading] = useState(false)
  const [catalog, setCatalog] = useState<CatalogResult | null>(null), [notice, setNotice] = useState<Notice | null>(null)
  const generation = useRef(0)
  const fallback = (s: ConfigSnapshot): ModelOption => ({ id: s.values.model ?? '', displayName: s.values.model ?? '', efforts: null, defaultEffort: null, source: 'current-config' })
  const report = (message: string) => setNotice({ tone: 'error', title: message })
  async function refresh() {
    const version = ++generation.current
    setBusy(true); setNotice(null); setCatalog(null)
    try {
      const read = await api.readConfig()
      if (version !== generation.current) return
      if (!read.ok) { report(read.error.message); setSnapshot(null); return }
      const s = read.data, initial = fallback(s)
      setSnapshot(s); setModels(initial.id ? [initial] : []); setSelection(deriveSelection({ snapshot: s, model: initial, previous: null }))
      setBusy(false); setCatalogLoading(true)
      const result = await api.getCatalog()
      if (version !== generation.current) return
      if (result.ok) {
        setCatalog(result.data)
        const options = [...result.data.models]
        if (initial.id && !options.some(m => m.id === initial.id)) options.unshift(initial)
        setModels(options)
        setSelection(previous => deriveSelection({ snapshot: s, model: options.find(m => m.id === previous.model) ?? { ...initial, id: previous.model, displayName: previous.model }, previous }))
      } else setCatalog({ status: 'unavailable', models: [], message: result.error.message })
    } catch { report('Không đọc được cấu hình. Hãy mở ứng dụng desktop hoặc thử tải lại.') }
    finally { if (version === generation.current) { setBusy(false); setCatalogLoading(false) } }
  }
  useEffect(() => { void refresh(); return () => { ++generation.current } }, [])
  const selectedModel = models.find(m => m.id === selection.model) ?? { id: selection.model, displayName: selection.model, efforts: null, defaultEffort: null, source: 'manual' as const }
  const preview = snapshot ? previewOf(snapshot, selection) : null
  const issue = snapshot ? selectionIssue(snapshot, selectedModel, selection) : null
  const dirty = Boolean(snapshot && isDirty(snapshot, selection))
  function selectModel(model: ModelOption) {
    if (!snapshot || busy) return
    if (!models.some(m => m.id === model.id)) setModels([...models, model])
    setSelection(previous => deriveSelection({ snapshot, model, previous })); setNotice(null)
  }
  function setEffort(effort: EffortEdit) { setSelection(previous => ({ ...previous, effort })); setNotice(null) }
  function reset() { if (snapshot) setSelection(deriveSelection({ snapshot, model: models.find(m => m.id === snapshot.values.model) ?? fallback(snapshot), previous: null })); setNotice(null) }
  async function apply() {
    if (!snapshot || busy || !dirty || issue) return
    setBusy(true); setNotice(null)
    try {
      const checked = await api.previewChange(selection)
      if (!checked.ok) { report(checked.error.message); return }
      const saved = await api.saveConfig({ expectedRevision: snapshot.revision, selection })
      if (!saved.ok) { report(saved.error.message); return }
      setSnapshot(saved.data.snapshot)
      setSelection(deriveSelection({ snapshot: saved.data.snapshot, model: selectedModel, previous: null }))
      setNotice({ tone: 'success', title: 'Đã lưu cấu hình mặc định', detail: 'Mở chat mới trong Codex và kiểm tra model. Nếu chưa nhận thay đổi, thử đóng/mở lại sau khi tác vụ hiện tại kết thúc.' })
    } catch { report('Kết nối bị gián đoạn. Tải lại để kiểm tra trạng thái thực tế trước khi lưu tiếp.') }
    finally { setBusy(false) }
  }
  async function chooseConfig() {
    if (busy) return
    const result = await api.chooseConfig()
    if (!result.ok) report(result.error.message)
    else if (result.data) await refresh()
  }
  async function chooseCli() {
    if (busy) return
    const result = await api.chooseCli()
    if (!result.ok) report(result.error.message)
    else if (result.data) await refresh()
  }
  async function openFolder() { const result = await api.openConfigFolder(); if (!result.ok) report(result.error.message) }
  async function undo(entry: HistoryEntry): Promise<{ ok: boolean; message?: string }> {
    if (!snapshot || busy) return { ok: false, message: 'Chờ thao tác hiện tại hoàn tất.' }
    setBusy(true)
    try {
      const result = await api.undoChange({ historyId: entry.id, expectedRevision: snapshot.revision })
      if (!result.ok) return { ok: false, message: result.error.message }
      const s = result.data.snapshot
      setSnapshot(s); setSelection(deriveSelection({ snapshot: s, model: models.find(m => m.id === s.values.model) ?? fallback(s), previous: null }))
      setNotice({ tone: 'success', title: 'Đã hoàn tác các mục cấu hình', detail: 'Các mục không liên quan được giữ nguyên. Kiểm tra model khi mở chat mới trong Codex.' })
      return { ok: true }
    } catch { return { ok: false, message: 'Kết nối gián đoạn. Tải lại để kiểm tra trạng thái thực tế.' } }
    finally { setBusy(false) }
  }
  return { snapshot, models, selection, selectedModel, preview, issue, dirty, busy, catalogLoading, catalog, notice, demo, refresh, selectModel, setEffort, reset, apply, chooseConfig, chooseCli, openFolder, undo, listHistory: () => api.listHistory() }
}
