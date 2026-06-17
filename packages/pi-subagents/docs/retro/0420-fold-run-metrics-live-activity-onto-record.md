---
issue: 420
issue_title: "pi-subagents: fold subagent run metrics and live activity onto the core record"
---

# Retro: #420 — pi-subagents: fold subagent run metrics and live activity onto the core record

## Stage: Planning (2026-06-17T00:00:00Z)

### Session summary

Produced a 3-step TDD plan (`docs/plans/0420-fold-run-metrics-live-activity-onto-record.md`) for Phase 18 Step 1: fold `turnCount`, active tools, and response text onto `SubagentState`, have `record-observer` populate them, and expose read-only getters on `Subagent`.
The change is a pure addition / tidy-first — both observers keep running and no consumer reads the new getters until Step 2 ([#421]).
Operator-authored, unambiguous proposal matching the architecture roadmap, so the `ask-user` gate was skipped.

### Observations

- The `maxTurns` getter is the one getter that does **not** delegate to `SubagentState` — it delegates to `this.execution.maxTurns`.
  Verified both spawners pass `execution.effectiveMaxTurns` as `options.maxTurns` (threaded into `SubagentExecution.maxTurns` by `SubagentManager.spawn`), so the record getter returns the same value `AgentActivityTracker` was constructed with.
- Semantics must be copied field-for-field from `AgentActivityTracker` so Step 2's reader swap is behavior-preserving: `turnCount` starts at **1** (readers assume the at-least-1 invariant — `notification.ts` uses `?? 0`, `result-renderer.ts` gates on `> 0`); `activeTools` uses `name_seq` keying for concurrent same-name tools; `removeActiveTool` deletes the first match; `responseText` resets at `message_start` and appends each text delta.
- Decided to leave `resetForResume` **unchanged** (the new fields are not reset on resume).
  Rationale: the tracker is not reconstructed/reset on resume today, so the surviving `SubagentState` accumulating across a resume preserves parity.
  Touching it would violate the pure-addition contract; flagged in Open Questions for Step 2 to revisit against observable reader behavior.
- The tracker's `_session`/`setSession` is deliberately **not** folded — it exists only for UI polling reads and is migrated/removed in Steps 2–3.
- No symbol is removed or renamed, so no `package-pi-subagents` SKILL or architecture-doc prose update is needed; the Phase 18 Step 1 roadmap entry already describes this work.

[#421]: https://github.com/gotgenes/pi-packages/issues/421
