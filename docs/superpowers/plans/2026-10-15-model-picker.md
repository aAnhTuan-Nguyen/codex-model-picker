# Codex Model Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current session. Do not spawn sub-agents unless the user explicitly selects parallel execution. Steps use checkbox syntax for tracking.

**Goal:** Tạo ứng dụng Windows chọn model và kéo mức suy luận, xem trước rồi lưu mặc định Codex mà vẫn cho người dùng tự chỉnh cấu hình về sau.

**Architecture:** Electron main sở hữu filesystem và subprocess; preload cung cấp bridge có kiểu, renderer React chỉ giữ trạng thái UI. TOML được sửa theo range thay vì serialize toàn bộ; snapshot/revision, backup và rollback từng khóa bảo vệ thay đổi thủ công. Danh mục CLI là nguồn metadata tùy chọn, không phải kết nối tới chat Desktop.

**Tech Stack:** Node.js 24.x, npm 11.x, Electron, electron-vite, React 19, TypeScript, CSS tokens, Radix Slider/Popover, toml-eslint-parser, smol-toml, Zod, Vitest, Testing Library, Playwright, electron-builder. Chọn phiên bản stable tương thích khi scaffold và khóa dependency trong package-lock, không nâng dependency giữa các task nếu không có chẩn đoán cụ thể.

**Spec:** [2026-10-15-model-picker-design.md](../specs/2026-10-15-model-picker-design.md). Đọc cả [ghi chú kỹ thuật](../../model-picker-notes.vi.md) trước khi triển khai.

## Global Constraints

- Nền tảng đích: Windows 11 x64; Linux cloud dùng để phát triển và kiểm thử phần dùng chung.
- Toolchain phát triển: Node.js 24.x, npm 11.x; dependency được khóa trong `package-lock.json`, cài lại bằng `npm ci`.
- Dùng checkout hiện tại `/workspace/codex-model-picker`; không tạo Git worktree nếu người dùng không yêu cầu.
- Bản đầu chỉ quản lý hai khóa gốc `model` và `model_reasoning_effort`.
- Không sửa bộ cài Codex, file xác thực, lịch sử chat, cơ sở dữ liệu phiên, provider, quyền chạy lệnh, context window hay các profile.
- Chỉ ghi cấu hình khi người dùng bấm “Lưu mặc định” hoặc xác nhận “Hoàn tác”; kéo thanh không tự lưu.
- Thông báo thành công phải là “Đã lưu cấu hình mặc định”; không tuyên bố chat đang mở đã đổi model.
- Cần kiểm thử trực tiếp Codex Desktop trên Windows trước khi công bố tương thích Desktop.

## Review Focus

1. TOML có BOM/CRLF, Unicode, khóa có dấu ngoặc kép, dotted keys, multiline strings và comments: chỉ hai khóa gốc được đổi; Task 2 kiểm tra bytes và ngữ nghĩa.
2. Người dùng sửa file khi app đang mở hoặc sau lần lưu: phát hiện xung đột; rollback giữ thay đổi không liên quan; Task 3 kiểm tra cả hai.
3. CLI thiếu, trả sai giao thức, treo hoặc thuộc home/provider khác: UI không giả xác minh, không gửi inference, subprocess được dọn; Task 4 kiểm tra.
4. Model có tập effort khác, effort vắng mặt hoặc chưa xác minh: không ghi nấc giả/không hợp lệ, không autosave; Task 5 kiểm tra.
5. Windows khóa file, từ chối quyền, lỗi backup hoặc rename: không fallback ghi đè, bản gốc còn nguyên và báo đúng; Tasks 3 và 7 kiểm tra.

## Cấu trúc file dự kiến

```text
package.json, package-lock.json, electron.vite.config.ts
tsconfig*.json, vitest.config.ts, playwright.config.ts
electron-builder.yml, .gitignore, README.md
src/shared/contracts.ts             # DTO, schema IPC, mã lỗi
src/main/index.ts                   # vòng đời cửa sổ, CSP, điều hướng
src/main/ipc.ts                     # handler và validation IPC
src/main/config/paths.ts            # home, file được chọn, canonical path
src/main/config/toml.ts             # parse/snapshot/patch hai khóa
src/main/config/store.ts            # revision, backup, temp/rename
src/main/config/history.ts          # metadata, rollback từng khóa
src/main/catalog/client.ts          # tiến trình CLI, RPC, timeout, cleanup
src/main/catalog/normalize.ts       # danh mục tối thiểu cho UI
src/preload/index.ts                # window.modelPicker
src/renderer/index.html, main.tsx, App.tsx
src/renderer/bridge.ts              # chọn bridge thật hoặc DEV mock rõ ràng
src/renderer/picker/state.ts        # lựa chọn, dirty, preview, effort fallback
src/renderer/picker/ModelPicker.tsx
src/renderer/picker/ReasoningSlider.tsx
src/renderer/picker/ChangePreview.tsx
src/renderer/picker/ConfigPanel.tsx
src/renderer/picker/HistoryPanel.tsx
src/renderer/styles/tokens.css, app.css
tests/config/, tests/catalog/, tests/ui/, tests/e2e/
.github/workflows/ci.yml
```

