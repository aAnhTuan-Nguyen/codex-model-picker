# Context, shared subagent defaults and UI refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add context presets without 1M and shared subagent model/reasoning defaults, with a lively coral/sage light UI and Codex-style blue pill sliders; Max/Ultra follow actual model metadata.
**Architecture:** Extend the existing Electron config editor, preserving narrow IPC and sandbox. Five managed TOML paths share typed values, diff and undo helpers; renderer remains a separate state/UI layer. Work in the existing checkout.
**Tech Stack:** Existing locked Node 24/npm 11, Electron, React, TypeScript, Radix and TOML parsers. No new product dependencies.
**Spec:** `docs/superpowers/specs/2026-10-23-context-subagent-defaults-design.md`, including the user's latest remove-1M and redesign instruction.

## Global Constraints

- Five paths only: `model`, `model_reasoning_effort`, `model_context_window`, `agents.default_subagent_model`, `agents.default_subagent_reasoning_effort`.
- Context presets are absent/272000/500000/872000. Keep other persisted values as custom. Do not mutate auto-compaction limits.
- Save explicitly; preserve comments/BOM/CRLF/other settings, optimistic revision checks, private backup and scoped undo.
- Read history v1 and v2; write v2. Old history cannot delete newly managed keys.
- No inference or user config as fixtures. No claims of live chat changes or Desktop compatibility from a file write.
- Reuse checkout; use existing Node/npm/deps. Browser plugin absent: Playwright fallback.

## Review Focus

- Inline/dotted/quoted agents layouts must preserve unrelated agent settings or refuse safely, never serialize the entire file.
- Undo v1 must retain later context/subagent settings; v2 undo must retain any field the save did not change.
- A catalog response arriving after a user edit must not reset subagent or context state.
- Changing main model while subagent inherits model must handle incompatible effort explicitly, not silently save it.
- No 1M choice; stored custom context stays unchanged, including 1000000. Small windows must keep Save reachable.

### Task 1: Typed configuration and history

**Files:** `src/shared/{contracts,validation,values}.ts`, `src/main/config/{toml,history,store}.ts`, `tests/config/*`, `tests/shared/*`.
**Interfaces:** ManagedValues gains `modelContextWindow?: number`, `subagentModel?: string`, `subagentReasoningEffort?: string`. Selection keeps model:string/effort:EffortEdit and gains optional `contextWindow: ValueEdit<number>`, `subagentModel: ValueEdit<string>`, `subagentEffort: EffortEdit`; missing edits mean keep. Export `applySelection`, `changesBetween`, `managedFields` from shared/values.ts for renderer reuse. ChangePreview values accept string|number and five ManagedKey paths. Snapshot warnings may include compaction info.

- [x] Add failing real-TOML round-trip tests for 500000 plus shared subagent defaults, table/dotted/quoted/inline preservation, wrong types and untouched auto-compact threshold.
- [x] Run `npx vitest run tests/config tests/shared` and observe missing behavior failures.
- [x] Extend path-aware AST patching, strict IPC schemas, v2 metadata plus v1 adapter and changed-fields undo.
- [x] Verify targeted tests pass, including v1 undo with later context/subagent edits and v2 unrelated edit preservation.
- [x] Commit coherent core after integration checks.

### Task 2: Independent renderer state

**Files:** `src/renderer/picker/{state,usePicker}.ts`, `tests/ui/state.test.ts` plus focused state tests.
**Interfaces:** usePicker exposes selection, selectedSubagentModel, selectSubagentModel(ModelOption|null), setSubagentEffort(EffortEdit), setContextWindow(ValueEdit<number>); existing callers remain supported. Use shared applySelection/changesBetween helpers. ModelOption with empty id means inherited/unknown as appropriate; avoid fake effort metadata.

- [x] Add tests showing main/subagent independence, shared defaults, absent/custom context unchanged on load/reset, catalog late-load preserving edits, inherited model effort incompatibility and fallback.
- [x] Run tests to observe missing behavior.
- [x] Extend state/hooks without automatic writes, and preserve legacy effort until user choice.
- [x] Run renderer state tests and typecheck once neighbors are integrated.

### Task 3: New visual system and controls

**Files:** `src/renderer/{App.tsx,demo.ts}`, picker controls/history/diff, styles, `src/main/index.ts`, UI component tests.
**Interfaces:** Components consume Task 2 hooks. ModelPicker accepts label/id/default action props for distinct accessible comboboxes. ReasoningSlider accepts separate accessible labels for two sliders. ContextWindow uses a native radio group with four choices, plus persisted custom value when necessary.

- [x] Add failing UI tests for visible context/subagent controls, absent 1M, independent edits and save payload.
- [x] Implement complete screen from the generated concept; native controls, warm ivory/coral/sage tokens, light dialogs/popovers, pinned save/footer, responsive column flow and reduced motion.
- [x] Update demo bridge through shared values helpers (DEV only), extended history previews and all-key history summaries.
- [x] Verify component tests and actual renderer screenshot at desktop/small windows. Inspect concept and renderer via view_image and fix mismatches.

### Task 4: Integration, Windows artifact and handoff

**Files:** `tests/e2e/{renderer,desktop}.spec.ts`, `README.md`, validation/status docs, version metadata if appropriate.

- [x] Extend renderer interaction path: select context + subagent + drag both sliders → explicit save → undo; assert fixed actions and no overflow at 820×920,760×720,640×600,390×844.
- [x] Extend real Electron source/packaged test with five managed paths, Unicode temp directory, preserve external edits and legacy history where practical.
- [x] Run `npm run typecheck`, `npm test`, renderer Playwright. Record Linux desktop skip separately if display/sandbox unavailable.
- [x] Request independent final code review; fix important findings with reproduction tests and rerun affected checks.
- [ ] Refresh README image and exact limits; commit/push authorized main, inspect Windows CI and its installer artifact, fix any real failure. Do not publish a release automatically.
- [ ] Record QA evidence and remaining real Desktop/scale/install-wizard limitations; hand off the latest successful download link.

## Execution notes

The user delegated UI choices and requested immediate implementation; no additional approval gate was added. Runtime/state and UI were developed in parallel through fixed shared contracts. The complete change will be committed together after integration checks so no intermediate revision ships mismatched bridge/UI types. Three independent-review findings were reproduced and fixed; see implementation-status.md.
