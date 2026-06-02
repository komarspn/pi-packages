---
issue: 319
issue_title: "Introduce PermissionResolver and remove the session-rule relay from the permission gates"
---

# Retro: #319 — Introduce PermissionResolver and remove the session-rule relay

## Stage: Planning (2026-06-02T00:00:00Z)

### Session summary

Planned issue #319, but first reframed it.
The original issue proposed replacing the `GateRunnerDeps` bag with one narrow `GateRunnerContext` interface; investigation showed that a single interface the session implements wholesale would just re-expose the session ("glomming state"), and that the bag is really a relay plus four genuine roles.
Decomposed the architecture rework into three sequential issues, created the two follow-ups, reframed #319 to the foundational step, then wrote and committed the plan.

### Observations

- The decisive evidence: `getSessionRuleset()` has no independent use — at all five call sites (the runner and every `describe*` gate plus `resolveBashCommandCheck`) its result feeds straight into the next `checkPermission(...)` call.
  So `checkPermission` + `getSessionRuleset` are one operation split into a primitive plus a relay; the fix is a single `PermissionResolver.resolve(surface, input, agentName)`.
- The genuinely missing object is a `DecisionReporter` owning `writeReviewLog` (currently a Law-of-Demeter reach-through to `session.logger.review`) + `emitDecision` (event bus).
  This is where the "does the session own the event bus?"
  question resolves: the reporter owns it, the session never does.
- Issue decomposition (user-directed): #319 = `PermissionResolver` + full relay removal across all gates; #322 = `DecisionReporter` extraction (depends on #319); #323 = `GateRunner` class replacing `GateRunnerDeps`, adding the `GatePrompter` role (depends on #319 and #322).
  User chose a flat sequence with cross-links over an umbrella epic.
- Key behavior-preservation note for implementation: `SessionRules.getRuleset()` returns a fresh array copy per call, so folding it into `resolve()` re-snapshots per call instead of once per gate.
  Safe because no `recordSessionApproval` runs during descriptor construction — every snapshot within a gate is equal.
- Migration sequencing: the handler carries both the resolver and the legacy `checkPermission`/`getSessionRuleset` closures through the per-gate steps, so the repo stays green between commits; the final runner step deletes the last closures.
- `docs/architecture/architecture.md` still describes the old single-`GateRunnerContext` framing (Phase 3 Track C, Step 6, the Mermaid roadmap node, and the smell table) — the plan's final step reframes it into the three-issue decomposition.
- The package `SKILL.md` does not reference `getSessionRuleset` or `GateRunnerDeps`, so no skill update is needed.
