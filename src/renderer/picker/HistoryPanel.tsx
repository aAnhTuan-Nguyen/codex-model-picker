import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { History, RotateCcw, X } from 'lucide-react'
import type { ChangePreview as Preview, HistoryEntry, ManagedValues, Result } from '../../shared/contracts'
import { ChangePreview, formatConfigValue } from './ChangePreview'
import { changesBetween, managedFields } from '../../shared/values'
export function HistoryPanel({ busy, values, load, undo, reload }: { busy: boolean; values: ManagedValues; load: () => Promise<Result<HistoryEntry[]>>; undo: (entry: HistoryEntry) => Promise<{ ok: boolean; message?: string }>; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false), [entries, setEntries] = useState<HistoryEntry[]>([]), [selected, setSelected] = useState<HistoryEntry | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  async function opened(value: boolean) {
    if (busy) return
    setOpen(value); setSelected(null); setError('')
    if (value) {
      setLoading(true)
      try { const result = await load(); if (result.ok) setEntries(result.data); else setError(result.error.message) }
      catch { setError('Không đọc được lịch sử. Thử tải lại cấu hình.') }
      finally { setLoading(false) }
    }
  }
  let preview: Preview | null = null
  if (selected) {
    const after = { ...values }, changes: Preview['changes'] = []
    for (const { key, property: prop } of managedFields) {
      if (selected.before[prop] === selected.after[prop]) continue
      if (selected.before[prop] === undefined) delete after[prop]; else Object.assign(after, { [prop]: selected.before[prop] })
      changes.push({ key, before: values[prop], after: after[prop] })
    }
    preview = { before: values, after, changes }
  }
  return <Dialog.Root open={open} onOpenChange={value => void opened(value)}><Dialog.Trigger asChild><button className="footer-link" disabled={busy}><History size={16}/>Lịch sử / Hoàn tác</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content history-dialog" onEscapeKeyDown={e => { if (busy) e.preventDefault() }} onPointerDownOutside={e => { if (busy) e.preventDefault() }}>
    <div className="dialog-heading"><Dialog.Title>{selected ? 'Xác nhận hoàn tác' : 'Lịch sử thay đổi'}</Dialog.Title><Dialog.Close className="icon-button" disabled={busy} aria-label="Đóng"><X size={18}/></Dialog.Close></div>
    <Dialog.Description>{selected ? 'Chỉ hoàn tác các mục lần lưu này đã đổi. Dừng thao tác nếu chính các mục đó đã được sửa tiếp.' : 'Các lần lưu của công cụ cho tệp đang chọn. Bản sao lưu không được hiển thị tại đây.'}</Dialog.Description>
    {error ? <div className="notice error" role="alert"><strong>{error}</strong><button className="text-button" onClick={async () => { await reload(); setOpen(false) }}>Tải lại</button></div> : null}
    {selected && preview ? <><ChangePreview preview={preview}/><div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={() => { setSelected(null); setError('') }}>Quay lại</button><button className="button primary" disabled={busy} onClick={async () => { const result = await undo(selected); if (result.ok) setOpen(false); else setError(result.message ?? 'Không hoàn tác được.') }}><RotateCcw size={15}/>Xác nhận hoàn tác</button></div></> : loading ? <p className="empty-inline">Đang đọc lịch sử…</p> : entries.length ? <ul className="history-list">{entries.map(entry => <li key={entry.id}><div><strong>{new Date(entry.createdAt).toLocaleString('vi-VN')}</strong><p>{changesBetween(entry.before, entry.after).map(change => `${managedFields.find(field => field.key === change.key)?.label}: ${formatConfigValue(change.key, change.before)} → ${formatConfigValue(change.key, change.after)}`).join(' · ')}</p></div><button className="button secondary" onClick={() => setSelected(entry)}>Hoàn tác</button></li>)}</ul> : <div className="history-empty"><History size={28}/><h3>Chưa có thay đổi nào</h3><p>Các lần lưu thành công sẽ xuất hiện ở đây.</p></div>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
