---
issue: 377
issue_title: "Split widget delegation out of SubagentRuntime"
---

# Retro: #377 — Split widget delegation out of SubagentRuntime

## Stage: Planning (2026-06-15T23:16:29Z)

### Session summary

Produced the implementation plan for removing the `widget` field and five relay methods from `SubagentRuntime`.
Investigation surfaced that the issue's stated approach ("construct the widget before its consumers, pass the handle to `NotificationManager`") is infeasible as written — `NotificationManager` is a transitive *dependency* of the widget, forming a genuine construction cycle (`NotificationManager → widget → manager → observer → NotificationManager`).
The plan dissolves the cycle instead of relocating its late seam.

### Observations

- **Operator steer #1 (seam placement):** rejected both a setter on the observer and a forward-referenced `let widget` closure, citing "no setters, instantiate ready-to-work, constructor DI" (principle 8).
  The forward-ref option would also have trip `prefer-const` and reintroduced the exact eslint-disable smell Phase 17 Step 1 deleted.
- **Operator steer #2 (tidy-first, Kent Beck):** prompted the prep/easy decomposition.
  The hard, cycle-breaking work (dissolve `NotificationManager`'s widget dependency by giving `AgentWidget` self-seeding of `finishedTurnAge`) lands first as a behavior-preserving commit; the relay-method removal then becomes a mechanical "easy change."
- **Behavior-preservation argument:** the widget's 80ms timer is always running at a background completion (the agent was active), and linger expiry is turn-based, so seeding ≤80ms later lands in the same turn — rendered outcome is identical.
  This is the load-bearing claim; the new `agent-widget.test.ts` self-seed test pins it.
- **Three seam options recorded** in the plan's Design Overview for traceability: late-observer setter (rejected), forward-ref closure (rejected), dissolve (chosen).
- **Scope guard:** kept foreground-runner's explicit `markFinished` (idempotent) rather than removing it, and deferred the event-subscription widget model to Phase 18.
  Two open questions logged (single `AgentToolWidget` vs. split deps; redundancy of foreground `markFinished`).
- **Not breaking / not public:** `runtime.ts` is internal (not in the rolled `service.ts` type bundle), so `verify:public-types` is not required.
- **Invariants at risk** flagged against Phase 17 Steps 1 and 5 (forward-ref dance, `index.ts` line budget); grep acceptance checks fold into the final implementation step.

## Stage: Implementation — TDD (2026-06-15T20:19:00Z)

### Session summary

Executed all four planned steps in order: widget self-seeding (`feat`), `NotificationManager` widget-dependency dissolve (`refactor`), direct widget injection + relay-method removal (`refactor`), and the architecture-roadmap update (`docs`).
Test count went 1009 → 1005 (+3 widget self-seed tests, −7 removed relay/field tests).
All deterministic checks green; pre-completion reviewer returned WARN (non-blocking).

### Observations

- The tidy-first sequencing held up exactly as planned: Step 2 broke the cycle while the runtime relay methods were still in place (repo stayed green), making Step 3's export/field removal a clean atomic change.
- The cycle dissolve produced two **stale fallow suppressions** on `AgentWidget.setUICtx`/`onTurnStart` — they were `unused-class-member`-suppressed because the methods were previously reached only through the runtime relay; direct injection made them visibly used.
  Removed both; amended into the Step 3 refactor commit.
- Widget-class testing required constructing `AgentWidget` with a cast manager stub (`as unknown as SubagentManager`) and a recording `UICtx`; observability of the private `finishedTurnAge` is via the `setWidget` clear-vs-register signal, which cleanly distinguishes seeded-then-aged-out from never-seeded.
- `sed` was needed for the runner/spawner test files because the widget arg appeared both inline and as standalone multiline-call lines; a `^\s*runtime,$` line match safely retargeted only the widget positional arg (never `runtime.agentActivity`).
- Two commit-hygiene corrections: an `index.ts` comment-trim fixup was first amended into the `docs` commit by mistake, then moved into the Step 3 `refactor` commit via `reset --soft` + selective re-stage (fixups must not land in `docs:` commits).
- **Reviewer verdict: WARN.**
  Sole finding: `index.ts` is 177 lines (Step 5's aspirational "<170" was already overshot at its own landing, 177); the comment trim kept Step 6 net-neutral.
  Cosmetic, prose-pinned only, non-blocking.
- Cross-step invariants verified by grep: no `let widget` / `prefer-const` forward-ref (Step 1), no `runtime.widget` / `.widget =` / `WidgetLike` anywhere (the issue's core outcome).
