import * as Dialog from '@radix-ui/react-dialog'
import { FileCode2, FolderOpen, Terminal, X } from 'lucide-react'
import type { CatalogResult, ConfigSnapshot } from '../../shared/contracts'
export function ConfigPanel({ snapshot, catalog, busy, chooseConfig, chooseCli, openFolder }: { snapshot: ConfigSnapshot | null; catalog: CatalogResult | null; busy: boolean; chooseConfig: () => void; chooseCli: () => void; openFolder: () => void }) {
  return <Dialog.Root><Dialog.Trigger asChild><button className="footer-link"><FolderOpen size={16}/>Vị trí cấu hình</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <div className="dialog-heading"><Dialog.Title>Vị trí cấu hình</Dialog.Title><Dialog.Close className="icon-button" aria-label="Đóng"><X size={18}/></Dialog.Close></div>
    <Dialog.Description>Chọn đúng tệp mà Codex của bạn sử dụng. Windows và WSL có thể có cấu hình riêng.</Dialog.Description>
    <div className="file-location"><FileCode2 size={20}/><div><strong>config.toml</strong><code>{snapshot?.displayPath ?? 'Chưa đọc được tệp'}</code><small>{snapshot?.exists ? 'Tệp hiện có · Chỉ quản lý model và mức suy luận' : 'Chưa có tệp · Chỉ tạo khi bạn lưu thay đổi'}</small></div></div>
    {snapshot?.warnings.map(w => <p key={w} className="modal-note">{w}</p>)}
    <div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={chooseConfig}>Chọn tệp khác</button><button className="button secondary" disabled={busy || !snapshot} onClick={openFolder}>Mở thư mục</button></div>
    <div className="catalog-section"><h3><Terminal size={17}/>Danh mục Codex CLI</h3><p>{catalog?.status === 'available' ? 'Đã đọc metadata từ CLI. Khả năng truy cập model thực tế vẫn do dịch vụ quyết định.' : catalog?.message ?? 'Danh mục chưa khả dụng. Có thể chọn executable của Codex CLI.'}</p><button className="button secondary" disabled={busy} onClick={chooseCli}>Chọn Codex CLI</button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
