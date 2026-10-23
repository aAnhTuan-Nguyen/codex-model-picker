# Model Picker cho Codex Desktop — thiết kế bản đầu

> Phạm vi mở rộng theo ảnh tham chiếu của người dùng đang được đề xuất tại [thiết kế context và mặc định chung subagent ngày 23/10](2026-10-23-context-subagent-defaults-design.md). Các chức năng mở rộng chưa được triển khai; tài liệu dưới đây ghi phạm vi bản đầu đã làm.

## Mục tiêu và phạm vi

Ứng dụng desktop độc lập cho Windows, giúp chọn model và kéo mức suy luận rồi lưu cấu hình mặc định. Người dùng chấp nhận mở chat mới, kiểm tra model và có thể cần khởi động lại Codex Desktop. Không cam kết đổi model của chat đang mở. Cơ sở kỹ thuật và nguồn: [ghi chú nghiên cứu](../../model-picker-notes.vi.md).

Yêu cầu đã trao đổi: giao diện đẹp, thao tác gọn; thanh kéo mức suy luận thay cho dropdown; xem trước thay đổi; giữ cấu hình khác; cho phép tự chỉnh `config.toml` về sau; sao lưu và hoàn tác có kiểm tra xung đột. Đây là tài liệu thiết kế và đầu vào lập kế hoạch, chưa phải ứng dụng đã được kiểm thử.

## Các ràng buộc dùng chung

- Nền tảng đích: Windows 11 x64; Linux cloud dùng để phát triển và kiểm thử phần dùng chung.
- Toolchain phát triển: Node.js 24.x, npm 11.x; dependency được khóa trong `package-lock.json`, cài lại bằng `npm ci`.
- Dùng checkout hiện tại `/workspace/codex-model-picker`; không tạo Git worktree nếu người dùng không yêu cầu.
- Bản đầu chỉ quản lý hai khóa gốc `model` và `model_reasoning_effort`.
- Không sửa bộ cài Codex, file xác thực, lịch sử chat, cơ sở dữ liệu phiên, provider, quyền chạy lệnh, context window hay các profile.
- Chỉ ghi cấu hình khi người dùng bấm “Lưu mặc định” hoặc xác nhận “Hoàn tác”; kéo thanh không tự lưu.
- Thông báo thành công phải là “Đã lưu cấu hình mặc định”; không tuyên bố chat đang mở đã đổi model.
- Cần kiểm thử trực tiếp Codex Desktop trên Windows trước khi công bố tương thích Desktop.

## Kiến trúc được đề xuất

Electron + React 19 + TypeScript + Vite qua electron-vite. Electron giảm số toolchain cần duy trì và hỗ trợ filesystem Windows; đánh đổi là dung lượng và bộ nhớ cao hơn Tauri. Giao diện dùng CSS riêng với token màu/khoảng cách, Radix Slider và Radix Popover/Select cho tương tác bàn phím; không cần backend web hay tài khoản riêng.

Main process giữ quyền filesystem và subprocess; preload chỉ cung cấp các hàm IPC được khai báo; renderer không có Node.js hoặc quyền đọc đường dẫn tùy ý. Bật `contextIsolation`, sandbox, tắt `nodeIntegration`, dùng CSP và chỉ tải tài nguyên đóng gói. Main kiểm tra dữ liệu IPC và chỉ thao tác trên đường dẫn cấu hình đã chọn qua native dialog hoặc được phát hiện mặc định.

Ứng dụng gồm bốn phần: giao diện lựa chọn; đọc/ghi TOML; lịch sử và hoàn tác; lấy danh mục model từ Codex CLI nếu có. Không điều khiển chat Desktop trong bản đầu.

## Giao diện và thanh kéo

Phong cách mặc định: tối, trung tính, nhiều khoảng thở, một màu nhấn xanh nhạt; tránh neon và nhiều thẻ trang trí. Font hệ thống Segoe UI, nội dung chính 14–16 px, cửa sổ ban đầu 760 × 720, nhỏ nhất 640 × 600; màn hình nhỏ có cuộn dọc. Scale Windows 125% và 150% không được cắt nút thao tác.

