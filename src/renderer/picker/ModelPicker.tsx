import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { ModelOption } from '../../shared/contracts'
export function ModelPicker({ models, selected, loading, disabled, onSelect }: { models: ModelOption[]; selected: ModelOption; loading: boolean; disabled: boolean; onSelect: (model: ModelOption) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const visible = models.filter(m => `${m.id} ${m.displayName}`.toLowerCase().includes(query.toLowerCase()))
  const manual = query.trim(), canUseManual = manual.length > 0 && manual.length <= 200 && !/\s|[\u0000-\u001f\u007f]/u.test(manual) && !models.some(m => m.id === manual)
  const select = (model: ModelOption) => { onSelect(model); setOpen(false); setQuery('') }
  return <section className="model-section"><div className="field-heading"><label id="model-label">Model</label><span className="field-hint">{loading ? 'Đang đọc danh mục…' : selected.source === 'cli' ? 'Danh mục Codex CLI' : 'Chưa xác minh'}</span></div>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild><button type="button" className="model-trigger" role="combobox" aria-labelledby="model-label" aria-expanded={open} aria-controls="model-options" disabled={disabled}><Search size={18}/><span className="model-name">{selected.displayName || 'Tìm hoặc nhập model ID'}</span><ChevronDown size={18}/></button></Popover.Trigger>
      <Popover.Portal><Popover.Content className="model-popover" sideOffset={8} align="start" collisionPadding={16}>
        <div className="model-search"><Search size={16}/><input aria-label="Tìm model" placeholder="Tìm model hoặc nhập model ID…" value={query} onChange={e => setQuery(e.target.value)} maxLength={200}/></div>
        <div id="model-options" role="listbox" aria-label="Danh sách model" className="model-options">
          {visible.map(model => <button type="button" role="option" aria-selected={model.id === selected.id} key={model.id} onClick={() => select(model)}><span><strong>{model.displayName}</strong><small>{model.id}{model.source !== 'cli' ? ' · Chưa xác minh' : ''}</small></span>{model.id === selected.id ? <Check size={17}/> : null}</button>)}
          {canUseManual ? <button type="button" role="option" aria-selected={false} onClick={() => select({ id: manual, displayName: manual, efforts: null, defaultEffort: null, source: 'manual' })}><span><strong>Dùng “{manual}”</strong><small>Model ID thủ công · Chưa xác minh</small></span></button> : null}
          {!visible.length && !canUseManual ? <p className="empty-inline">Không có kết quả. Nhập model ID không có khoảng trắng.</p> : null}
        </div>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  </section>
}
