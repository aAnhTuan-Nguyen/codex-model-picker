# Kiểm thử và giới hạn

## Bản 0.2.0 ngày 23/10/2026

Đã triển khai context window, một bộ model/reasoning chung cho subagent và giao diện sáng cam san hô/xanh ngọc. Không có preset 1M; cấu hình tùy chỉnh có sẵn vẫn được giữ nguyên. Thanh kéo liền gradient xanh, thumb trắng lớn, tên mức/model theo ảnh bổ sung của người dùng; Max và Ultra theo danh mục model.

Các kiểm thử được mở rộng để kiểm tra chọn riêng model/reasoning chính và phụ, context radio, explicit save/undo, dữ liệu lịch sử v1 và v2. Renderer kiểm tra 820×920, 760×720, 640×600 và 390×844, bàn phím/chuột, reduced motion, nút lưu luôn với tới được và không tràn ngang. Desktop smoke dùng file tạm với đủ năm đường dẫn quản lý, chú thích CRLF, đường dẫn Unicode, ngưỡng compact, mục agents/vai trò khác và sửa đổi thủ công sau lưu.

| Kiểm tra bản 0.2.0 trong cloud | Kết quả |
| --- | --- |
| `npm run typecheck` và production build | Qua |
| `npm test` gồm production preload sandbox | 117 passed |
| Playwright renderer với Chromium hệ thống | 6 passed: mouse/keyboard, save/undo, Max/Ultra riêng biệt, 4 viewport |
| Desktop E2E trên Linux headless | 1 skipped; không có display hỗ trợ |
| Windows source/packaged app + NSIS | Qua, artifact 0.2.0 đã tạo |

Browser plugin không có trong phiên này; renderer dùng Playwright/Chromium hệ thống. Kiểm tra thủ công URL/title, màn hình không trống, không framework overlay, console/page errors rỗng và không tràn ngang. Đã xem trực tiếp concept tổng thể, concept thanh kéo và ảnh render thực tế bằng `view_image`; xem cả mobile và dialog. Ảnh README là renderer DEV ở 820×1160 để thấy đủ nội dung; cửa sổ thấp hơn cuộn phần form, giữ Lưu và footer ở dưới. Primary button dùng cam đậm hơn concept để chữ trắng rõ hơn; thanh kéo thay theo ảnh người dùng gửi sau concept. Không đổi sandbox Electron.

