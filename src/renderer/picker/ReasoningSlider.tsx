import * as Slider from '@radix-ui/react-slider'
import type { EffortEdit, ModelOption } from '../../shared/contracts'
import { deriveEffortSteps, effortLabel } from './state'
const descriptions: Record<string, string> = { low: 'Ưu tiên tốc độ cho những tác vụ đơn giản.', minimal: 'Suy luận tối thiểu cho các yêu cầu ngắn.', medium: 'Cân bằng thời gian và mức độ suy luận.', high: 'Suy luận kỹ hơn; có thể mất nhiều thời gian hơn.', xhigh: 'Dành thêm thời gian cho các bài toán khó.', ultra: 'Mức suy luận cao hơn; thời gian xử lý có thể tăng.', none: 'Không yêu cầu suy luận bổ sung.' }
export function ReasoningSlider({ model, effort, currentEffort, disabled = false, onChange }: { model: ModelOption; effort: EffortEdit; currentEffort?: string; disabled?: boolean; onChange: (effort: EffortEdit) => void }) {
  const steps = deriveEffortSteps(model)
  const inherited = effort.kind === 'unset' || (effort.kind === 'keep' && !currentEffort)
  const selected = effort.kind === 'set' ? effort.value : effort.kind === 'keep' ? currentEffort : undefined
  const index = Math.max(0, steps.indexOf(selected ?? model.defaultEffort ?? ''))
  const label = inherited ? 'Theo mặc định Codex' : selected ? effortLabel(selected) : 'Giữ nguyên'
  return <section className="reasoning-section" aria-labelledby="reasoning-label">
    <div className="field-heading"><h2 id="reasoning-label">Mức suy luận</h2><span className="effort-value">{label}</span></div>
    {steps.length > 1 ? <div className={`slider-area ${inherited ? 'inherited' : ''}`}>
      <Slider.Root className="slider" min={0} max={steps.length - 1} step={1} value={[index]} disabled={disabled} onValueChange={([n]) => onChange({ kind: 'set', value: steps[n] })}>
        <Slider.Track className="slider-track"><Slider.Range className="slider-range" />{steps.map((step, i) => <span key={step} className={`slider-tick ${i <= index ? 'passed' : ''}`} style={{ left: `${i / (steps.length - 1) * 100}%` }} />)}</Slider.Track>
        <Slider.Thumb className="slider-thumb" aria-label="Mức suy luận" aria-valuetext={label} />
      </Slider.Root>
      <div className="step-labels">{steps.map((step, i) => <button type="button" key={step} className={step === selected ? 'selected' : ''} onClick={() => onChange({ kind: 'set', value: step })} disabled={disabled} style={{ left: `${i / (steps.length - 1) * 100}%` }}>{effortLabel(step)}</button>)}</div>
    </div> : <div className="capability-note">{steps.length === 1 ? <button type="button" className="single-effort" disabled={disabled} onClick={() => onChange({ kind: 'set', value: steps[0] })}>{effortLabel(steps[0])}</button> : model.efforts === null ? 'Chưa có danh mục tương thích để điều chỉnh mức suy luận.' : 'Model không cung cấp mức suy luận tùy chỉnh.'}</div>}
    <p className="reasoning-description">{inherited ? 'Để Codex quyết định mức suy luận theo cấu hình hiệu lực.' : descriptions[selected ?? ''] ?? 'Chọn mức suy luận phù hợp với công việc của bạn.'}</p>
    <label className="inherit-option"><input type="checkbox" checked={inherited} disabled={disabled} onChange={e => { if (e.target.checked) onChange({ kind: 'unset' }); else if (model.defaultEffort && steps.includes(model.defaultEffort)) onChange({ kind: 'set', value: model.defaultEffort }) }} />Theo mặc định Codex</label>
  </section>
}
