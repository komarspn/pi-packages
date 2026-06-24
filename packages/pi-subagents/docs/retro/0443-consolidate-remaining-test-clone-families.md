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
[#442]: https://github.com/gotgenes/pi-packages/issues/442
