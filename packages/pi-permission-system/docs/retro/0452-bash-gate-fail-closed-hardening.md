---
issue: 452
issue_title: "Bash permission gates silently fail after model changes, denial events, or session compaction git add/commit/push/gh pr create bypass all rules"
---

# Retro: #452 — Make the bash permission gate fail closed instead of silently allowing

## Stage: Planning (2026-06-20T00:00:00Z)

### Session summary

Planned a defense-in-depth, fail-closed hardening of the bash permission gate in response to a third-party bug report (`k0valik`) with a detailed-but-speculative log analysis.
Decomposed the single reported "bug" into four confirmable code defects (A1–A4) plus one unreproducible asymmetry (C), verified each against source and the Pi SDK, and produced a five-step TDD plan filed at `packages/pi-permission-system/docs/plans/0452-bash-gate-fail-closed-hardening.md`.

### Observations

- The keystone finding is A1: the SDK's `emitToolCall` (`runner.js`) calls `await handler(event, ctx)` with **no** try/catch, unlike `emitUserBash` directly below it.
  A thrown `handleToolCall` therefore yields no block and the command runs ungated with no trace — this is what turns every other latent error into a silent bypass.
- A2: `parserPromise ??= initParser()` in `bash-program.ts` caches a *rejected* promise forever; `config.loaded` does not re-run the factory module, matching "stays broken until process restart."
- A3: `resolveBashCommandCheck`'s empty-commands fallback resolves the whole string, so `cd X && git push` rides a permissive top-level `*: allow`.
  When parse succeeds the chain splits correctly, so the bypass is only reachable via empty-parse.
- A4: the shipped example config sets `bash.*: ask` (safe); the reporter's config omitted it, inheriting the permissive top-level `*`.
- Ruled out three of the reporter's theories from source (handler deregistration — contradicted by `rm` staying gated; mid-parse tree-sitter corruption — single-threaded synchronous parse; denial poisoning state — no such code path).
- Could **not** reconcile the `git`-bypasses-while-`rm`-gated asymmetry (C) from static reading; scoped it as diagnosable-on-recurrence rather than guessing a fix.
- Operator decisions via `ask_user` (third-party issue gate): defense-in-depth scope; fallback fails closed to `ask`; emit a non-fatal config warning for the footgun; single plan covering A1–A4 + observability.
- Behavior-changing pieces (A1 block-on-error, A3 ask-on-unparseable) are treated as breaking (`fix!:` + `BREAKING CHANGE:` footer) with a verified opt-out remediation (`"bash": { "*": "allow" }`).
- Release: ship independently (not in any roadmap batch).

### Observations — architectural fold-in (revision)

After a follow-up design discussion, folded structural recommendations into the plan so the fix prevents the bug *class*, not just the instances.

- Reframed A1 from "wrap `handleToolCall` in try/catch" to a single **fail-closed boundary adapter** (`createFailClosedToolCall`, the only `pi.on("tool_call")` target): it owns the `try/catch → block` and is the sole place the internal `GateOutcome` is translated to the SDK result shape.
  Insight that motivated it: "allow" is the implicit default at five separate exits, and the SDK's `emitToolCall` (unlike `emitUserBash`) does not catch a throwing handler.
- `handleToolCall` now returns the internal total `GateOutcome` (already defined in `gates/types.ts`); the `reporter` moved to the boundary, so the handler constructor does not widen.
  Cost: a mechanical ripple through `tool-call*.test.ts` assertions, folded into the A1 step.
- Added A5: a `DecisionAudit` collaborator (per-session counters) + `debugLog`-gated per-call trace + `session_shutdown` summary, so an evaluated-and-allowed call is distinguishable from a never-evaluated one without hand-reconciling logs.
  Review log stays quiet on allow (no churn).
- Added totality tests: a metamorphic `cd X && <cmd>` no-weaker property (pins A3) and a boundary contract test (throw → block; pins the SDK assumption).
- Deliberately did **not** add a separate parser health signal (redundant — init failure surfaces via the boundary's `gate_error`) and deferred full session-JSONL reconciliation and a first-class `ask` `GateOutcome` variant to follow-ups.
- Plan grew from 5 to 6 TDD steps; A5 flagged as separable, but the A1 boundary is the structural keystone and stays in #452.
- Behavior-changing pieces (A1 boundary block-on-error, A3 ask-on-unparseable) are breaking (`fix!:` + `BREAKING CHANGE:` footer) with a verified opt-out (`"bash": { "*": "allow" }`).
- Next: `/tdd-plan` — six red→green→commit steps.
