# Model Picker cho Codex Desktop: kết quả kiểm tra và lưu ý

Ngày kiểm tra: 15/10/2026.

## Mục tiêu đã trao đổi

- Ứng dụng Model Picker độc lập, dùng trên Windows cùng Codex Desktop.
- Mong muốn: đổi model hoặc mức suy luận, rồi lượt gửi tiếp theo trong cùng chat dùng lựa chọn mới.
- Chấp nhận bản đầu cần mở chat mới để dùng lựa chọn mới, miễn giao diện giải thích rõ.
- Hiện đang nghiên cứu ý tưởng; chưa triển khai ứng dụng.

## Kết luận

**Codex có cơ chế đổi model trong cùng một chat, nhưng sửa file cấu hình mặc định không tương đương với gọi cơ chế đó.**

| Thao tác | Điều đã xác minh | Giới hạn |
| --- | --- | --- |
| Gửi `turn/start` với `model` và `effort` | Giao thức hỗ trợ ghi đè cho lượt đó và các lượt sau của cùng thread. | Client phải kết nối đúng app-server quản lý thread. Không có nghĩa tool ngoài đã điều khiển được chat đang mở trong Desktop. |
| Gửi `thread/settings/update` | Có thể cập nhật model và effort cho các lượt sau mà không gửi tin nhắn mới. | Phương thức này đang được đánh dấu experimental; cần kiểm tra tương thích phiên bản và thông báo xác nhận thay đổi. |
| Ghi cấu hình bằng `config/batchWrite` | Có thể lưu các mặc định vào cấu hình. | Ngay cả `reloadUserConfig: true` cũng không nạp lại mặc định model và reasoning effort vào thread đã được tải. |
| Tạo thread mới | App-server tải cấu hình và áp dụng các giá trị ghi đè do client gửi khi tạo thread. | Nếu Desktop truyền model riêng, mặc định vừa ghi vào file có thể bị ghi đè. Chưa thử trên Desktop Windows. |
| Chạy app-server mới từ tool | Có thể tạo một client/phiên riêng. | Không tự gắn vào app-server hoặc chat mà Desktop đang dùng. |

Mức xác minh: đọc mã nguồn chính thức và test có sẵn; tạo và đọc schema từ CLI cài trên môi trường Linux. **Chưa chạy các test Rust, chưa gọi inference, chưa kiểm thử Codex Desktop Windows.** Schema hợp lệ không chứng minh tích hợp Desktop đã hoạt động.

## Phạm vi hợp lý cho bản đầu

Lấy việc chọn và lưu cấu hình mặc định làm phạm vi đầu tiên để kiểm thử. Chưa cam kết đổi trực tiếp chat đang mở.

Luồng dự kiến: chọn model và effort → lưu cấu hình → hướng dẫn mở chat mới → kiểm tra model thực tế. Nếu chưa nhận thay đổi, thử đóng/mở Desktop sau khi công việc đang chạy đã kết thúc. Mở chat mới hoặc khởi động lại là các trường hợp cần kiểm thử, không phải bảo đảm đã xác minh.

Nếu chứng minh được một kết nối được hỗ trợ tới đúng app-server Desktop, có thể bổ sung đổi cho chat đang mở. Mã nguồn hiện có cả daemon dùng chung và lệnh `codex app-server proxy`; đây là hướng cần nghiên cứu, chưa chứng minh Desktop của người dùng sử dụng daemon đó. Daemon cũng đang experimental.

## Lưu ý cần thể hiện trong sản phẩm

