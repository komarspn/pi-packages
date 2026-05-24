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
