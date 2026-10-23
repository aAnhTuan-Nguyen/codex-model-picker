import { useId } from 'react'
import { ArrowRight, FileText } from 'lucide-react'
import type { ChangePreview as Preview, ManagedKey } from '../../shared/contracts'
import { managedFields } from '../../shared/values'
import { effortLabel } from './state'
export function formatConfigValue(key: ManagedKey, value: string | number | undefined) {
  if (value === undefined) return 'Mặc định Codex'
  if (key === 'model_context_window' && typeof value === 'number') return value % 1000 === 0 && value < 1000000 ? `${value / 1000}K` : `${value.toLocaleString('vi-VN')} token`
  return key.endsWith('reasoning_effort') ? effortLabel(String(value)) : String(value)
}
export function ChangePreview({ preview, creating = false }: { preview: Preview; creating?: boolean }) {
  const id = useId()
  return <section className="change-preview" aria-labelledby={id}><div className="preview-heading"><h2 id={id}><FileText size={19}/>Thay đổi dự kiến</h2><span>{creating ? 'Sẽ tạo tệp' : preview.changes.length ? `${preview.changes.length} mục` : 'Chưa có thay đổi'}</span></div>
    {preview.changes.length ? preview.changes.map(change => <div className="preview-row changed" key={change.key}><span>{managedFields.find(f => f.key === change.key)?.label ?? change.key}</span><span className="old-value">{formatConfigValue(change.key, change.before)}</span><ArrowRight size={15}/><span className="new-value">{formatConfigValue(change.key, change.after)}</span></div>) : <p className="preview-empty">Chọn mặc định theo cách bạn làm việc. Mọi thay đổi sẽ hiện ở đây.</p>}
  </section>
}