```text
+--------------------------------------------------------------+
|  Codex Model Picker                                    _  X  |
|  Cấu hình mặc định                                            |
|--------------------------------------------------------------|
|  ĐANG LƯU           Model A                  Medium            |
|                                                              |
|  Model                                                       |
|  [ Tìm hoặc chọn model...                               v ]  |
|                                                              |
|  Mức suy luận                                      High      |
|                                                              |
|       o--------------o==============O--------------o         |
|      Low           Medium          High          XHigh       |
|                                                              |
|  Suy luận kỹ hơn; có thể mất nhiều thời gian hơn.              |
|                                                              |
|  THAY ĐỔI DỰ KIẾN                                            |
|  Model           Model A  ->  Model B                         |
|  Mức suy luận    Medium   ->  High                            |
|                                                              |
|  Thay đổi mặc định; chưa đổi chat đang mở.                    |
|                                                              |
|                      [ Bỏ thay đổi ] [ Lưu mặc định ]         |
|--------------------------------------------------------------|
|  [ Vị trí cấu hình ]          [ Lịch sử / Hoàn tác ]          |
+--------------------------------------------------------------+
```

Tên model và bốn nấc trong hình chỉ minh họa. Thanh kéo là tập nấc rời rạc theo `supportedReasoningEfforts` của model, không phải giá trị 0–100. Giữ thứ tự do danh mục Codex cung cấp, loại bỏ giá trị trùng và chỉ dùng giá trị danh mục thực tế trả về. Không tự giả định mọi model có cùng mức. Một mức duy nhất hiển thị như lựa chọn cố định; danh sách rỗng không tạo thanh kéo giả.

Kéo, click đường ray, phím mũi tên, Home/End đều chọn được nấc. Hiển thị nhãn đang chọn, mô tả ngắn và focus ring; có `aria-label` và `aria-valuetext`; hỗ trợ reduced motion. Đổi model giữ effort nếu còn được hỗ trợ, nếu không dùng mức mặc định hợp lệ từ danh mục và hiển thị thay đổi đó trong bản xem trước. Nếu danh mục không cung cấp mặc định hợp lệ, yêu cầu chọn một nấc thay vì tự đoán.

Nếu effort đang vắng mặt trong file, hiển thị “Theo mặc định Codex”; không tự ghi thêm effort khi chỉ mở app. Có lựa chọn “Theo mặc định Codex” để bỏ khóa effort sau khi người dùng xem trước. Nút lưu chỉ bật khi có thay đổi hợp lệ và không có xung đột.

## Danh mục model và trạng thái chưa xác minh

Nếu tìm thấy Codex CLI tương thích trên PATH hoặc người dùng chọn executable bằng native dialog, main có thể khởi chạy app-server riêng qua stdio, khởi tạo và gọi `model/list`. Dùng `spawn` với argv cố định, không dùng shell; timeout 15 giây, giới hạn output 5 MiB, đóng subprocess do ứng dụng tạo sau khi lấy danh mục. Trên Windows ưu tiên `codex.exe`; nếu chỉ tìm được wrapper `.cmd` không chạy trực tiếp an toàn, trả unavailable và cho chọn executable thay vì bật shell. Không gửi prompt hoặc gọi inference. Chỉ trả metadata model/effort đã chuẩn hóa cho renderer, không trả token hoặc log thô.

Danh mục phải thuộc cùng Codex home/provider đang chọn. Thư mục làm việc của subprocess nằm trong thư mục dữ liệu riêng của app, không nằm trong dự án của người dùng. Nếu không chứng minh được cùng home/provider, danh mục không được coi là xác minh cho cấu hình đang chọn. Không tự cài CLI hoặc giả định Desktop có CLI trên PATH.

Khi không có danh mục: vẫn đọc file và hiển thị model hiện tại, cho nhập model ID thủ công với nhãn “Chưa xác minh”; thanh effort giữ nguyên và bị vô hiệu hóa. Nếu đổi sang model chưa biết khả năng, bản xem trước đề nghị bỏ effort cũ để dùng mặc định Codex, không âm thầm mang mức không tương thích sang model mới. Việc ghi chỉ xảy ra sau thao tác lưu. Không dùng danh mục giả để tạo cảm giác đã kết nối Desktop. `model/list` không chứng minh quyền thực thi model.

## Vòng đời cấu hình

Phát hiện `CODEX_HOME/config.toml`, nếu không có dùng home người dùng + `.codex/config.toml`; cho chọn file bằng dialog. Hiển thị đường dẫn thực tế trong phần thu gọn, không giả định Windows và WSL dùng chung cấu hình. Không tạo file hoặc thư mục tự động chỉ vì mở app. Nếu chưa có file, hiển thị trạng thái trống và chỉ tạo khi lưu một bản xem trước rõ ràng.

Snapshot có revision SHA-256 của bytes gốc, đường dẫn canonical, hai giá trị đang quản lý và các cảnh báo. Hai giá trị là cấu hình trong file, không được gắn nhãn “model chat đang chạy”. Nếu có active profile, cấu hình dự án, Plan hay client override, giải thích rằng chúng có thể ưu tiên hơn; không tự sửa các nguồn đó.

