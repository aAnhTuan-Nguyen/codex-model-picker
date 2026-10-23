# Model Picker: context window và mặc định chung cho subagent

Ngày 23/10/2026. Trạng thái: **đã triển khai bản 0.2.0, bỏ preset 1M, UI mới và thanh kéo theo ảnh bổ sung; xem kết quả kiểm thử trong docs/windows-validation.md**.

Tài liệu này bổ sung và thay phần giới hạn «chỉ hai khóa gốc, không context» của [thiết kế bản đầu](2026-10-15-model-picker-design.md). Các nguyên tắc bảo toàn cấu hình, sandbox Electron, kiểm tra revision, backup và hoàn tác vẫn áp dụng.

## Ý định đã xác nhận

Người dùng muốn công cụ cấu hình nâng cao theo ảnh đã gửi, gồm model chính, mức suy luận, context window, và model/mức suy luận riêng cho subagent. Bản đầu chỉ có model/mức suy luận nên chưa đủ.

Ngày 23/10 người dùng xác nhận phần subagent là **một bộ mặc định chung**. Không xây trình cấu hình riêng từng vai trò. Giữ yêu cầu trước đó: reasoning bằng thanh kéo các nấc, giao diện gọn/đẹp, không làm hỏng cấu hình Codex và vẫn tự sửa TOML về sau được. Chấp nhận mở chat mới để kiểm tra cấu hình mới; không cam kết đổi chat đang mở.

## Cách thực hiện và đánh đổi

Đề xuất của người thực hiện: mở rộng app Electron/React đang có, vẫn chỉnh file cấu hình mà Codex đọc. Đây là cách phù hợp với yêu cầu tiếp tục dùng Codex và giữ nền tảng backup/undo đã có.

- Xây một ứng dụng chat/app-server riêng sẽ có thể điều khiển các phiên của chính nó, nhưng thêm luồng chat và không tự điều khiển chat trong Codex Desktop; không phục vụ mục tiêu hiện tại.
- Sửa nội bộ bộ cài hoặc cơ sở dữ liệu Desktop để ép lựa chọn phụ thuộc phiên bản, khó khôi phục và trái ràng buộc giữ Codex hiện có. Không chọn cách này.

Không thay framework, thêm dịch vụ mạng, gọi inference, tự cài CLI, sửa provider, đăng nhập hoặc lịch sử chat.

## Phạm vi cấu hình

| Điều khiển | Khóa TOML | Kiểu |
| --- | --- | --- |
| Main model | `model` | Chuỗi model ID |
| Reasoning effort chính | `model_reasoning_effort` | Chuỗi effort được model hỗ trợ |
| Context window | `model_context_window` | Số nguyên token dương |
| Model mặc định subagent | `agents.default_subagent_model` | Chuỗi model ID |
| Reasoning mặc định subagent | `agents.default_subagent_reasoning_effort` | Chuỗi effort |

Năm đường dẫn trên là phạm vi quản lý mới. Không ghi các khóa tưởng tượng như `subagent_model`, `agents.model` hoặc `agents.reasoning`.

Không tự sửa `model_auto_compact_token_limit`. Đây là ngưỡng tự thu gọn lịch sử khác với context window; giá trị hiện có có thể làm lịch sử được thu gọn sớm hơn context người dùng chọn. Giao diện cần nêu điều này khi có ngưỡng riêng, không âm thầm tăng hoặc xóa nó. Nguồn chính thức cho thấy ngưỡng compact mặc định được tính từ 90% context đã resolve; nếu có ngưỡng từ cấu hình/metadata thì lấy giá trị nhỏ hơn. Vì vậy không cần ghép thao tác ghi hai khóa để hỗ trợ preset context.

## Hành vi người dùng

### Model chính và reasoning

Giữ model combobox và reasoning slider theo metadata Codex CLI đã có. Thay đổi chỉ nằm trong bản xem trước đến khi bấm **Lưu mặc định**. Không dùng tên model trong ảnh làm danh sách giả hay tự ánh xạ sang ID không xác minh.

### Context window