Các task dưới đây mô tả phần việc tương lai; chưa có lệnh build/test ứng dụng nào được chạy tại thời điểm lập kế hoạch. Sau mỗi task, kiểm tra diff và tạo commit cục bộ cho phần đã xác minh, không tự push/publish.

### Task 1: Khung desktop, bridge và môi trường kiểm thử an toàn

**Files:** tạo cấu hình root, `src/shared/contracts.ts`, `src/main/{index,ipc}.ts`, `src/preload/index.ts`, renderer entry/bridge, `tests/ui/bridge.test.ts`, `tests/e2e/shell.spec.ts`.

**Interfaces:** định nghĩa `ManagedValues = { model?: string; modelReasoningEffort?: string }`, `EffortEdit = { kind: 'keep' } | { kind: 'set'; value: string } | { kind: 'unset' }`, `Selection = { model: string; effort: EffortEdit }`, `ConfigSnapshot = { revision: string; values: ManagedValues; warnings: string[]; exists: boolean; displayPath: string }`, `ChangePreview = { before: ManagedValues; after: ManagedValues; changes: { key: 'model' | 'model_reasoning_effort'; before?: string; after?: string }[] }`, `SaveResult = { snapshot: ConfigSnapshot; historyId: string }`, `HistoryEntry = { id: string; createdAt: string; displayPath: string; before: ManagedValues; after: ManagedValues }`.

Định nghĩa `ModelOption = { id: string; displayName: string; efforts: string[] | null; defaultEffort: string | null; source: 'cli' | 'current-config' | 'manual' }`, `CatalogResult = { status: 'available' | 'unavailable'; models: ModelOption[]; message?: string }`, `AppError = { code: 'INVALID_CONFIG' | 'CONFLICT' | 'UNSAFE_PATH' | 'IO_ERROR' | 'INVALID_SELECTION'; message: string }`, `Result<T> = { ok: true; data: T } | { ok: false; error: AppError }`.

Bridge `window.modelPicker` trả `Promise<Result<T>>`: `readConfig(): ConfigSnapshot`, `chooseConfig(): ConfigSnapshot | null`, `chooseCli(): boolean`, `getCatalog(): CatalogResult`, `previewChange(selection: Selection): ChangePreview`, `saveConfig(input: { expectedRevision: string; selection: Selection }): SaveResult`, `listHistory(): HistoryEntry[]`, `undoChange(input: { historyId: string; expectedRevision: string }): SaveResult`, `openConfigFolder(): void`. Cú pháp `method(): Type` ở đây là kiểu dữ liệu bên trong `Promise<Result<Type>>`.

- [ ] Scaffold Electron/Vite/React/TS, Vitest, Testing Library và Playwright; tạo lockfile và scripts `dev`, `dev:ui`, `typecheck`, `test`, `test:ui`, `test:e2e`, `build`, `dist:win`. Không đọc `.codex` thật trong test.
- [ ] Viết test lỗi cho bridge: renderer không có `require`/Node; IPC nhận đường dẫn tùy ý hoặc shape sai bị từ chối; DEV mock không thể được chọn trong bản đóng gói.
- [ ] Chạy `npm test -- tests/ui/bridge.test.ts`; xác nhận test fail đúng điều cần triển khai.
- [ ] Triển khai bridge/schema, secure BrowserWindow/CSP và handler còn thiếu trả lỗi rõ ràng; native dialog là nguồn cấp quyền chọn file/executable. Tạo UI mock có chữ DEV, không nhận đường dẫn thật từ query string.
- [ ] Chạy test bridge, `npm run typecheck` và `npm run build`; smoke shell với adapter test chỉ vào thư mục tạm. Xác nhận ứng dụng chưa ghi cấu hình khi mở/đóng.
- [ ] Review diff và commit `chore: scaffold secure desktop shell`.

### Task 2: Parse và sửa đúng hai khóa TOML

**Files:** tạo `src/main/config/{paths,toml}.ts`, `tests/config/toml.test.ts`, `tests/config/paths.test.ts` và fixtures TOML.