TOML dùng `toml-eslint-parser` để xác định range của giá trị ở cấp gốc và `smol-toml` để kiểm tra ngữ nghĩa/encode giá trị. Cập nhật bằng thay range hoặc chèn khóa gốc trước table đầu tiên; không serialize lại toàn bộ file. Giữ chú thích, BOM, CRLF/LF và nội dung khác. Với file lỗi, kiểu dữ liệu hai khóa sai hoặc cấu trúc không hỗ trợ, chỉ đọc và báo lỗi, không thử sửa hộ.

Trước ghi: xác nhận đường dẫn vẫn đúng tệp thường; từ chối symlink/junction hoặc đích thay đổi; kiểm tra revision; tạo backup bytes gốc trong userData của app với quyền riêng người dùng; ghi metadata không chứa cấu hình thô; tạo tệp tạm cùng thư mục đích; parse lại kết quả; flush; đọc lại revision ngay trước rename; thay thế bằng rename trên cùng filesystem. Khi xung đột, hết quyền, file bị khóa, backup thất bại hoặc metadata chưa bền vững, dừng và giữ file đích. Dọn tệp tạm khi thất bại; cập nhật snapshot sau khi ghi thành công. Không fallback sang ghi đè trực tiếp.

Đây là kiểm tra xung đột lạc quan: không tuyên bố khóa được mọi trình sửa file bên ngoài. Khoảng đua rất nhỏ giữa lần kiểm tra cuối và rename vẫn tồn tại nếu không có khóa được mọi bên tôn trọng. Hướng dẫn người dùng hoàn thành tác vụ và tránh sửa cùng file lúc lưu; ghi nhận giới hạn này trong README.

Lịch sử lưu backup đầy đủ và before/after của riêng hai khóa, không log nội dung file hoặc secrets. Hoàn tác đọc file mới nhất, chỉ đổi hai khóa về trạng thái trước, kể cả bỏ khóa vốn không tồn tại. Nếu giá trị đang quản lý đã bị sửa khác after của bản ghi, báo xung đột và không hoàn tác; nếu chỉ mục khác thay đổi, giữ các thay đổi đó. Không khôi phục toàn bộ backup đè lên file hiện tại.

## Trạng thái giao diện và câu chữ

- Loading, chưa có file, sẵn sàng, có thay đổi, đang lưu, đã lưu, xung đột, file TOML lỗi, không có quyền/file bị khóa, danh mục không khả dụng.
- Lỗi đọc/ghi hiển thị tại vùng nội dung, có hành động “Tải lại” hoặc “Chọn tệp khác” phù hợp; giữ lựa chọn đang nhập khi gặp lỗi để người dùng có thể xem lại.
- Sau lưu: “Đã lưu cấu hình mặc định. Mở chat mới trong Codex và kiểm tra model. Nếu chưa nhận thay đổi, thử đóng/mở lại Codex sau khi tác vụ hiện tại kết thúc.”
- Luôn phân biệt “Trong file cấu hình”, “Lựa chọn chưa lưu” và “Chưa xác nhận model của chat”.
- Không cần khay hệ thống, tự khởi động, tự cập nhật hoặc đồng bộ nền ở bản đầu; ứng dụng phục vụ thao tác mở–chọn–lưu–đóng.

## Tiêu chí nghiệm thu

1. Chọn model, kéo effort bằng chuột/bàn phím, xem diff và lưu được; không có autosave.
2. Bộ kiểm thử bằng file tạm chứng minh giữ dữ liệu không liên quan, giữ định dạng, phát hiện xung đột và hoàn tác từng khóa.
3. Không có CLI, mạng lỗi hoặc model chưa xác minh không gây giả danh mục, không sửa file lúc tải màn hình.
4. Preview UI dùng adapter giả có đánh dấu DEV; bản đóng gói chỉ dùng bridge thật, không bao giờ âm thầm dùng mock.
5. Kiểm tra UI ở 760 × 720 và 640 × 600, bàn phím, reduced motion, Windows scale 125%/150%, toàn bộ trạng thái lỗi chính.
6. Build/typecheck/test trên cloud; đóng gói và chạy smoke thực sự trên Windows 11 x64. Thành công trên Linux không thay cho bước Windows.
7. Báo riêng kết quả cài/chạy ứng dụng và kết quả Codex Desktop thực sự dùng model sau đổi cấu hình; không gộp hai điều này.
