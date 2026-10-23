import { useId } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { RotateCcw, Zap } from 'lucide-react'
import type { EffortEdit, ModelOption } from '../../shared/contracts'
import { deriveEffortSteps, effortLabel } from './state'
const descriptions: Record<string, string> = { low: 'Ưu tiên tốc độ cho những tác vụ đơn giản.', minimal: 'Suy luận tối thiểu cho các yêu cầu ngắn.', medium: 'Cân bằng thời gian và mức độ suy luận.', high: 'Suy luận kỹ hơn; có thể mất nhiều thời gian hơn.', xhigh: 'Dành thêm thời gian cho các bài toán khó.', max: 'Codex áp dụng mức Max được model hỗ trợ.', ultra: 'Codex áp dụng mức suy luận theo model và chế độ đa agent.', persistent: 'Codex áp dụng chế độ suy luận do model quy định.', none: 'Không yêu cầu suy luận bổ sung.' }
export function ReasoningSlider({ model, effort, currentEffort, disabled = false, onChange, accessibleLabel = 'Mức suy luận' }: { model: ModelOption; effort: EffortEdit; currentEffort?: string; disabled?: boolean; onChange: (effort: EffortEdit) => void; accessibleLabel?: string }) {
  const id = useId()
  const steps = deriveEffortSteps(model)
  const inherited = effort.kind === 'unset' || (effort.kind === 'keep' && !currentEffort)
  const selected = effort.kind === 'set' ? effort.value : effort.kind === 'keep' ? currentEffort : undefined
  const index = Math.max(0, steps.indexOf(selected ?? model.defaultEffort ?? ''))
  const label = inherited ? 'Theo mặc định Codex' : selected ? effortLabel(selected) : 'Giữ nguyên'
  return <section className="reasoning-section" aria-labelledby={id}>
    <h3 id={id} className="sr-only">{accessibleLabel}</h3>
    <div className={`reasoning-control ${inherited ? 'inherited' : ''}`}>
      <div className="reasoning-top"><Zap className="reasoning-bolt" size={19} fill="currentColor" strokeWidth={1.8}/><div className="reasoning-selection"><strong>{label}</strong><small>{model.displayName || 'Model chưa xác minh'}</small></div><button className="reasoning-reset" type="button" aria-label={`${accessibleLabel}: Theo mặc định Codex`} title="Theo mặc định Codex" aria-pressed={inherited} disabled={disabled} onClick={() => onChange({ kind: 'unset' })}><RotateCcw size={17}/></button></div>
      {steps.length > 1 ? <div className="slider-area">
        <Slider.Root className="slider" min={0} max={steps.length - 1} step={1} value={[index]} disabled={disabled} onValueChange={([n]) => onChange({ kind: 'set', value: steps[n] })}>
          <Slider.Track className="slider-track"><Slider.Range className="slider-range"/></Slider.Track>
          <Slider.Thumb className="slider-thumb" aria-label={accessibleLabel} aria-valuetext={label} aria-describedby={`${id}-description`}/>
        </Slider.Root>
        <div className="step-labels">{steps.map((step, i) => <button type="button" key={step} className={step === selected ? 'selected' : ''} onClick={() => onChange({ kind: 'set', value: step })} disabled={disabled} style={{ left: `${i / (steps.length - 1) * 100}%` }}>{effortLabel(step)}</button>)}</div>
      </div> : <div className="capability-note">{steps.length === 1 ? <button type="button" className="single-effort" disabled={disabled} onClick={() => onChange({ kind: 'set', value: steps[0] })}>{effortLabel(steps[0])}</button> : model.efforts === null ? 'Chưa có danh mục tương thích để điều chỉnh mức suy luận.' : 'Model không cung cấp mức suy luận tùy chỉnh.'}</div>}
    </div>
    <p id={`${id}-description`} className="reasoning-description">{inherited ? 'Để Codex quyết định theo cấu hình hiệu lực.' : descriptions[selected ?? ''] ?? 'Chọn mức suy luận phù hợp với công việc của bạn.'} Chỉ hiện các mức model hỗ trợ.</p>
  </section>
}
