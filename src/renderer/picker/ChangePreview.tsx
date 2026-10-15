import { ArrowRight } from 'lucide-react'
import type { ChangePreview as Preview } from '../../shared/contracts'
import { effortLabel } from './state'
export function ChangePreview({ preview, creating = false }: { preview: Preview; creating?: boolean }) {
  const rows = [['Model', preview.before.model, preview.after.model, 'model'], ['Mức suy luận', preview.before.modelReasoningEffort, preview.after.modelReasoningEffort, 'model_reasoning_effort']] as const
  return <section className="change-preview" aria-labelledby="preview-title"><div className="preview-heading"><h2 id="preview-title">Xem trước thay đổi</h2><span>{creating ? 'Sẽ tạo tệp cấu hình' : preview.changes.length ? `${preview.changes.length} mục thay đổi` : 'Chưa có thay đổi'}</span></div>
    {rows.map(([label, before, after, key]) => <div className={`preview-row ${preview.changes.some(c => c.key === key) ? 'changed' : ''}`} key={key}><span>{label}</span><span className="old-value">{before === undefined ? 'Mặc định Codex' : key === 'model' ? before : effortLabel(before)}</span><ArrowRight size={15}/><span className="new-value">{after === undefined ? 'Mặc định Codex' : key === 'model' ? after : effortLabel(after)}</span></div>)}
  </section>
}
