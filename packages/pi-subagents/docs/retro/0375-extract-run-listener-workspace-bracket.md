---
issue: 375
issue_title: "Extract run-listener and workspace-bracket collaborators from Subagent"
---

# Retro: #375 — Extract run-listener and workspace-bracket collaborators from Subagent

## Stage: Planning (2026-06-14T19:25:00Z)

### Session summary

Read issue #375 (Phase 17 Step 4 — core consolidation), loaded the package, code-design, design-review, testing, colgrep, and markdown skills, and explored `subagent.ts`, `workspace.ts`, `subagent-manager.ts`, and `subagent.test.ts`.
Produced a 4-step plan in `packages/pi-subagents/docs/plans/0375-extract-run-listener-workspace-bracket.md` extracting a `RunListeners` collaborator and a `WorkspaceBracket` collaborator out of the 488-LOC `Subagent` class.

### Observations

- The issue's first-cut `attach(unsub, detach)` sketch does not match the real call pattern: `wireSignal` fires at run-start and `attachObserver` after session creation, and `resume()` only attaches the observer — so `RunListeners` exposes the two attach points separately (`wireSignal` / `attachObserver` / `release`), not a single combined `attach`.
- The issue's "three dispose paths" is really **two** `dispose()` call sites (`completeRun`, `failRun`); `run()`'s prepare-failure catch has no prepared workspace to dispose.
- The two dispose sites have genuinely different lifecycle semantics — `completeRun` derives status from the result, folds the addendum, and lets a throw propagate; `failRun` hardcodes `"error"`, discards the addendum, and is best-effort `try/catch`.
  Per the code-design structural-duplication heuristic, I kept them separate: `WorkspaceBracket.dispose()` centralizes the *logic* (the `if (prepared)` guard + addendum unwrap) in one place but deliberately does **not** wrap `try/catch`, so each caller's error handling is preserved line-for-line.
  This honestly satisfies the issue's "disposal logic in exactly one place" without forcing a discriminator parameter.
- `WorkspaceBracket` captures the provider *resolver* (`execution.getWorkspaceProvider`), not the provider, so resolution stays at run-start — matching today's `getWorkspaceProvider?.()` timing — while letting the bracket be constructed in the `Subagent` constructor (construct-complete, preserving the Step 2 invariant).
- Per the #374 retro lesson, I added an "Invariants at risk" section: the three prior Phase 17 invariants (at-spawn `promise`, construct-complete, zero external field writes) are each already pinned by a named test and are low-risk here because this step does not touch `start`/`scheduleVia`/`_promise` or add optional init fields.
- Step 3 (wiring) must be atomic: removing the public `wireSignal`/`attachObserver`/`releaseListeners` methods breaks `subagent.test.ts` at the type level, so the `describe`-block deletions land in the same commit.
- Suite is at 982 tests (verified by running the suite); expect roughly +5 net (≈ −7 redundant `Subagent` listener tests, +6 each new collaborator suite).
- First-party issue (author `gotgenes` == gh user) with an unambiguous proposed change, so the `ask-user` gate was skipped.
- Commit types are `test:`/`refactor:`/`docs:` — internal-only, no release-please bump; release cadence is a ship-time decision flagged in Risks.
