---
issue: 229
issue_title: "Agent born complete: Agent.run() absorbs startAgent (Phase 15, Step 4)"
---

# Retro: #229 — Agent born complete: Agent.run() absorbs startAgent

## Stage: Planning (2026-05-27T18:00:00Z)

### Session summary

Produced a 9-step TDD plan for absorbing `AgentManager.startAgent()` into `Agent.run()`.
Key design decisions: per-agent `AgentLifecycleObserver` interface passed at construction (chosen over callback fields and EventEmitter), and fully async worktree error surface (chosen over split sync/async).

### Observations

- **Observer pattern chosen over callbacks:** The per-agent `AgentLifecycleObserver` interface replaces three separate mechanisms (`onSessionCreated` callback, `setOnRunFinished`, `onCompact` callback).
  All methods are optional, composed by `AgentManager.buildObserver()` per spawn.
- **`ParentSessionInfo`/`CompactionInfo` relocation needed:** `agent.ts` importing from `agent-manager.ts` would create a circular type import (agent-manager already imports `Agent`).
  Moving both types to `types.ts` in step 1 avoids the cycle.
- **`AgentInit` grows wide (15+ optional fields):** Making run-config fields optional preserves backward compat for the 55+ `new Agent()` calls in tests.
  Noted as a known smell — follow-up issues (#230 ConcurrencyQueue, potential `AgentInit` restructuring) may address this.
- **Async error surface changes tool behavior:** `background-spawner.ts`'s try/catch around `manager.spawn()` becomes unreachable for worktree errors.
  Keeping it for robustness; the error surfaces on `record.error` instead.
- **Lift-and-shift TDD order:** Steps 3–5 incrementally change `AgentInit`, `setupWorktree`, and `completeRun`/`failRun` before step 6 adds `Agent.run()`.
  This avoids a single massive step that rewrites everything at once.

## Stage: Implementation — TDD (2026-05-28T01:00:00Z)

### Session summary

Completed all 9 TDD steps in 9 commits (plus 2 planning/retro docs commits).
Test count went from 1005 to 1020 (+15 tests).
`AgentManager.startAgent()`, `SpawnArgs`, and `onSessionCreated` callback are deleted.
`Agent.run()` now owns the full execution lifecycle.

### Observations

- **Steps 7–8 merged in practice:** The tool-layer `onSessionCreated` → `observer` migration (step 8) had to be done alongside the `AgentSpawnConfig` change (step 7) because removing the `onSessionCreated` field broke compilation of `background-spawner.ts` and `foreground-runner.ts`.
  This was expected — they share the same type.
- **`setupWorktree` kept public:** The plan called for making it private in step 4, but it was kept public through step 6 since the manager still called it.
  After step 7 (Agent.run() absorbs the call), it could be made private; left as a minor follow-up (reviewer flagged as WARN).
- **`isBackground` removed from Agent storage:** The field was declared on `AgentInit` but Agent never reads it — the manager resolves `isBackground` before construction (setting initial status and composing the observer).
  Biome flagged it as unused; removed from stored fields, kept on `AgentInit` for the manager's use.
- **Worktree error surface confirmed async:** The `agent-manager.test.ts` test for synchronous worktree throw was rewritten to verify the error surfaces on `record.error` after awaiting the promise.
  `background-spawner.ts` try/catch around `spawn()` retained for robustness.
- **Pre-completion reviewer:** WARN — 3 non-blocking findings: `setupWorktree` not marked private, `isBackground` dead field on `AgentInit`, and `package-pi-subagents` SKILL.md Phase 15 description referencing deleted `startAgent`.
