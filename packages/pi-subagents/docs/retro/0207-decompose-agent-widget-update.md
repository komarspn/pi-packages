---
issue: 207
issue_title: "Decompose update in agent-widget.ts (cognitive 31)"
---

# Retro: #207 — Decompose `update` in `agent-widget.ts`

## Stage: Planning (2026-05-25T04:12:00Z)

### Session summary

Planned the decomposition of `update` (cognitive complexity 31) into an exported pure `assembleWidgetState` function, a `clearWidget` method, and an `updateStatusBar` method.
The plan follows the Phase 12 pattern established by Steps 1 and 2 (#205, #206) — extract pure functions where possible, otherwise extract methods, and simplify the original function to a thin orchestrator.

### Observations

- The sibling plans (#205, #206) provided a clear template for this plan — structure, section ordering, and test impact analysis all followed the established pattern.
- There are **no existing tests** for `AgentWidget` — the only testable concern is the newly extracted `assembleWidgetState` pure function.
  The rest of the refactoring is a mechanical extraction verified by the type checker.
- `dispose` currently duplicates `update`'s idle-path clear logic — the plan delegates it to `clearWidget`, eliminating the duplication.
- `categorizeAgents` in `widget-renderer.ts` does a similar filter but returns full arrays (for rendering), while `assembleWidgetState` returns lightweight counts (for lifecycle decisions).
  Different outputs for different consumers — no duplication concern.
- No `ask_user` was needed — the issue's "Proposed change" section was unambiguous and the design pattern was well-established by the two preceding Phase 12 steps.
