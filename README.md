# Codex Model Picker

Ứng dụng Windows độc lập để chọn model chính, kéo mức suy luận, đặt context window và một bộ model/reasoning mặc định chung cho subagent. Giao diện sáng với màu cam san hô và xanh ngọc; xem trước thay đổi, sao lưu và hoàn tác từng mục.

![Giao diện thực tế ở chế độ DEV, dữ liệu model chỉ minh họa](docs/images/preview.png)

**Trạng thái bản 0.2.0:** đã triển khai, qua typecheck/build, 117 unit/component tests và 6 renderer E2E; Windows CI đã chạy app từ source và bản đóng gói, tạo bộ cài mới. Xem [kết quả kiểm thử hiện tại](docs/windows-validation.md). Công cụ chỉnh `config.toml`, không điều khiển chat đang mở. Tích hợp với Codex Desktop trên máy thật cần được xác minh riêng.

## Tải và chạy trên Windows

1. Mở [bản build Windows 0.2.0 đã tạo bộ cài](https://github.com/aAnhTuan-Nguyen/codex-model-picker/actions/runs/39981244372), hoặc chọn lần chạy **Test and build Windows app** thành công mới hơn trên tab Actions.
2. Trong **Artifacts**, tải `Codex-Model-Picker-Windows-x64`, giải nén rồi chạy `Codex-Model-Picker-0.2.0-Setup.exe`.
3. Bộ cài chạy theo người dùng hiện tại; không cần cài Node.js hoặc Rust để sử dụng app. Bản thử chưa ký số, không phải bản phát hành chính thức của OpenAI. Không xóa dữ liệu app/backup khi gỡ cài đặt.

Artifact chỉ xuất hiện khi job Windows build và smoke-test thành công. Không coi việc source đã được push là bằng chứng bộ cài đã được tạo.

## Sử dụng

1. Hoàn thành tác vụ Codex đang chạy và tránh chỉnh cùng file trong lúc lưu.
2. Mở app, kiểm tra **Vị trí cấu hình**. Mặc định là `CODEX_HOME/config.toml`, hoặc thư mục `.codex` trong home người dùng. Windows và WSL có thể dùng hai file khác nhau.
3. Trong **Agent chính**, chọn model. Nếu CLI cung cấp danh mục tương thích, kéo thanh mức suy luận đến nấc mong muốn; có thể để **Mặc định Codex**.
4. Trong **Context window**, chọn mặc định, **272K**, **500K** hoặc **872K**. Đây là cấu hình phía client, không mở khóa giới hạn dịch vụ. Giá trị tùy chỉnh sẵn trong file được giữ nguyên; không có preset 1M. App giữ nguyên ngưỡng tự thu gọn lịch sử `model_auto_compact_token_limit` bạn đã đặt.
5. Trong **Subagent**, chọn model và kéo reasoning riêng nếu muốn. Đây là **một bộ mặc định chung cho agent phụ mới**, độc lập với agent chính. Để **Mặc định Codex** để bỏ lựa chọn riêng; vai trò hoặc lệnh tạo agent có thể ghi đè các mặc định này.
6. Xem các giá trị trước/sau. Chỉ khi bấm **Lưu mặc định**, file mới được ghi và sao lưu.
7. Mở chat mới trong Codex, kiểm tra model và subagent mới trước khi dùng. Nếu chưa nhận thay đổi, đóng/mở lại Codex sau khi tác vụ hiện tại kết thúc rồi kiểm tra lại. Desktop/profile/Plan có thể ghi đè mặc định này; phiên bản Codex cần hỗ trợ các khóa cấu hình tương ứng.

Thanh kéo liền có nút trắng lớn, tên mức và model như bộ chọn Codex. Các mức vẫn là giá trị rời rạc theo danh mục thực tế. **Max** và **Ultra** xuất hiện khi model quảng bá hỗ trợ chúng; app lưu đúng `max`/`ultra`, không đổi thành XHigh hoặc thêm mức giả. Codex tự xử lý ý nghĩa Ultra theo model/chế độ; ảnh DEV chỉ minh họa danh mục, không bảo đảm quyền dùng model.

**Đã lưu cấu hình** không có nghĩa **chat đang mở đã đổi model**. Tool không mở khóa model hoặc tăng giới hạn context của dịch vụ.

### Danh mục model và Codex CLI

App tìm `codex.exe` trên PATH Windows; có thể chọn executable tại **Vị trí cấu hình → Chọn Codex CLI**. App chỉ dùng `initialize`, `config/read`, `model/list` qua app-server riêng, không gửi prompt, không gọi inference và không điều khiển daemon/phiên Desktop.

Không có CLI phù hợp, đang offline hoặc chưa đăng nhập vẫn mở app được: model hiện tại có nhãn **Chưa xác minh**, có thể nhập model ID thủ công trong ô tìm model. Thanh suy luận chỉ bật khi biết các mức model hỗ trợ; đổi sang model thủ công sẽ đề nghị bỏ effort cũ trong phần xem trước. App không tự cài CLI, không yêu cầu nhập token vào UI. Wrapper `.cmd` không được chạy qua shell. Tệp được chọn cần tên `config.toml` và cùng home/provider với CLI để xác minh danh mục; profile đang hoạt động có thể khiến bước này không khả dụng.

Danh mục CLI không bảo đảm tài khoản có quyền chạy mọi model trong danh sách. Không có danh sách model giả trong bản desktop đóng gói.

### Tự sửa TOML và hoàn tác

Bạn vẫn tự sửa file bất kỳ lúc nào. Dùng **Tải lại** trong app để đọc lại sau khi sửa. Nếu revision đã thay đổi, thao tác lưu bị từ chối để tránh ghi đè.

**Lịch sử / Hoàn tác** chỉ hoàn tác các mục mà lần lưu đó đã đổi. Các mục khác, kể cả effort bạn sửa sau một lần chỉ đổi model, được giữ lại. Nếu chính mục cần hoàn tác đã được sửa tiếp, app báo xung đột. Backup gốc không được chép đè toàn bộ lên file mới.

App giữ chú thích, UTF-8 BOM và CRLF/LF; chỉ quản lý năm đường dẫn `model`, `model_reasoning_effort`, `model_context_window`, `agents.default_subagent_model`, `agents.default_subagent_reasoning_effort`. Các mục khác trong bảng `agents`, provider, profile, quyền chạy lệnh, ngưỡng compact, bộ cài Codex, đăng nhập và lịch sử chat được giữ nguyên. Các phiên Codex đọc chung file này về sau có thể nhận mặc định mới.

Lịch sử bản 0.1.0 vẫn được đọc. Hoàn tác bản ghi cũ chỉ hoàn tác các mục lần đó đã đổi; không xóa context hoặc cấu hình subagent được thêm về sau. Khi TOML hợp lệ nhưng có cấu trúc app không thể sửa an toàn, app từ chối lưu và nêu lỗi thay vì viết lại cả file.

Backup và metadata nằm trong thư mục `history` dưới Electron userData (Windows mặc định `%APPDATA%\codex-model-picker`). Backup là toàn bộ file gốc, có thể chứa cấu hình riêng tư của bạn: app không đẩy chúng lên GitHub, không hiển thị nội dung backup, và tạo tệp với quyền riêng người dùng. Các lần chọn file/CLI thủ công hiện chỉ áp dụng trong phiên mở app; lần mở kế tiếp phát hiện lại mặc định.

Kiểm tra xung đột dùng SHA-256 trước khi thay thế tệp; đây là kiểm tra lạc quan, không phải khóa được mọi trình sửa bên ngoài. Vẫn có khoảng đua nhỏ giữa lần kiểm tra cuối và rename. Tệp chỉ đọc, symlink/junction hoặc TOML không hợp lệ sẽ không được sửa; chọn file gốc hoặc sửa lỗi rồi tải lại.

## Phát triển

Node.js 24.x và npm 11.x; dùng checkout hiện tại, không cần tạo worktree mới trong cloud.

```sh
npm ci
npm run setup:electron
npm run dev
```

Electron 44 tải binary bằng lệnh `install-electron` của package, qua `setup:electron`. Lệnh giữ kiểm tra TLS và checksum của Electron. Môi trường proxy cần cấu hình trust/proxy hợp lệ, không tắt xác minh.

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e -- --project=renderer
npm run test:e2e -- --project=desktop
npm run dist:win
```

`npm test` build trước khi chạy để kiểm tra cả preload đóng gói trong sandbox. Test đọc/ghi chỉ dùng thư mục tạm. Desktop E2E cần Windows hoặc display/sandbox Linux được hỗ trợ; bỏ qua có báo rõ nếu không có display. Không tắt sandbox Electron để ép kiểm tra qua. Job Windows kiểm tra cả app từ source và app đã đóng gói, trên file tạm có đường dẫn Unicode.

### Preview UI trong cloud

```sh
npm run dev:ui
```

Đây là **DEV · dữ liệu minh họa**, chỉ mô phỏng trạng thái trong bộ nhớ và không sửa cấu hình thật. Dữ liệu demo bị loại khỏi production bundle. Browser UI tests kiểm tra chuột/bàn phím, save/undo mô phỏng và các viewport; chúng không thay thế desktop E2E hoặc kiểm thử Codex thật.

Nếu npm không ghi được cache trong home của cloud, dùng `npm_config_cache=/tmp/codex-model-picker-npm`. Electron cache tương ứng là `electron_config_cache=/tmp/codex-model-picker-electron`. Không lưu token hoặc file cấu hình thật vào repo.

## Tài liệu

- [Thiết kế context, subagent và giao diện mới](docs/superpowers/specs/2026-10-23-context-subagent-defaults-design.md)
- [Kế hoạch triển khai bản 0.2.0](docs/superpowers/plans/2026-10-23-context-subagent-refresh.md)
- [Thiết kế bản đầu](docs/superpowers/specs/2026-10-15-model-picker-design.md)
- [Nghiên cứu giao thức và giới hạn Desktop](docs/model-picker-notes.vi.md)
- [Kết quả kiểm thử và việc cần xác minh trên Windows](docs/windows-validation.md)
- [Trạng thái triển khai và review](docs/implementation-status.md)
