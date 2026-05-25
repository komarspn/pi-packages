---
issue: 205
issue_title: "Decompose renderWidgetLines (cognitive 44)"
---

# Retro: #205 — Decompose renderWidgetLines

## Stage: Planning (2026-05-25T15:27:45Z)

### Session summary

Planned the decomposition of `renderWidgetLines` (cognitive complexity 44) into four private helper functions: `categorizeAgents`, `buildSections`, `assembleWithinBudget`, and `assembleOverflow`.
Also updated `architecture.md` Phase 12 steps with issue links (#205–#208) and added a Phase 12 row to the structural refactoring issues table.

### Observations

- The function's complexity comes from five interwoven concerns (categorization, section building, heading, non-overflow assembly with connector fixup, overflow-budget assembly) — but the extraction is mechanical since all logic is already pure and stateless.
- No new tests are needed — the existing 8 tests in `widget-renderer.test.ts` cover all branches end-to-end and remain the correct test level for assembly logic.
- The tree-connector fixup (swapping `├─` → `└─` via string replacement on Unicode chars) is the most fragile part; it stays as-is inside `assembleWithinBudget` rather than being further decomposed.
- A `sections` return object from `buildSections` bundles `finishedLines`, `runningLines`, and `queuedLine` to avoid long parameter lists on the assembly helpers.

## Stage: Implementation — TDD (2026-05-25T15:35:10Z)

### Session summary

Completed all four TDD steps: extracted `categorizeAgents`, `buildSections`, `assembleWithinBudget`, and `assembleOverflow` from `renderWidgetLines`.
All 23 `widget-renderer.test.ts` tests pass throughout; no new tests were added.
Full suite (856 tests, 54 files) is green; type check and lint are clean.

### Observations

- **Stray backtick during `assembleOverflow` extraction:** The Edit tool introduced a double-backtick (`\`\``) at the end of the nested template literal on the overflow indicator line — the inner template literal's closing backtick concatenated with the outer template's closing backtick, creating a parse error.
  Required Python-based line-level surgery to fix since the Edit tool cannot reliably match nested template literals through JSON escaping.
- The `renderWidgetLines` `else` block removal also required Python because the Edit tool's `oldText` matching is unreliable when the target contains nested template literals with backticks.
- Aside from the template-literal matching friction, all extractions were purely mechanical; no logic changes were needed.
- The final `renderWidgetLines` is a clean 12-line orchestrator; each helper is well under complexity 10.