Hiển thị các lựa chọn **Mặc định Codex**, **272K**, **500K**, **872K** tương ứng bỏ khóa, 272000, 500000 và 872000 token. Người dùng đã yêu cầu bỏ preset 1M. Đây là các preset cấu hình phía client theo ảnh tham chiếu, không phải chứng nhận model nào cũng hỗ trợ từng giá trị.

Nếu file có giá trị khác, hiển thị giá trị đang có dưới nhãn **Tùy chỉnh trong tệp**, giữ nguyên cho đến khi người dùng chọn preset hoặc mặc định. Không làm tròn hoặc đổi giá trị khi tải/reset. Chấp nhận số nguyên dương trong phạm vi số nguyên an toàn của JavaScript; cấu hình ngoài kiểu/phạm vi xử lý được phải báo lỗi trước ghi.

Luôn có mô tả ngắn: **«Giới hạn cấu hình phía Codex; dung lượng thực tế phụ thuộc model/dịch vụ.»** Không gọi preset là mở khóa context. Không chặn chỉ vì không có metadata giới hạn thật; ghi rõ chưa xác minh khả năng thực tế. Khi đổi model chính, giữ lựa chọn context và hiển thị lại lưu ý, không tự đổi context theo phỏng đoán. Nếu file đã có 1000000 thì chỉ bảo toàn như giá trị tùy chỉnh, không cung cấp nút chọn 1M.

### Mặc định chung cho subagent

Một section có model combobox và reasoning slider riêng. Dùng chung danh mục model đã tải, nhưng trạng thái chọn độc lập với agent chính.

- Mỗi mục có lựa chọn **Mặc định Codex**, tương ứng bỏ riêng khóa đó. Không ghi chuỗi `inherit`, không sao chép cứng model chính. Khi cả hai khóa vắng mặt, để Codex xử lý kế thừa/mặc định theo phiên bản.
- Chọn model cụ thể cho subagent thì slider dùng các effort của chính model đó. Khi model subagent để mặc định, dùng khả năng model chính nếu xác minh được; nếu không, giữ effort hiện có và không tạo danh mục suy luận giả.
- Khi đổi model, giữ effort nếu hợp lệ; nếu không, đề xuất mặc định hợp lệ hoặc bỏ effort trong diff, tương tự luồng chính. Tải app, nhận metadata và reset không tự tạo thay đổi hoặc sửa effort legacy.
- Khi thiếu CLI/danh mục, cho nhập model ID với nhãn chưa xác minh, giữ nguyên dữ liệu đọc được; không tự gán mức effort chưa biết.
- Mô tả section: **«Mặc định cho subagent mới khi Codex không chọn cấu hình riêng.»** Vai trò, lệnh tạo agent, chế độ fork hoặc chính sách của client có thể ưu tiên hơn. Không tuyên bố ép tất cả agent hiện có dùng cấu hình này.

Không bật multi-agent, đổi concurrency, tạo file vai trò hoặc thêm chỉ dẫn để bắt Codex gọi subagent. Các mục đó ngoài yêu cầu đã xác nhận.

## Giao diện

Mở rộng màn hình hiện có thành các nhóm theo thứ tự ảnh: **Main model → Reasoning effort → Context window → Subagent settings → Thay đổi dự kiến**. Theo yêu cầu mới, đổi sang nền kem sáng, surface trắng, chữ xanh rừng, accent cam san hô và xanh ngọc; sinh động, thân thiện và đọc rõ. Main và subagent đều dùng thanh kéo, hỗ trợ chuột và bàn phím.

Trong lúc thực hiện, người dùng gửi thêm ảnh bộ chọn Ultra của Codex và yêu cầu thanh liền bo tròn, nút trắng lớn, tên mức phía trên. Yêu cầu này thay thanh mảnh có dấu nấc trong concept đầu: track gradient xanh dương/tím, thumb trắng 34px, tên mức ở giữa, model ở dưới và reset về mặc định ở góc. Hình thức kéo liền nhưng giá trị vẫn chốt theo tập effort rời rạc Codex cung cấp. Nhãn dưới thanh là cách click trực tiếp và đọc các mức có sẵn. Detail concept bổ sung: `/workspace/generated_images/exec-197b4593-5964-4a53-a8d0-337569208452.png`.