**Interfaces:** `resolveConfigPath(input: { codexHome?: string; userHome: string; chosenPath?: string }): Promise<string>`; `parseSnapshot(bytes: Buffer, canonicalPath: string): ConfigSnapshot`; `buildPatch(bytes: Buffer, selection: Selection): { bytes: Buffer; preview: ChangePreview }`. `exists: false` dùng revision sentinel `missing`, chỉ store tạo snapshot này; file trống vẫn có SHA-256 thật. `buildPatch` không đọc/ghi filesystem.

- [ ] Viết test: `preserves_unmanaged_bytes_comments_bom_crlf`, `updates_only_root_keys_not_profiles`, `inserts_missing_root_key_before_first_table`, `encodes_model_id_as_toml_string`, `unset_effort_preserves_comments`, `invalid_toml_or_managed_value_type_is_read_only`. Dùng parser thứ hai để kiểm tra toàn bộ object ngoài hai khóa không đổi.
- [ ] Viết test paths: `CODEX_HOME` được ưu tiên, chọn file không tạo thư mục, Windows/WSL path không được tự quy đổi, input symlink được store từ chối trước khi ghi.
- [ ] Chạy `npm test -- tests/config/toml.test.ts tests/config/paths.test.ts`; xác nhận fail đúng chức năng thiếu.
- [ ] Dùng range AST để thay giá trị/chèn/bỏ khóa; encode riêng giá trị bằng serializer; giữ nguyên bytes khác; parse lại kết quả. Trả cảnh báo về active profile nếu thấy, không sửa profile hay coi hai giá trị là trạng thái chat.
- [ ] Chạy hai test file, typecheck; đối chiếu fixture trước/sau, không serialize toàn bộ file.
- [ ] Review diff và commit `feat: preserve toml while editing model defaults`.

### Task 3: Lưu, sao lưu, lịch sử và hoàn tác có kiểm tra

**Files:** tạo `src/main/config/{store,history}.ts`, `tests/config/{store,history}.test.ts`; nối handler vào `src/main/ipc.ts`.

**Interfaces:** `ConfigStore.read(): Promise<ConfigSnapshot>`, `preview(selection: Selection): Promise<ChangePreview>`, `save(input: { expectedRevision: string; selection: Selection }): Promise<SaveResult>`, `listHistory(): Promise<HistoryEntry[]>`, `undo(input: { historyId: string; expectedRevision: string }): Promise<SaveResult>`. Store giữ đường dẫn được cấp quyền trong main; renderer không truyền đường dẫn cho save/undo. Dependency filesystem/clock/history directory được inject để thử lỗi.

- [ ] Viết test `save_rejects_stale_revision_without_touching_target`, `backup_failure_keeps_original`, `rename_failure_keeps_original_and_cleans_temp`, `locked_or_readonly_target_reports_io_error`, `changed_symlink_target_is_rejected`, `missing_file_is_not_created_by_read`, `successful_save_is_reparseable_and_has_durable_backup`.
- [ ] Viết test rollback: `undo_preserves_later_unmanaged_edits`, `undo_rejects_later_managed_edits`, `undo_removes_previously_absent_effort`, `corrupt_history_does_not_write_config`. Lịch sử ràng buộc đúng canonical path, không áp bản ghi file khác.
- [ ] Chạy `npm test -- tests/config/store.test.ts tests/config/history.test.ts`; xác nhận fail trước triển khai.
- [ ] Triển khai backup/metadata private trong userData, temp cùng thư mục, flush/revision recheck/rename. Từ chối path đích không an toàn. Metadata đánh dấu prepared/applied để khi app dừng bất ngờ có thể đối chiếu hash và không báo sai lịch sử đã áp dụng; thất bại sau rename phải đọc lại kết quả thực tế, không tuyên bố file không đổi.
- [ ] Triển khai undo bằng patch trên bytes hiện tại, chỉ khi các khóa quản lý còn khớp after. Mọi hoàn tác thành công cũng có backup và bản ghi mới. Không restore nguyên backup lên file đích.
- [ ] Chạy toàn bộ `tests/config`, typecheck; dùng fault injection cho mọi ranh giới ghi/rename. Ghi giới hạn optimistic concurrency vào README, không hứa khóa được mọi editor.
- [ ] Review diff và commit `feat: add guarded saves and selective undo`.

### Task 4: Danh mục model thật và fallback không có CLI

**Files:** tạo `src/main/catalog/{client,normalize}.ts`, `tests/catalog/{client,normalize}.test.ts`; nối IPC; tạo executable giả phục vụ test RPC.

