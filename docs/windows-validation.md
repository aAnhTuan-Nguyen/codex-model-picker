# Kiểm thử và giới hạn của bản đầu

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
3. Dùng hai model tài khoản có quyền truy cập. Chọn model, kéo effort được hỗ trợ, kiểm tra preview rồi lưu.
4. Kiểm tra lần lượt chat đang mở nhưng rảnh, chat mới, và chat mới sau restart. Ghi rõ trường hợp nào nhận thay đổi; không mặc định tất cả đều nhận.
5. Thử chế độ thường và Plan nếu có dùng. Kiểm tra profile/client có ưu tiên lựa chọn riêng không.
6. Tự sửa một mục khác trong file rồi tải lại/hoàn tác; mục đó phải còn nguyên. Sửa chính model mà tool vừa đổi: hoàn tác phải báo xung đột.
7. Thử file chỉ đọc, file đang bị khóa, đường dẫn Unicode, backup lỗi, cửa sổ nhỏ và scale 125%/150%.

Chỉ sau bước 4–5 mới có thể ghi nhận hành vi tích hợp với phiên bản Desktop cụ thể. Thành công khi app ghi TOML không chứng minh chat đang mở dùng model đã chọn.