Người dùng yêu cầu thêm Ultra/Max: hiển thị cả hai khi `supportedReasoningEfforts` của model có chúng, giữ nguyên thứ tự danh mục. Lưu đúng `ultra` hoặc `max`, không tự ánh xạ sang `xhigh` hoặc thêm mức vào model không hỗ trợ. Nguồn chính thức định nghĩa cả hai trong `ReasoningEffort`; Codex tự resolve Ultra theo metadata/chế độ đa agent trước inference, nên app không tuyên bố Ultra luôn tương đương một lượng suy luận backend cố định.

Quyết định giao diện do người thực hiện chọn: radio cho context; lựa chọn mặc định hiện rõ; thông tin kỹ thuật chi tiết nằm trong phần giải thích thu gọn thay vì chiếm toàn màn hình. Concept mới tại `/workspace/generated_images/exec-b43e1f01-b0d0-4d91-8082-5b2cee73e269.png`. Token nền `#f6f3eb`, surface trắng, chữ `#203d37`, phụ `#65776d`, cam `#e97950`, xanh `#247b69`, panel subagent sage nhạt. Font hệ thống Segoe UI; bo 16px và viền mảnh; icon Lucide nét 1.8; hover/focus 160ms, tắt chuyển động khi reduced motion. Không có ảnh/illustration nhúng hoặc overlay. Giữ vùng Lưu/Bỏ thay đổi ở dưới, nội dung cuộn khi cửa sổ thấp. Không thêm cửa sổ điều khiển giả. Cửa sổ ban đầu khoảng 820×920; kiểm tra tối thiểu 820×920, 760×720, 640×600 và 390×844 trong renderer; Windows scale 125%/150% là mục kiểm tra thủ công riêng.

Diff và lịch sử dùng nhãn rõ: Model chính, Reasoning chính, Context window, Model subagent, Reasoning subagent. Khi chỉ đổi context hoặc subagent, hàng lịch sử phải tóm tắt đúng các mục đó thay vì hiện model chính A → A.

## Hệ thống hiện có và phần cần sửa

`src/shared/contracts.ts` hiện mã hóa hai trường chuỗi; `validation.ts` chỉ chấp nhận lựa chọn model/effort. Mở rộng kiểu giá trị, khóa diff và validation cho năm mục, phân biệt **giữ nguyên / đặt / bỏ**. Số token phải đi qua IPC dưới kiểu số nguyên, không chuyển mọi mục thành chuỗi.

`src/main/config/toml.ts` hiện patch giá trị gốc bằng range AST. Mở rộng thành thao tác trên các đường dẫn đã khai báo, giữ cấu trúc/comment/BOM/newline thay vì serialize lại cả tài liệu. Phải nhận diện bảng `[agents]`, dotted keys, quoted keys và inline table tương đương. Giữ các trường như `agents.enabled`, concurrency, mô tả và bảng vai trò. Chèn đúng table/path, không tạo `[agents]` trùng hoặc đẩy root key vào table trước đó. Nếu gặp cấu trúc hợp lệ nhưng không patch an toàn được thì từ chối lưu với lỗi cụ thể.

Store vẫn dùng revision SHA-256, backup, tệp tạm cùng thư mục, flush và rename; không thay bằng ghi đè trực tiếp. Chỉ hoàn tác các đường dẫn mà lần lưu đó thực sự đổi. Sau hoàn tác, mọi thay đổi bên ngoài ở mục khác, kể cả các mục khác trong năm khóa, phải còn nguyên. Không xóa nguyên bảng `agents` khi bỏ một mặc định.

Lịch sử hiện tại có schema strict `version: 1`, chỉ hai trường. Thêm schema ghi `version: 2` và adapter đọc v1; không sửa/xóa backup hoặc record cũ. Khi undo v1, các trường mới không thuộc lần ghi đó, nên phải được giữ nguyên trong file hiện tại. Không hiểu trường vắng mặt trong record cũ là lệnh xóa.

