import { ArrowRight, Bot, CheckCircle2, Code2, Info, LoaderCircle, RefreshCw, Users } from 'lucide-react'
import { usePicker } from './picker/usePicker'
import { ModelPicker } from './picker/ModelPicker'
import { ReasoningSlider } from './picker/ReasoningSlider'
import { ContextWindow } from './picker/ContextWindow'
import { ChangePreview } from './picker/ChangePreview'
import { ConfigPanel } from './picker/ConfigPanel'
import { HistoryPanel } from './picker/HistoryPanel'
import './styles/tokens.css'
import './styles/app.css'
export default function App() {
  const p = usePicker()
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><div className="brand-icon"><Code2 size={28} strokeWidth={1.8}/></div><div><h1>Codex Model Picker</h1><p>Một nơi cho mọi mặc định của bạn.</p></div></div><div className="header-tools"><button className="icon-button" aria-label="Tải lại" title="Đọc lại cấu hình và danh mục" disabled={p.busy || p.catalogLoading} onClick={() => void p.refresh()}><RefreshCw size={20} className={p.catalogLoading ? 'spin' : ''}/></button>{p.demo ? <span className="dev-label">DEV · minh họa</span> : null}</div></header>
    <main className="workspace">
      {p.notice ? <div className={`notice ${p.notice.tone}`} role={p.notice.tone === 'error' ? 'alert' : 'status'}>{p.notice.tone === 'success' ? <CheckCircle2 size={18}/> : <Info size={18}/>}<div><strong>{p.notice.title}</strong>{p.notice.detail ? <p>{p.notice.detail}</p> : null}</div></div> : null}
      {p.snapshot ? <>
        <section className="settings-panel main-panel" aria-labelledby="main-heading"><div className="section-heading"><span className="section-icon"><Bot size={22} strokeWidth={1.8}/></span><h2 id="main-heading">Agent chính</h2></div>
          <ModelPicker models={p.models} selected={p.selectedModel} loading={p.catalogLoading} disabled={p.busy} onSelect={p.selectModel}/>
          <ReasoningSlider model={p.selectedModel} effort={p.selection.effort} currentEffort={p.snapshot.values.modelReasoningEffort} disabled={p.busy} onChange={p.setEffort}/>
          <ContextWindow currentValue={p.snapshot.values.modelContextWindow} edit={p.selection.contextWindow} disabled={p.busy} onChange={p.setContextWindow}/>
        </section>
        <section className="settings-panel subagent-panel" aria-labelledby="subagent-heading"><div className="section-heading"><span className="section-icon"><Users size={22} strokeWidth={1.8}/></span><div><h2 id="subagent-heading">Subagent</h2><p>Một bộ mặc định chung cho agent phụ mới.</p></div></div>
          <ModelPicker models={p.models} selected={p.selectedSubagentModel} loading={p.catalogLoading} disabled={p.busy} onSelect={p.selectSubagentModel} onDefault={() => p.selectSubagentModel(null)} accessibleLabel="Model subagent" searchLabel="Tìm model subagent"/>
          <ReasoningSlider model={p.selectedSubagentModel} effort={p.selection.subagentEffort ?? { kind: 'keep' }} currentEffort={p.snapshot.values.subagentReasoningEffort} disabled={p.busy} onChange={p.setSubagentEffort} accessibleLabel="Mức suy luận subagent"/>
          <details className="subagent-details"><summary>Khi nào mặc định này được dùng?</summary><p>Dùng khi Codex tạo subagent mà không chọn cấu hình riêng. Vai trò hoặc lựa chọn lúc tạo agent có thể ưu tiên hơn. Cần phiên bản Codex hỗ trợ các mặc định này.</p></details>
        </section>
        {p.preview ? <ChangePreview preview={p.preview} creating={!p.snapshot.exists}/> : null}
        {p.issue ? <p className="validation-message" role="alert">{p.issue}</p> : null}
        {p.snapshot.warnings.map(w => <p className="inline-warning" key={w}><Info size={15}/>{w}</p>)}
      </> : <div className="initial-state"><Code2 size={32}/><h2>{p.busy ? 'Đang đọc cấu hình…' : 'Chưa đọc được cấu hình'}</h2><p>{p.busy ? 'Chưa có thay đổi nào được ghi.' : 'Kiểm tra tệp TOML hoặc chọn tệp khác trong “Vị trí cấu hình”.'}</p></div>}
    </main>
    <div className="save-area"><p className="save-hint"><Info size={16}/><span>Lưu mặc định, sau đó mở chat mới trong Codex.</span></p><div className="save-actions"><button type="button" className="button secondary" disabled={p.busy || !p.dirty} onClick={p.reset}>Bỏ thay đổi</button><button type="button" className="button primary" disabled={p.busy || !p.dirty || Boolean(p.issue)} onClick={() => void p.apply()}>{p.busy && p.snapshot ? <LoaderCircle size={16} className="spin"/> : null}Lưu mặc định<ArrowRight size={17}/></button></div></div>
    <footer className="app-footer"><ConfigPanel snapshot={p.snapshot} catalog={p.catalog} busy={p.busy} chooseConfig={() => void p.chooseConfig()} chooseCli={() => void p.chooseCli()} openFolder={() => void p.openFolder()}/><HistoryPanel busy={p.busy} values={p.snapshot?.values ?? {}} load={p.listHistory} undo={p.undo} reload={p.refresh}/></footer>
  </div>
}
