import { useId } from 'react'
import type { ValueEdit } from '../../shared/contracts'
const presets = [272000, 500000, 872000]
export function ContextWindow({ currentValue, edit, disabled, onChange }: { currentValue?: number; edit?: ValueEdit<number>; disabled: boolean; onChange: (edit: ValueEdit<number>) => void }) {
  const id = useId()
  const value = edit?.kind === 'set' ? edit.value : edit?.kind === 'unset' ? undefined : currentValue
  return <fieldset className="context-section" aria-describedby={`${id}-hint`} disabled={disabled}>
    <legend>Context window</legend>
    <div className="context-options">{[undefined, ...presets].map(preset => <label className={`context-option ${value === preset ? 'selected' : ''}`} key={preset ?? 'default'}><input name={id} type="radio" value={preset ?? 'default'} checked={value === preset} onChange={() => onChange(preset === undefined ? { kind: 'unset' } : { kind: 'set', value: preset })}/><span>{preset === undefined ? 'Mặc định' : `${preset / 1000}K`}</span></label>)}</div>
    {value !== undefined && !presets.includes(value) ? <p className="custom-context">Trong tệp: {value.toLocaleString('vi-VN')} token · Tùy chỉnh, đang giữ nguyên.</p> : null}
    <p id={`${id}-hint`} className="context-hint">Dung lượng thực tế phụ thuộc model và dịch vụ.</p>
  </fieldset>
}
