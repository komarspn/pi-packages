---
issue: 403
issue_title: "Pressing Escape does not stop subagent/background agent"
---

# Retro: #403 — Pressing Escape does not stop subagent/background agent

## Stage: Planning (2026-06-14T00:00:00Z)

### Session summary

Investigated the third-party bug report that ESC does not stop subagents and traced the abort path through both the package and the pinned Pi SDK peer deps.
Found that foreground subagents already receive the parent abort signal end-to-end, while background subagents are detached with no interrupt wiring — the reproducible bug.
Confirmed direction with the operator via `ask_user` (third-party gate): implement ESC-to-abort for both modes, with a foreground guard test, aborting all running and queued background agents.
Wrote and committed plan `0403-abort-subagents-on-interrupt.md`.

### Observations

- Key SDK fact that de-risks the design: in `pi-agent-core` `agent.js`, each run creates a fresh `AbortController` and `finishRun()` discards it **without** aborting on normal completion.
  So the parent signal's `abort` event fires only on a real ESC interrupt — latching `abortAll()` to it will not spuriously kill background agents at turn end.
- Chosen mechanism: a small `InterruptHandler` driven by `pi.on("turn_start", ...)`, re-latching `ctx.signal` each turn so the latch tracks the live per-run signal even across runs and tool-less turns.
  `turn_start` was preferred over `tool_execution_start` because a background agent can outlive the run that spawned it; a turn-level latch still holds the current run's signal when the user interrupts a later tool-less turn.
- Reused the existing `manager.abortAll()` rather than adding `abortBackground()`.
  Foreground agents are already aborted via their own `wireSignal`, so `abortAll()`'s overlap is redundant-but-harmless (status-guarded `abort()`, idempotent `markStopped`).
  The manager does not store `isBackground` on the record, so distinguishing modes would need extra state — deferred as an Open Question.
- Classified as a non-breaking `fix:` (not `fix!:`): no config key, default, or output shape changes; detached-survives-ESC was a limitation, not a contract.
  Noted the behavior change explicitly in Goals.
- Foreground path is believed already-correct from the code trace; the plan adds a regression guard in `subagent-session.test.ts` (`forwardAbortSignal` is currently untested for the parent-signal path) and will fix only if the guard fails.
