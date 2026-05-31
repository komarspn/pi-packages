---
issue: 282
issue_title: "Extract ToolPreviewFormatter from tool-input-preview.ts"
---

# Retro: #282 — Extract ToolPreviewFormatter from tool-input-preview.ts

## Stage: Planning (2026-05-30T18:00:00Z)

### Session summary

Produced a numbered implementation plan for extracting a `ToolPreviewFormatter` class from the flat `tool-input-preview.ts` module and threading it through the gate descriptor chain.
The plan covers 6 TDD cycles: extract the class, thread through `describeToolGate`/`formatAskPrompt`, wire construction in `PermissionGateHandler`, remove the module-level `vi.mock` in `permission-prompts.test.ts`, and update architecture docs.
Referenced the Phase 1 roadmap in the architecture doc and confirmed #285 (handleToolCall decomposition) is already completed.

### Observations

- The architecture doc's roadmap was comprehensive and directly translatable to a concrete implementation plan.
  The dependency ordering (#285 before Phase 1 step 2) was verified correct by checking the current code — `permission-gate-handler.ts` already has the decomposed pipeline.
- The existing `tool.ts` gate test (`test/handlers/gates/tool.test.ts`) and `permission-prompts.test.ts` both need formatter injection but in different ways:
  `tool.test.ts` needs a real formatter instance for `describeToolGate`; `permission-prompts.test.ts` needs to replace its module-level mock with direct injection.
- The `permission-prompts.test.ts` mock removal is not purely mechanical — tests that assert `toHaveBeenCalledWith` on the mocked `formatToolInputForPrompt` need rework to assert on the real result string.
  The plan calls this out explicitly in step 5.
- Included `toolInputLogPreviewMaxLength` in `ToolPreviewFormatterOptions` even though the issue only lists two fields, because log-formatting methods (`formatGenericToolInputForLog`, `getToolInputPreviewForLog`, `getPermissionLogContext`) use it and they're all moving to the class.
  If #266 decides not to expose it in config, the field defaults to 1000 and remains internal.
- No ambiguity worth asking the user about — the issue proposed clear steps.

## Stage: Implementation — TDD (2026-05-30T22:30:00Z)

### Session summary

Extracted `ToolPreviewFormatter` from `tool-input-preview.ts` and threaded it through the gate descriptor chain in 4 commits (test step 1, refactor steps 2–5 combined, style fix, docs).
All 68 test files pass with 1527 tests, a net gain of 7 tests over the 1520 baseline.
The `vi.mock` in `permission-prompts.test.ts` was removed; the formatter is now injected directly.

### Observations

- **Plan deviation — steps 2–5 folded into one commit.**
  Removing the 7 config-dependent exports from `tool-input-preview.ts` immediately broke `tool.ts`, `permission-prompts.ts`, and their tests at the TypeScript level, making it impossible to commit the extraction without simultaneously updating all consumers.
  The intermediate state was uncompilable, so the extraction, threading, test updates, and `vi.mock` removal all landed in one refactor commit.
  Noted in the commit body.
- **ESLint `prefer-nullish-coalescing` in `sanitizeInlineText`.**
  The `maxLength !== undefined ? maxLength : default` ternary in `tool-preview-formatter.ts` was caught by the pre-commit hook; fixed before committing by collapsing to `maxLength ?? this.options.toolTextSummaryMaxLength`.
- **Biome `useTemplate` warnings.**
  Two string-concatenation lints in `tool-preview-formatter.test.ts` required a manual edit (unsafe auto-fix); patched with a separate `style:` commit.
- **Pre-completion reviewer WARNs (intentional):**
  - `formatAskPrompt` accepts the full `ToolPreviewFormatter` rather than a narrower `{ formatToolInputForPrompt }` interface — documented in the plan as intentional for forward compatibility.
  - `formatAskPrompt` silently returns empty preview when `formatter` is `undefined` — documented in the plan as safe default behavior.
- Pre-completion reviewer verdict: **PASS**.