Renderer `state.ts`, `usePicker.ts`, diff, lịch sử, demo và test fixtures phải cùng hiểu năm trường. Một bản xem trước thống nhất trước khi lưu; không gọi năm thao tác ghi rời. Preload vẫn chỉ chuyển hợp đồng hẹp, không thêm `require` thư viện ngoài vào sandbox.

## Phiên bản và bằng chứng

Đã đọc lại mã nguồn chính thức tại commit [`bb64b894fd67158be0f874872e6d7bfe717e7368`](https://github.com/openai/codex/tree/bb64b894fd67158be0f874872e6d7bfe717e7368) trong lượt thiết kế ngày 23/10. CLI cài trong cloud là `codex-cli 0.159.2`. Đây là bằng chứng từ nguồn và phiên bản CLI, chưa phải kiểm thử runtime hay chứng minh Desktop trên máy người dùng hỗ trợ cùng phiên bản.

- [Schema `AgentsToml`](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/core/config.schema.json#L48): hai mặc định model/effort.
- [Ưu tiên cấu hình lúc spawn](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/core/src/agent/child_config.rs#L204): giá trị truyền rõ cho spawn ưu tiên hơn mặc định tương ứng; [role layer](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/core/src/agent/role.rs#L180) có thể ghi đè sau đó.
- [Context override](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/models-manager/src/model_info.rs#L19): bị giới hạn bởi `max_context_window` khi metadata có giới hạn này.
- [Tính ngưỡng compact](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/protocol/src/openai_models.rs#L517): không cần tự sửa ngưỡng compact cùng preset context.
- [Context của subagent](https://github.com/openai/codex/blob/bb64b894fd67158be0f874872e6d7bfe717e7368/codex-rs/core/src/agent/child_config.rs#L132): feature flag có thể bỏ override context/compact kế thừa từ cha. Section context không được hứa cùng giới hạn cho mọi subagent.

Nếu bản Codex của người dùng không hỗ trợ mặc định subagent, phải nêu rõ giới hạn tương thích; không ghi khóa thay thế tự nghĩ ra hoặc đổi sang per-role âm thầm. CLI dùng để tham chiếu metadata không phải bằng chứng Desktop cùng phiên bản. Kiểm tra thực tế bằng chat mới và subagent mới, hoàn thành tác vụ đang chạy trước khi khởi động lại Desktop nếu cần.

## Kiểm chứng và nghiệm thu

1. Load/reset không tự làm dirty hoặc ghi file, gồm context tùy chỉnh và effort legacy ở cả hai nhóm.
2. Đổi riêng từng mục và cả năm mục tạo diff đúng; chọn context 500K ghi số `500000`; chọn mặc định bỏ đúng khóa.
3. TOML tests chứng minh bảo toàn comment/BOM/CRLF, root/table/dotted/quoted/inline forms, vai trò và trường `agents` khác. Kiểu sai, lỗi parse và cấu trúc không hỗ trợ không ghi file.
4. Lưu/undo bằng fixture tạm giữ sửa đổi bên ngoài; xung đột đúng trường bị chặn. Read/undo record v1 không xóa context hoặc subagent đặt sau đó.
5. Main và subagent chọn độc lập, có chuột/bàn phím cho cả slider; metadata late-load và unavailable không đổi lựa chọn đang sửa. Context radio và phần cuộn hoạt động ở viewport nhỏ, reduced motion.
6. Typecheck, unit/component tests và renderer E2E qua. Windows CI chạy source và packaged app với fixture riêng có đủ năm khóa và kiểm thử tương thích lịch sử cũ.
7. README/screenshot/checklist phản ánh bản mới. Báo riêng kết quả app build/test và kết quả tích hợp Codex Desktop; không dùng CI hay sửa file thành công để khẳng định model/context thực tế đã đổi.

## Phần giao người thực hiện quyết định

Tên component, cách chia module patch, version adapter nội bộ, CSS chi tiết và thứ tự commit có thể tự quyết miễn giữ hợp đồng/hành vi nêu trên. Không thêm chức năng độc lập ngoài các mục đã xác nhận. Người dùng giao người thực hiện chọn UI/UX và yêu cầu làm tiếp; không mở thêm vòng chọn màu hay phương pháp thực hiện.
