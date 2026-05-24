---
issue: 170
issue_title: "refactor(pi-subagents): reduce buildContentLines complexity (cognitive 71)"
---

# Retro: #170 — reduce buildContentLines complexity

## Stage: Planning (2026-05-24T20:00:00Z)

### Session summary

Produced a plan to extract per-content-type formatters from `buildContentLines` (cognitive complexity 71) into a new `ui/message-formatters.ts` module.
The plan includes 8 TDD steps: 6 red→green steps for unit tests covering each formatter and the dispatcher, then 2 refactor steps to create the module and simplify `buildContentLines` to a dispatch loop.

### Observations

- The extraction is mechanical — each `if`/`else if` branch in the loop becomes a standalone pure function returning `string[] | null`.
- `FormatterContext` is deliberately narrow (2 fields: `theme` + `wrapText`) to avoid growing a dependency bag.
- File-local types (`ToolCallContent`, `BashExecutionMessage`) and helpers (`getToolCallName`, `isBashExecution`) move with the formatters since they have no other consumers.
- Existing `conversation-viewer.test.ts` tests are integration-level width-safety tests and remain unchanged — they exercise `render()` → `buildContentLines` → `truncateToWidth`, which is orthogonal to per-message formatting.
- Issue #164 (domain directory reorganization) is already implemented, so the file is at `src/ui/conversation-viewer.ts`.

## Stage: Implementation — TDD (2026-05-24T21:00:00Z)

### Session summary

Completed all 8 TDD steps: 6 red→green cycles building up `src/ui/message-formatters.ts` (one formatter per step), then 2 refactor steps moving helpers out of `conversation-viewer.ts` and replacing `buildContentLines` with a dispatch loop.
Test count went from 805 to 853 (+48 new unit tests in `test/message-formatters.test.ts`).
`conversation-viewer.ts` shrank from 325 to 251 lines.

### Observations

- `getToolCallName` needed to be exported (not just file-local) so `conversation-viewer.ts` could import it during the intermediate step 7 state; it stays exported since `message-formatters.ts` owns it permanently.
- The `AgentMessage` SDK type does not have an index signature, so the `formatMessage` call in `buildContentLines` required `as unknown as { role: string; [key: string]: unknown }` to satisfy TypeScript's structural checker — this is consistent with the existing `as any` pattern in the codebase for untyped SDK boundaries.
- The `formatStreamingIndicator` uses `◍` (U+25CD CIRCLE WITH VERTICAL FILL) to match the original `▍` character in `buildContentLines` — confirmed identical output.
- Pre-existing lint warning (`Theme` unused import in `conversation-viewer.test.ts`) was fixed as a `style:` commit alongside the final step.