[Run 39981244372](https://github.com/aAnhTuan-Nguyen/codex-model-picker/actions/runs/39981244372), runtime commit `e6bb364`: job Windows hoàn tất trong 2 phút 37 giây. Source E2E, NSIS build và packaged-app E2E đều qua; artifact **Codex-Model-Picker-Windows-x64**, 109 MB, chứa `Codex-Model-Picker-0.2.0-Setup.exe`. Digest GitHub công bố: `sha256:4b464a043663cf0794d824f432ca480a8ef3db6866c2df77445f5e05509c55d3`. Job Linux của run đang chờ kết thúc tại thời điểm cập nhật; kết quả Windows và kết quả local được ghi riêng.

Desktop smoke trên Linux không có display phải báo skipped, không coi là passed. Trạng thái build/test của app và trạng thái Codex Desktop thực sự nhận cấu hình trên máy người dùng là hai kết quả riêng.

## Kết quả lịch sử bản 0.1.0

Ngày: 15/10/2026. Các kết quả dưới đây phân biệt source/build, UI mô phỏng, app desktop và tích hợp Codex Desktop.

## Đã xác minh trong cloud Linux

- Node.js 24.19.0, npm 11.9.0; dependency khóa trong package-lock.
- Build Electron main/preload/renderer và TypeScript.
- Unit/integration: sửa TOML giữ chú thích, BOM/CRLF, bảo vệ profile/dotted keys; sao lưu, xung đột, file chỉ đọc, lỗi ghi/rename, hoàn tác giữ sửa đổi thủ công.
- Bridge/preload production chạy trong bộ kiểm tra chỉ cho phép module Electron hỗ trợ trong sandbox; renderer không được cung cấp IPC tổng quát.
- CLI RPC: initialize/config/model-list, phân trang, dữ liệu UTF-8 qua nhiều chunk, timeout/cleanup, fallback không lộ stderr/token, không gọi inference.
- Playwright renderer: tìm model → kéo bằng chuột → xem trước → lưu minh họa → lịch sử → hoàn tác; bàn phím/Home/End, reduced motion, viewport 760×720, 640×600, 390×844; không có runtime page errors trong luồng chính.

Không có Browser plugin; browser runtime của nền tảng không có binding xác thực để kích hoạt. Dùng Playwright với Chromium hệ thống và profile tạm, dữ liệu DEV trong bộ nhớ. Sandbox Chromium hệ thống không khả dụng trong container; kiểm tra renderer dùng mặc định Playwright, không đổi cấu hình sandbox của ứng dụng Electron.

## Đã xác minh qua Windows CI

[Run 38694345549](https://github.com/aAnhTuan-Nguyen/codex-model-picker/actions/runs/38694345549), code commit `c0ccbea`: **Success**. Job Linux `checks` và job `windows` đều thành công; tổng 2 phút 35 giây. Theo workflow, job Windows đã chạy typecheck/unit tests, Electron E2E từ source, build installer NSIS và Electron E2E trên `win-unpacked/Codex Model Picker.exe` của bản đóng gói.

Artifact thực sự được tạo: **Codex-Model-Picker-Windows-x64**, 109 MB; digest do GitHub công bố `sha256:255ff8e775b88c46753028dfdef5fbed5e556829da0442a98ffd0b91ff9da76e`. Bên trong có `Codex-Model-Picker-0.1.0-Setup.exe`. Có thể cần đăng nhập GitHub để tải artifact. Đã quan sát qua trang Actions công khai; không tuyên bố đã tải hoặc cài artifact tại cloud Linux.

Run đầu `38693664165` từng thất bại ở test store do tên Windows 8.3. Đã sửa việc bind canonical path sau lstat/kiểm tra cùng inode; không bỏ kiểm tra symlink/junction hoặc tắt test để ép qua. Regression local và toàn bộ job Windows sau đó thành công.

## Còn cần xác minh trên máy người dùng

- Chạy Electron GUI thật: không có display/Xvfb/sandbox Linux được hỗ trợ. Desktop E2E báo skipped tại đây; không tính là passed.
- Cài/gỡ qua wizard NSIS trên Windows 11 x64 của người dùng; scale Windows 125%/150%, các trường hợp khóa file độc quyền/ACL cụ thể. Windows runner smoke đã qua nhưng không thay cho các bước này.
- Cấu hình có hiệu lực trong Codex Desktop Windows của người dùng; máy cloud không có ứng dụng/tài khoản Desktop tương ứng.
- API GitHub vẫn bị proxy cloud chặn HTTP CONNECT 403. Đã push và xác minh SHA bằng Git HTTPS; trạng thái run/artifact được đọc từ trang Actions công khai thay cho API.
- Cross-build installer NSIS tại Linux: chặn ở bước cần Wine (`spawn wine ENOENT`), sau khi đã tải/đóng gói Windows Electron. Không dùng file installer tạo dở; kết quả này không ảnh hưởng cấu hình Windows CI.

## Bản ZIP chạy thử được tạo ở cloud

`release/Codex-Model-Picker-0.1.0-Windows-portable.zip` đã đóng gói thành công sau sửa đường dẫn Windows, dung lượng 158.014.588 bytes. Kiểm tra CRC toàn bộ ZIP đạt; có Windows PE executable và `resources/app.asar`. Có đủ parser runtime và không chứa thư mục test/docs/cấu hình riêng tư của repo.

SHA-256: `4560da7e9dc9ed2c856100aec6b91935b0ff452f86a418a441c0c7ccc84353aa`.

Đây là kết quả build, **chưa phải kết quả chạy thử trên Windows**. ZIP nằm trong workspace cloud, được Git ignore; không được push như source. Giải nén toàn bộ rồi mới chạy `Codex Model Picker.exe`. Bản ZIP cross-build bỏ bước chỉnh resource/version và ký executable do không có Wine; bản NSIS từ Windows CI là đường đóng gói chuẩn.

Lệnh cross-build ZIP đã chạy:

```sh
npm run build
XDG_CACHE_HOME=/tmp/codex-model-picker-cache ELECTRON_BUILDER_CACHE=/tmp/codex-model-picker-builder npx electron-builder --win zip --x64 --publish never --config.win.signAndEditExecutable=false --config.win.artifactName=Codex-Model-Picker-0.1.0-Windows-portable.zip
```

## Checklist trên Windows của người dùng

1. Ghi phiên bản Codex Desktop, CLI (nếu có), provider và đường dẫn `config.toml` đang dùng.
2. Cài app từ artifact của run Windows thành công; mở/đóng/mở lại, xác nhận chỉ mở app không sửa file.
3. Dùng hai model tài khoản có quyền truy cập. Chọn model chính và model mặc định subagent khác nhau, kéo cả hai effort được hỗ trợ, chọn context 272K/500K/872K hoặc mặc định, kiểm tra preview rồi lưu. Xác nhận không có lựa chọn 1M và ngưỡng compact cũ không bị sửa.
4. Kiểm tra lần lượt chat đang mở nhưng rảnh, chat mới, và chat mới sau restart. Trong chat mới, kiểm tra cả agent chính và subagent mới. Ghi rõ trường hợp nào nhận thay đổi; không mặc định tất cả đều nhận. Không suy ra dung lượng context thật chỉ từ giá trị app đã ghi.
5. Thử chế độ thường và Plan nếu có dùng. Kiểm tra profile/client có ưu tiên lựa chọn riêng không.
6. Tự sửa một mục khác trong file hoặc bảng `agents` rồi tải lại/hoàn tác; mục đó phải còn nguyên. Sửa chính khóa mà tool vừa đổi: hoàn tác phải báo xung đột. Thử bản ghi lịch sử 0.1.0 để xác nhận context/subagent thêm sau đó không bị xóa.
7. Thử file chỉ đọc, file đang bị khóa, đường dẫn Unicode, backup lỗi, cửa sổ nhỏ và scale 125%/150%.

Chỉ sau bước 4–5 mới có thể ghi nhận hành vi tích hợp với phiên bản Desktop cụ thể. Thành công khi app ghi TOML không chứng minh chat đang mở dùng model đã chọn.
