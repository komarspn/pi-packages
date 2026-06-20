---
issue: 444
issue_title: "pi-subagents: shrink the agent widget to background runs only"
---

# Retro: #444 — pi-subagents: shrink the agent widget to background runs only

## Stage: Planning (2026-06-20T18:47:05Z)

### Session summary

Produced a numbered implementation plan for Phase 19 Step 3: shrink `AgentWidget` to background agents only by funneling both `manager.listAgents()` call sites (`update()` and `renderWidget()`) through a single private `listBackgroundAgents()` accessor that applies `record.invocation?.runInBackground === true` once at the source.
Confirmed the change is single-package (`pi-subagents`), non-breaking, and `Release: independent` per the architecture roadmap.

### Observations

- Issue author is the operator (`gotgenes`) and the proposed change is unambiguous, so the `ask-user` gate was skipped.
  The design is a legitimate improvement (removes the two-site duplication and fixes the latent inconsistency), not procedure-splitting.
- `widget-renderer.ts` needs **no** code change — it has no foreground-specific path; filtering at the data source in `agent-widget.ts` is sufficient.
  Listed in Module-Level Changes only to record the verification.
- Key risk is mass test breakage: the existing `update()`-driven fixtures (two `makeWidget` helpers + the projection test's `createTestSubagent`) would all be filtered out once the predicate lands.
  Mitigated with a tidy-first TDD step 1 that adds `invocation: { runInBackground: true }` to fixtures while the filter does not yet exist (inert), so step 2 only adds new tests.
- `assembleWidgetState` pure-function tests are unaffected — they call the function directly with `AgentSummary[]`, bypassing the accessor.
- Verified `clearWidget`'s stale-purge has no regression: foreground agents are never seeded into `finishedTurnAge`, so purging against the background-only list is correct.
- Doc grep surfaced one stale prose line (`README.md:64` "showing all active agents"); SKILL.md and `comparison-with-upstream.md` references remain accurate.
- Deferred (Open Question): relabeling the widget heading `Agents` → `Background agents` — out of scope for this issue.

## Stage: Implementation — TDD (2026-06-20T19:47:34Z)

### Session summary

Executed all three planned TDD cycles plus one reviewer-driven cleanup: (1) `test:` migrated the `agent-widget.test.ts` fixtures to a background invocation, (2) `feat:` added the private `listBackgroundAgents()` accessor and routed both `update()` and `renderWidget()` through it, (3) `docs:` updated `README.md` and marked roadmap Step 3 ✅.
Test count went from 24 to 26 in `agent-widget.test.ts` (two new background-only filtering tests); full pi-subagents suite is 1064 passing.

### Observations

- The tidy-first fixture migration worked exactly as planned — adding `invocation: { runInBackground: true }` was inert (suite stayed green) until the filter landed, so step 2 was a pure addition with no fixture churn.
- New-test fixtures default the shared `makeWidget` helper to background invocation via `{ invocation: { runInBackground: true }, ...a }`, letting per-agent `invocation` override for the mixed/foreground cases in the new `describe` block.
- `widget-renderer.ts` needed no change, as the plan predicted — the filter at the single `listBackgroundAgents()` funnel is sufficient.
- Pre-completion reviewer: PASS.
  One non-blocking naming WARN — `clearWidget`'s `allAgents` parameter and JSDoc were stale after the refactor (it now receives only background agents); fixed in a follow-up `refactor:` commit (`backgroundAgents`).
  Landed as a separate commit rather than amending the feat commit because HEAD was already the `docs:` commit and the fix must not land in a `docs:` commit.
- All gates green: `pnpm run check`, root `pnpm run lint`, full vitest (1064), `pnpm fallow dead-code`.
