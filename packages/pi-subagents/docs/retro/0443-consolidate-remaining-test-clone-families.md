---
issue: 443
issue_title: "pi-subagents: consolidate remaining test clone families"
---

# Retro: #443 — pi-subagents: consolidate remaining test clone families

## Stage: Planning (2026-06-23T00:00:00Z)

### Session summary

Planned Phase 19 Step 7 (test-clone consolidation) for `pi-subagents`.
Re-ran `fallow dupes` against current `main` and found the live state diverged from the issue's Phase-18-era snapshot: line numbers shifted after the terminal cut ([#441]/[#442]) and new Phase-19 UI test files added clones the issue never named.
Wrote `packages/pi-subagents/docs/plans/0443-consolidate-remaining-test-clone-families.md` and committed it.

### Observations

- The issue is the operator's own, but the proposed "extract a shared fixture" list was substantially invalidated by live evidence: several named targets (`resolveSpawnConfig`, `assembleSessionConfig`, `schedule`) are the repeated *system-under-test act*, which the `testing` skill says not to wrap to clear a clone metric.
- `ask_user` gate settled two decisions: **guardrail-first** (leave act-clones, extract only genuine fixtures) and **full live set** (include the new Phase-19 UI clones, notably the byte-identical `makeNavigable` factory duplicated across `session-navigation.test.ts` and `session-navigator.test.ts`).
- Eight genuine extraction targets identified; clearing them drops the count from 16 to 8 — below the issue's `≤ 10` target — without wrapping any act.
  The four primary UI/lifecycle extractions alone reach 10.
- Six residual families are documented as intentional act-clones in Non-Goals so a future fallow pass reads them as deliberate, not oversight.
- Convention confirmed: cross-file helpers go in `test/helpers/<name>.ts` (imported via `#test/helpers/<name>`) with a companion `<name>.test.ts`; single-file helpers stay local.
- Invariants at risk flagged: the `#423` reactive-consumer assertion in `session-navigator.test.ts` must stay in the test body (not absorbed by the `renderCapturedOverlay` helper), and the resume-events emitter must preserve exact usage/compaction payloads.
- `Release: independent` — ships on its own; no batch coupling.

[#441]: https://github.com/gotgenes/pi-packages/issues/441

## Stage: Implementation — TDD (2026-06-23T22:45:00Z)

### Session summary

Executed all 7 TDD steps: extracted `makeNavigable` (shared `test/helpers/make-navigable.ts`) and `emitResumeUsageAndCompaction` (shared `mock-session.ts`), plus local helpers for `makeWidget`, `renderCapturedOverlay`, `seedResultConsumedObserver`, `makeReadySubagent`, and `preparedBracket`, then reconciled the architecture Step 7 Outcome.
Test count went from 950 to 953 (+2 from the `make-navigable` companion, +1 from the `mock-session` case); 63 test files.
The full suite, `pnpm run check`, root `pnpm run lint`, and `pnpm fallow dead-code` are all green.

### Observations

- Clone count dropped from 16 to 9 — the issue's `≤ 10` target was met, but the plan's *predicted* 8 missed by one.
  `dup:ea0a1bce` was pre-classified as captured-overlay boilerplate; once `renderCapturedOverlay` extracted the boilerplate, the surviving fingerprint proved to be the `evicted` arrange + the `SessionNavigatorHandler.handle` SUT act — an act-clone.
  Per the operator's guardrail-first decision, it was left intact and documented rather than wrapped.
  Treated as a documented deviation, not a re-decision, because the governing guardrail (leave act-clones) was already chosen in planning.
- All 9 residual families are genuine repeated SUT calls (`resolveSpawnConfig`, `assembleSessionConfig`, `schedule`, `handle`, `spawnBg`+`await`, `agent.run()`, `execute`) — recorded in the plan's Non-Goals.
- `makeNavigable` was byte-identical across the two UI files (verified with `diff`), so the shared extraction was a pure lift; the `NavigableSubagent` type import had to stay in `session-navigation.test.ts` (still used at line 91) but was removed from `session-navigator.test.ts`.
- The cross-file `dup:5d8dbd48` only cleared after *both* halves (manager + subagent resume tests) adopted `emitResumeUsageAndCompaction` — split across Steps 4 and 5.
- Pre-completion reviewer: PASS (deterministic checks green; all three plan invariants verified held; residual act-clones confirmed legitimate).

[#442]: https://github.com/gotgenes/pi-packages/issues/442
