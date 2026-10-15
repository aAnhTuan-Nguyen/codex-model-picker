# Trạng thái triển khai

Ngày 15/10/2026. Kế hoạch: `docs/superpowers/plans/2026-10-15-model-picker.md`.

## Phần đã triển khai

| Phần | Kết quả |
| --- | --- |
| Khung Electron, preload và IPC hẹp | Có, build và kiểm tra preload sandbox; native GUI cần Windows CI |
| Đọc và patch TOML | Có, chỉ sửa hai khóa gốc; giữ chú thích/BOM/CRLF và cấu hình khác |
| Lưu, backup và hoàn tác | Có, revision check, từ chối read-only/symlink, thay thế qua tệp tạm; hoàn tác đúng khóa đã đổi |
| Danh mục model tùy chọn | Có, CLI stdio riêng, xác minh home/provider, phân trang, giới hạn dữ liệu/thời gian, không inference |
| UI và thanh kéo | Có, model combobox, nấc theo metadata, chọn mặc định, diff, lỗi và thành công rõ ràng |
| File và lịch sử | Có, native file/executable dialog, mở thư mục, preview hoàn tác, không phục hồi nguyên backup đè file mới |
| Đóng gói Windows và CI | Có cấu hình và test source/packaged app; kết quả runtime Windows chưa được quan sát tại cloud |

Kiểm tra đã chạy sau lượt sửa review: 42 unit/component tests passed, TypeScript và production build passed. Playwright renderer có 4 tests passed; desktop test tại cloud skipped vì không có display/sandbox Linux được hỗ trợ. Các test file chỉ dùng thư mục tạm. Không dùng cấu hình, token hoặc lịch sử Codex thật của người dùng làm dữ liệu test.

Cross-build NSIS trên Linux đã được thử, chặn ở bước cần Wine; file `.exe` tạo dở không được bàn giao. Workflow Windows là đường tạo installer chuẩn. Không coi việc thêm workflow là bằng chứng workflow đã chạy thành công; API GitHub bị proxy cloud chặn CONNECT 403.

Bản ZIP portable Windows bổ sung đã build thành công và qua kiểm tra CRC/ASAR; xem checksum và giới hạn ở `docs/windows-validation.md`. Sau đó đã cài lại bằng `npm ci` từ lockfile và chạy lại typecheck/build + 42 tests thành công, xác minh setup có thể lặp lại. Hướng dẫn `install_script` và `start_skill` đã được lưu vào draft môi trường cloud; việc lưu draft không publish snapshot hoặc áp dụng cấu hình runtime.

## Review độc lập và sửa lỗi

Một reviewer độc lập đọc commit `dd5517e` theo spec và review focus. Không có finding Critical; có hai finding Important đã được tái hiện bằng test thất bại rồi sửa:

1. Cleanup CLI chờ `close` không giới hạn: thêm bước graceful termination, ép dừng đúng tiến trình được tạo và teardown stream theo deadline. Hai regression tests bao gồm CLI bỏ qua SIGTERM và descendant giữ pipe.
2. Tải lại/“Bỏ thay đổi” tự đề xuất effort mặc định thay giá trị legacy: giữ nguyên giá trị đang lưu khi khởi tạo/reset, báo không tương thích để người dùng tự chọn. Có test state và test UI cho load/discard; không autosave.

Hai gợi ý Minor chưa làm trong bản đầu:

- Hàng lịch sử hiện tóm tắt model trước/sau; lần chỉ đổi effort có thể hiện cùng model ở hai phía. Preview hoàn tác vẫn hiển thị đầy đủ effort.
- Bổ sung test trực tiếp handler IPC cho sender/capability validation; hiện đã có validation schemas, kiểm tra API bridge, VM preload production và desktop smoke test trong CI.

## Các quyết định khi thực hiện

- Giữ checkout cloud hiện tại, không tạo worktree, theo yêu cầu onboarding và spec.
- Npm/cache Electron trong cloud dùng `/tmp` vì home chỉ đọc; không tắt TLS hoặc checksum.
- Gộp phần khung/core trong mốc commit đầu để không commit shell thiếu module được import; vẫn giữ ranh giới contracts/store/catalog/UI đã thiết kế.
- Tách validation khỏi contracts để preload sandbox không phải `require('zod')`; regression VM preload đã thất bại trước và qua sau sửa.
- Undo chỉ khôi phục khóa mà bản ghi thực sự đổi, giữ sửa đổi sau đó ở khóa không bị lần lưu đó chạm tới; khớp yêu cầu cho phép tự chỉnh cấu hình.
- UI thực hiện thiết kế đã duyệt, không dựng nút điều khiển cửa sổ giả trong trang; Electron dùng cửa sổ hệ điều hành. Bản DEV có nhãn và dữ liệu minh họa, bản production không chứa danh mục giả.

## Kiểm tra giao diện

Đã dùng `view_image` đối chiếu concept Image Gen với ảnh render thật ở 760×720; kiểm tra thêm 640×600 và 390×844. Đã xem hierarchy/copy, màu nền charcoal và accent xanh, typography/độ đọc, spacing/border, icon, vị trí các nút và thanh kéo. Không thêm hero, dashboard, thẻ trang trí hoặc chức năng ngoài phạm vi.

Khác biệt có chủ đích so với hình concept: nhãn “Trong tệp” thay trạng thái dễ hiểu nhầm “Đang lưu”; nút Lưu bên phải theo ASCII/spec đã duyệt; dữ liệu demo có nhãn DEV; mô tả High nêu thời gian suy luận thay cho lời hứa về chi phí/chất lượng; footer và vùng cuộn bảo vệ nút thao tác khi cửa sổ thấp. Ảnh README là UI thực tế ở chế độ DEV, không phải bằng chứng model/tài khoản thật được hỗ trợ.

## Việc còn cần xác minh

Theo `docs/windows-validation.md`: chạy installer/app thật trên Windows, scale 125%/150%, locking/ACL Windows, và Codex Desktop có nhận cấu hình trong chat mới/restart hay không. Không tuyên bố đã xác minh các điều này chỉ từ build hoặc renderer test.
