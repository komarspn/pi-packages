---
issue: 230
issue_title: "Extract ConcurrencyQueue from AgentManager (Phase 15, Step 5)"
---

# Retro: #230 — Extract ConcurrencyQueue from AgentManager

## Stage: Planning (2026-05-28T20:00:00Z)

### Session summary

Produced a 3-step TDD plan for extracting the scheduling concern (3 fields, 3 methods) from `AgentManager` into a new `ConcurrencyQueue` class.
Both dependencies (#229 Agent.run(), #231 runner self-contained) are confirmed closed.

### Observations

- The issue's proposed API has `drain(start: (id: string) => void)` but also `markFinished()` as no-arg with "running--, drain()" semantics — a contradiction.
  Resolved by storing the `startAgent` callback at construction, making both `drain()` and `markFinished()` no-arg.
  This follows Tell-Don't-Ask and matches the established forward-reference-via-closure pattern already used for `onMaxConcurrentChanged`.
- `markFinished()` auto-drain changes the ordering from "decrement → observer → drain" to "decrement + drain → observer."
  Verified this is safe: observer notification only processes the completed agent and drain only starts promises without awaiting.
- `SettingsManager` does not change — only the callback wiring in `index.ts` changes target from `manager.notifyConcurrencyChanged()` to `queue.drain()`.
- The `agent.ts` `abort()` method has a comment referencing #230 that should be updated in the implementation step.