**Interfaces:** `loadCatalog(input: { executable: string; codexHome: string; configPath: string; cwd: string; timeoutMs: 15000 }): Promise<CatalogResult>`; `normalizeModels(response: unknown): ModelOption[]`. `getCatalog()` dùng home/provider tương ứng file được chọn; nếu không xác minh được thì trả unavailable. Dữ liệu nhà cung cấp/metadata không được truyền như log thô cho renderer.

- [ ] Viết test: RPC initialize → initialized → model/list; phân trang; CLI thiếu; wrapper `.cmd` không khiến app bật shell; response lỗi/malformed/oversized; timeout; stderr không lọt token/log thô; process cleanup; home/provider mismatch không tạo danh mục verified; không có request inference nào được gửi.
- [ ] Chạy `npm test -- tests/catalog`; xác nhận fail đúng chức năng thiếu.
- [ ] Triển khai spawn không shell trong thư mục app riêng, timeout 15 giây và output 5 MiB; đóng stdin rồi dừng process do app tạo nếu cần. Không dùng daemon start/stop/restart hay truy cập phiên Desktop. Tên client riêng `codex-model-picker`.
- [ ] Chuẩn hóa model ID, default effort và tập effort; giữ nhãn nguồn CLI. Fallback trả model hiện tại/nhập thủ công chưa xác minh; không tự bịa tập effort hoặc yêu cầu người dùng nhập token.
- [ ] Chạy test catalog và typecheck; kiểm tra command line có khoảng trắng và JSON lines bị chia qua nhiều chunk.
- [ ] Review diff và commit `feat: discover model capabilities with safe fallback`.

### Task 5: UI chính với thanh kéo mức suy luận

**Files:** tạo `src/renderer/picker/{state,ModelPicker,ReasoningSlider,ChangePreview}.tsx` (state dùng `.ts`), `src/renderer/styles/{tokens,app}.css`, `tests/ui/{state,reasoning-slider,picker}.test.tsx`; cập nhật `App.tsx`.

**Interfaces:** `deriveSelection(input: { snapshot: ConfigSnapshot; model: ModelOption; previous: Selection | null }): Selection`; `deriveEffortSteps(model: ModelOption): string[]`; `isDirty(snapshot: ConfigSnapshot, selection: Selection): boolean`. `ReasoningSlider({ model: ModelOption; effort: EffortEdit; onChange: (effort: EffortEdit) => void })`. Component không gọi filesystem; chỉ App gọi bridge.

- [ ] Viết test slider bàn phím/chuột, Home/End, accessible name/valuetext; chỉ có nấc model hỗ trợ, giữ thứ tự danh mục và loại giá trị trùng; trường hợp 0/1 nấc không tạo thanh kéo giả; đổi model xử lý effort cũ không hợp lệ; effort absent vẫn absent nếu chưa thao tác; manual model không có slider giả và đề nghị unset effort trong preview.
- [ ] Viết test `dragging_never_calls_save`, `apply_disabled_when_clean_or_invalid`, `loading_does_not_change_config`, `save_uses_snapshot_revision_and_shows_saved_not_applied_to_chat`. Không test pixel màu như logic nghiệp vụ.
- [ ] Chạy `npm run test:ui`; xác nhận fail đúng chức năng thiếu.
- [ ] Triển khai UI theo spec: tối trung tính, Segoe UI, accent xanh nhạt, model combobox có tìm kiếm, thanh kéo nấc, nhãn effort/mô tả, tùy chọn theo mặc định, preview và footer cố định không đè nội dung.
- [ ] Hiển thị loading/empty/unverified/dirty/saving/success/conflict/invalid-config/IO-error. Giữ lựa chọn khi lỗi và đưa hành động tải lại rõ ràng; không tự chọn lại rồi ghi khi file ngoài thay đổi.
- [ ] Chạy test UI, typecheck và Vite preview; chụp 760 × 720 và 640 × 600, kiểm tra focus, keyboard, reduced motion, text dài và cuộn. Chỉ dùng mock có nhãn DEV trong preview.
- [ ] Review diff và commit `feat: build polished picker with stepped reasoning slider`.

### Task 6: Vị trí cấu hình, lịch sử và luồng hoàn tác

**Files:** tạo `src/renderer/picker/{ConfigPanel,HistoryPanel}.tsx`, `tests/ui/history-panel.test.tsx`, `tests/e2e/config-workflow.spec.ts`; hoàn thiện `App.tsx` và handler liên quan.

