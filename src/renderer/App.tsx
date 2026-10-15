import { CheckCircle2, Code2, Info, LoaderCircle, RefreshCw } from 'lucide-react'
import { usePicker } from './picker/usePicker'
import { ModelPicker } from './picker/ModelPicker'
import { ReasoningSlider } from './picker/ReasoningSlider'
import { ChangePreview } from './picker/ChangePreview'
import { ConfigPanel } from './picker/ConfigPanel'
import { HistoryPanel } from './picker/HistoryPanel'
import { effortLabel } from './picker/state'
import './styles/tokens.css'
import './styles/app.css'
export default function App() {
  const p = usePicker()
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><div className="brand-icon"><Code2 size={25} strokeWidth={1.8}/></div><div><h1>Codex Model Picker</h1><p>Cấu hình mặc định</p></div></div><div className="header-tools">{p.demo ? <span className="dev-label">DEV · dữ liệu minh họa</span> : null}<button className="icon-button" aria-label="Tải lại" title="Đọc lại cấu hình và danh mục" disabled={p.busy || p.catalogLoading} onClick={() => void p.refresh()}><RefreshCw size={17} className={p.catalogLoading ? 'spin' : ''}/></button></div></header>
    <div className="current-bar"><span className="saved-label"><span className={`status-dot ${p.snapshot ? '' : 'muted'}`}/>{p.snapshot?.exists ? 'Trong tệp' : 'Chưa có cấu hình'}</span><span className="current-model" title={p.snapshot?.values.model}>{p.snapshot?.values.model ?? 'Mặc định Codex'}</span><span className="current-effort">{p.snapshot?.values.modelReasoningEffort ? effortLabel(p.snapshot.values.modelReasoningEffort) : 'Theo mặc định'}</span></div>
    <main className="workspace">
      {p.notice ? <div className={`notice ${p.notice.tone}`} role={p.notice.tone === 'error' ? 'alert' : 'status'}>{p.notice.tone === 'success' ? <CheckCircle2 size={18}/> : <Info size={18}/>}<div><strong>{p.notice.title}</strong>{p.notice.detail ? <p>{p.notice.detail}</p> : null}</div></div> : null}
      {p.snapshot ? <><ModelPicker models={p.models} selected={p.selectedModel} loading={p.catalogLoading} disabled={p.busy} onSelect={p.selectModel}/><ReasoningSlider model={p.selectedModel} effort={p.selection.effort} currentEffort={p.snapshot.values.modelReasoningEffort} disabled={p.busy} onChange={p.setEffort}/>{p.preview ? <ChangePreview preview={p.preview} creating={!p.snapshot.exists}/> : null}{p.issue ? <p className="validation-message" role="alert">{p.issue}</p> : null}{p.snapshot.warnings.map(w => <p className="inline-warning" key={w}><Info size={15}/>{w}</p>)}</> : <div className="initial-state"><Code2 size={32}/><h2>{p.busy ? 'Đang đọc cấu hình…' : 'Chưa đọc được cấu hình'}</h2><p>{p.busy ? 'Chưa có thay đổi nào được ghi.' : 'Kiểm tra tệp TOML hoặc chọn tệp khác trong “Vị trí cấu hình”.'}</p></div>}
    </main>
    <div className="save-area"><p className="save-hint"><Info size={16}/><span>Thay đổi mặc định; chưa đổi chat đang mở.</span></p><div className="save-actions"><button type="button" className="button secondary" disabled={p.busy || !p.dirty} onClick={p.reset}>Bỏ thay đổi</button><button type="button" className="button primary" disabled={p.busy || !p.dirty || Boolean(p.issue)} onClick={() => void p.apply()}>{p.busy && p.snapshot ? <LoaderCircle size={16} className="spin"/> : null}Lưu mặc định</button></div></div>
    <footer className="app-footer"><ConfigPanel snapshot={p.snapshot} catalog={p.catalog} busy={p.busy} chooseConfig={() => void p.chooseConfig()} chooseCli={() => void p.chooseCli()} openFolder={() => void p.openFolder()}/><HistoryPanel busy={p.busy} values={p.snapshot?.values ?? {}} load={p.listHistory} undo={p.undo} reload={p.refresh}/></footer>
  </div>
}
