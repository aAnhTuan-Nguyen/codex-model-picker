import { useId, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { ModelOption } from '../../shared/contracts'

type Props = {
  models: ModelOption[]; selected: ModelOption; loading: boolean; disabled: boolean
  onSelect: (model: ModelOption) => void
  accessibleLabel?: string; searchLabel?: string; onDefault?: () => void
}
export function ModelPicker({ models, selected, loading, disabled, onSelect, accessibleLabel = 'Model chính', searchLabel = 'Tìm model', onDefault }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const visible = models.filter(m => `${m.id} ${m.displayName}`.toLowerCase().includes(query.toLowerCase()))
  const manual = query.trim(), canUseManual = manual.length > 0 && manual.length <= 200 && !/\s|[\u0000-\u001f\u007f]/u.test(manual) && !models.some(m => m.id === manual)
  const close = () => { setOpen(false); setQuery('') }
  const select = (model: ModelOption) => { onSelect(model); close() }
  return <div className="model-section">
    <div className="model-label"><span>Model</span><small>{loading ? 'Đang đọc danh mục…' : !selected.id && onDefault ? 'Để Codex quyết định' : selected.source === 'cli' ? 'Danh mục CLI' : 'Chưa xác minh'}</small></div>
    <Popover.Root open={open} onOpenChange={value => { setOpen(value); if (!value) setQuery('') }}>
      <Popover.Trigger asChild><button type="button" className="model-trigger" role="combobox" aria-label={accessibleLabel} aria-expanded={open} aria-controls={`${id}-options`} disabled={disabled}><span className="model-name">{selected.displayName || 'Tìm hoặc nhập model ID'}</span><ChevronDown size={18}/></button></Popover.Trigger>
      <Popover.Portal><Popover.Content className="model-popover" sideOffset={8} align="start" collisionPadding={16}>
        <div className="model-search"><Search size={16}/><input aria-label={searchLabel} placeholder="Tìm model hoặc nhập model ID…" value={query} onChange={e => setQuery(e.target.value)} maxLength={200}/></div>
        <div id={`${id}-options`} role="listbox" aria-label={onDefault ? 'Danh sách model subagent' : 'Danh sách model'} className="model-options">
          {onDefault ? <button type="button" role="option" aria-selected={!selected.id} onClick={() => { onDefault(); close() }}><span><strong>Mặc định Codex</strong><small>Không đặt model riêng cho subagent</small></span>{!selected.id ? <Check size={17}/> : null}</button> : null}
          {visible.map(model => <button type="button" role="option" aria-selected={model.id === selected.id} key={model.id} onClick={() => select(model)}><span><strong>{model.displayName}</strong><small>{model.id}{model.source !== 'cli' ? ' · Chưa xác minh' : ''}</small></span>{model.id === selected.id ? <Check size={17}/> : null}</button>)}
          {canUseManual ? <button type="button" role="option" aria-selected={false} onClick={() => select({ id: manual, displayName: manual, efforts: null, defaultEffort: null, source: 'manual' })}><span><strong>Dùng “{manual}”</strong><small>Model ID thủ công · Chưa xác minh</small></span></button> : null}
          {!visible.length && !canUseManual ? <p className="empty-inline">Không có kết quả. Nhập model ID không có khoảng trắng.</p> : null}
        </div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  </div>
}
