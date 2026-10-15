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

## Chưa xác minh tại máy cloud này

- Chạy Electron GUI thật: không có display/Xvfb/sandbox Linux được hỗ trợ. Desktop E2E báo skipped tại đây; không tính là passed.
- Bộ cài và app đã đóng gói chạy trên Windows 11 x64; scale Windows 125%/150%, khóa file theo cơ chế Windows. Workflow GitHub Actions đã cấu hình các bước Windows. Chỉ ghi passed khi có kết quả run thực tế.
- Cấu hình có hiệu lực trong Codex Desktop Windows của người dùng; máy cloud không có ứng dụng/tài khoản Desktop tương ứng.
- Theo dõi workflow/đọc artifact bằng API GitHub: API bị proxy cloud chặn HTTP CONNECT 403 tại thời điểm kiểm tra. Git HTTPS được kiểm tra riêng; khả năng push không chứng minh API dùng được.
- Cross-build installer NSIS tại Linux: chặn ở bước cần Wine (`spawn wine ENOENT`), sau khi đã tải/đóng gói Windows Electron. Không dùng file installer tạo dở; kết quả này không ảnh hưởng cấu hình Windows CI.

## Checklist trên Windows của người dùng

1. Ghi phiên bản Codex Desktop, CLI (nếu có), provider và đường dẫn `config.toml` đang dùng.
2. Cài app từ artifact của run Windows thành công; mở/đóng/mở lại, xác nhận chỉ mở app không sửa file.
3. Dùng hai model tài khoản có quyền truy cập. Chọn model, kéo effort được hỗ trợ, kiểm tra preview rồi lưu.
4. Kiểm tra lần lượt chat đang mở nhưng rảnh, chat mới, và chat mới sau restart. Ghi rõ trường hợp nào nhận thay đổi; không mặc định tất cả đều nhận.
5. Thử chế độ thường và Plan nếu có dùng. Kiểm tra profile/client có ưu tiên lựa chọn riêng không.
6. Tự sửa một mục khác trong file rồi tải lại/hoàn tác; mục đó phải còn nguyên. Sửa chính model mà tool vừa đổi: hoàn tác phải báo xung đột.
7. Thử file chỉ đọc, file đang bị khóa, đường dẫn Unicode, backup lỗi, cửa sổ nhỏ và scale 125%/150%.

Chỉ sau bước 4–5 mới có thể ghi nhận hành vi tích hợp với phiên bản Desktop cụ thể. Thành công khi app ghi TOML không chứng minh chat đang mở dùng model đã chọn.