**Interfaces:** dùng nguyên bridge Task 1 và store Task 3. Native dialog trả snapshot hoặc null nếu hủy. Panel history chỉ hiển thị metadata hai khóa, đường dẫn và thời gian; không render nội dung backup.

- [ ] Viết test chọn file rồi hủy không đổi lựa chọn, mở thư mục qua main không mở URL tùy ý, preview hoàn tác hiện before/after; lỗi conflict không báo thành công.
- [ ] Viết E2E dùng bản Electron và file tạm: mở → chọn model/kéo effort → preview → lưu → đọc file thật → chỉnh một khóa không liên quan ngoài app → undo → xác nhận khóa ngoài còn nguyên. Một case sửa khóa model ngoài app phải từ chối undo.
- [ ] Chạy test panel/E2E để thấy fail đúng luồng chưa được nối.
- [ ] Triển khai các panel và xác nhận hoàn tác; dẫn người dùng mở chat mới kiểm tra model sau lưu. Với config chưa tồn tại, bản xem trước phải nói rõ sẽ tạo file; không tạo ở bước đọc.
- [ ] Chạy `npm test`, `npm run test:ui`, `npm run test:e2e`. E2E Linux dùng Xvfb với Electron sandbox được hỗ trợ; không dùng `--no-sandbox` để ép test pass. Nếu môi trường không hỗ trợ Electron, chạy test renderer và để E2E desktop bắt buộc trên Windows CI.
- [ ] Review diff và commit `feat: connect config location and guarded history flow`.

### Task 7: Đóng gói và xác minh Windows thực tế

**Files:** hoàn thiện `electron-builder.yml`, `.github/workflows/ci.yml`, `README.md`; tạo `docs/windows-validation.md`.

**Interfaces:** `npm run build` tạo renderer/main/preload; `npm run dist:win` tạo installer NSIS `.exe` Windows x64. CI Linux kiểm tra dùng chung; Windows chạy test desktop và đóng gói. Không publish release hoặc yêu cầu chứng chỉ ký để hoàn thành bản thử cục bộ.

- [ ] Viết checklist Windows với kết quả riêng cho app và Codex Desktop: phiên bản, đường dẫn config/home/provider, model trước/sau, chat cũ/chat mới/restart, chế độ thường/Plan. Các bước chưa chạy ghi rõ “chưa chạy”.
- [ ] Cấu hình CI với `npm ci`, typecheck, unit/UI tests, build; job Windows chạy E2E Electron trên file tạm và tạo installer artifact. Không chạy test trên `.codex` thật của runner.
- [ ] Chạy build/kiểm tra Linux có sẵn. Trên Windows 11 x64: cài/chạy/đóng/mở lại app, kéo bằng chuột/phím, scale 125%/150%, thử file khóa/quyền hạn/path Unicode, lưu/undo và kiểm tra app không ghi khi mở.
- [ ] Kiểm tra Codex Desktop trên máy có quyền truy cập thực: hoàn thành tác vụ, lưu mặc định, mở chat mới kiểm tra model; thử restart nếu cần. Không có máy/credentials thì ghi blocker, không coi CI Electron là kiểm chứng Desktop.
- [ ] README hướng dẫn mở–chọn–xem–lưu–chat mới, tự sửa TOML sau đó, rollback, đường dẫn Windows/WSL, giới hạn xung đột và danh mục; thêm ảnh UI từ bản chạy thật và kết quả test thực tế.
- [ ] Review diff và commit `build: package windows app and document verification`.

## Hoàn thành khi nào

- [ ] UI và chức năng file đáp ứng spec; test đã chạy có bằng chứng, không gộp skipped/unrun thành passed.
- [ ] Kiểm tra không có token/file config thật/backup riêng tư trong Git hoặc artifact.
- [ ] Có bản đóng gói Windows được chạy thử, hoặc báo rõ chặn bước nào nếu không có máy Windows.
- [ ] Chỉ gọi “tương thích Codex Desktop đã xác minh” khi checklist Desktop có kết quả thực tế; nếu không, bàn giao rõ app chỉnh cấu hình đã kiểm thử và tích hợp Desktop chưa xác minh.
- [ ] Không tự mở thêm phạm vi đổi chat đang chạy, chỉnh context hoặc sửa profile trong bản đầu.

## Cách thực hiện đề xuất

Triển khai tuần tự trong phiên hiện tại khi người dùng yêu cầu bắt đầu. Các task dùng chung hợp đồng snapshot/selection/store nên một luồng thực hiện dễ kiểm soát hơn cho bản đầu. Người dùng có thể xem lại UI và plan trước khi có thay đổi ứng dụng; yêu cầu hiện tại chỉ là lập kế hoạch.