1. **Phân biệt đã lưu và đã áp dụng.** Ghi file thành công chỉ báo “Đã lưu cấu hình mặc định”. Chỉ báo chat dùng model mới khi đọc được trạng thái hiệu lực từ đúng phiên hoặc có bằng chứng tương đương. Nếu chưa kiểm tra được, nói rõ “Chưa xác nhận model của chat”.
2. **Thay đổi dành cho lượt tiếp theo.** Không hứa thay model giữa một câu trả lời hay tác vụ đang chạy. Việc đang chạy, tin nhắn thêm vào tác vụ đó và một lượt mới là các trường hợp khác nhau.
3. **Model và effort phải phù hợp.** Giao thức `model/list` trả về các model và mức suy luận được hỗ trợ. Nếu dùng được danh sách này, ưu tiên nó thay vì một danh sách cố định. Tên model tồn tại hoặc xuất hiện trong danh sách không bảo đảm tài khoản được thực thi mọi yêu cầu.
4. **Context không phải nút mở khóa.** `model_context_window` là cấu hình phía client, không phải quyền tăng giới hạn thật của dịch vụ/model. Không quảng cáo rằng nhập số lớn sẽ mở rộng context thực tế. Bản đầu nên tránh cho sửa tùy ý khi chưa kiểm tra.
5. **Cấu hình có nhiều nguồn.** Model do Desktop gửi cho thread, cấu hình dự án, các ghi đè khi chạy và chính sách quản trị có thể tác động tới kết quả. Chế độ cộng tác/Plan còn có thể mang model và effort riêng. Không chỉ đọc một giá trị trong file rồi coi đó là cấu hình hiệu lực của chat.
6. **Đúng nơi lưu cấu hình.** Mặc định Codex dùng `~/.codex/config.toml`; `CODEX_HOME` có thể đổi thư mục này. Trên Windows thường tương ứng thư mục `.codex` trong home người dùng. Cần kiểm tra đúng user và tiến trình; không giả định Codex Windows và Codex trong WSL dùng chung cấu hình.
7. **Giữ nguyên cấu hình khác.** Trước khi sửa cần sao lưu, kiểm tra TOML, chỉ sửa khóa liên quan và tránh ghi đè thay đổi đồng thời từ Desktop. Không sửa token, file đăng nhập, lịch sử chat hay cơ sở dữ liệu phiên để ép đổi model. Nếu dùng API ghi cấu hình, tận dụng `expectedVersion` để phát hiện xung đột.
8. **Tương thích theo phiên bản.** Ghi nhận phiên bản Desktop và app-server/CLI thực tế. Mã nguồn nhánh `main` có thể đi trước bản Desktop đã phát hành; không dùng kết quả nghiên cứu này làm cam kết cho mọi phiên bản.

## Những việc còn phải thử trên Windows trước khi cam kết tính năng

- Xác định phiên bản Desktop, phiên bản app-server nó dùng và đường dẫn cấu hình thực tế.
- Chọn hai model tài khoản dùng được; ghi nhận model trước và sau thay đổi.
- Lần lượt thử: chat hiện có đang rảnh, chat mới, rồi khởi động lại Desktop và tạo chat mới. Không tự ý dừng công việc đang chạy.
- Kiểm tra Desktop có ghi đè lại lựa chọn hay gửi model riêng khi tạo chat không.
- Thử cả chế độ thông thường và Plan nếu muốn hỗ trợ cả hai.
- Với tính năng đổi trong cùng chat: xác nhận kết nối đúng server, đúng thread; đọc xác nhận và kiểm tra model của lượt gửi tiếp theo. Không coi việc tạo server riêng là đã tích hợp Desktop.
- Kiểm tra lựa chọn không hợp lệ, tài khoản thiếu quyền, cấu hình lỗi, xung đột ghi file và khôi phục bản sao lưu.

## Nguồn và bằng chứng

Mã nguồn chính thức `openai/codex`, cố định tại commit `bb64b894fd67158be0f874872e6d7bfe717e7368` để kết quả có thể đối chiếu lại:

- [`TurnStartParams`: model/effort cho lượt này và các lượt sau; ưu tiên của collaboration mode](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server-protocol/src/protocol/v2/turn.rs#L170).
- [`ThreadSettingsUpdateParams`: cập nhật cho các lượt sau](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server-protocol/src/protocol/v2/thread.rs#L236); [phương thức được đánh dấu experimental](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server-protocol/src/protocol/common.rs#L697).
- [`ConfigBatchWriteParams`: model và effort không được hot-reload](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server-protocol/src/protocol/v2/config.rs#L1115); [xử lý ghi cấu hình](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server/src/request_processors/config_processor.rs#L164).
- [Tạo thread có nhận model ghi đè và tải cấu hình](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server/src/request_processors/thread_processor.rs#L1141).
- [Test chính thức `thread_settings_update_emits_notification_and_updates_future_turns`](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server/tests/suite/v2/thread_settings_update.rs#L229). Đã đọc test, không tuyên bố đã chạy test này.
- [Danh mục model và các mức suy luận được hỗ trợ](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server-protocol/src/protocol/v2/model.rs#L118).
- [Thư mục cấu hình, `CODEX_HOME`](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/core/src/config/mod.rs#L5110).
- [Daemon: trạng thái experimental, chia sẻ server và hỗ trợ Windows](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/app-server-daemon/README.md).

Kiểm tra tại môi trường nghiên cứu: `codex --version` trả về `codex-cli 0.159.2`; lệnh `codex app-server generate-json-schema --out <thư-mục-tạm> --experimental` thành công. Các schema `TurnStartParams`, `ThreadSettingsUpdateParams` và `ConfigBatchWriteParams` xác nhận các mô tả nêu trên. Dùng `CODEX_HOME` riêng trong thư mục tạm, không thay cấu hình Codex của người dùng.

Trang tài liệu `developers.openai.com` bị proxy của môi trường chặn (403); nghiên cứu dùng mã nguồn chính thức qua GitHub và schema CLI thay thế. Không thay đổi chính sách mạng để vượt chặn.
