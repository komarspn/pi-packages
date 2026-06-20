---
issue: 448
issue_title: "`enabled: false` does not prevent explicitly spawning disabled agents"
---

# Retro: #448 — `enabled: false` does not prevent explicitly spawning disabled agents

## Stage: Planning (2026-06-20T00:00:00Z)

### Session summary

Planned the fix for a third-party bug report: `enabled: false` agent overrides are hidden from the available-types list but still spawnable when named explicitly via `subagent_type`.
The plan adds a disabled-type gate in `resolveSpawnConfig` (returning an explicit error) and a `enabled` filter in `buildTypeListText`, both localized changes with no new collaborators or interface changes.

### Observations

- Issue author (`nickadminroot`) is not the operator (`gotgenes`), so I ran the `ask-user` direction gate.
  Operator confirmed: fix it, **return an explicit error** (`Agent type "<Name>" is disabled`) rather than the lenient fall-back-to-`general-purpose` alternative, and **include both fixes** (spawn path + tool-description list).
- Root cause is `resolveType` → `resolveKey` ignoring `enabled`; the registry already has `isValidType` (checks `enabled`) but it was unused on the spawn path.
  The gate reuses `isValidType`, leaving `resolveType` / `resolveAgentConfig` untouched so UI consumers that intentionally resolve disabled configs keep working.
- Rejected changing `resolveType` or `resolveAgentConfig` directly — `agent-config-editor.ts` and `agent-menu.ts` rely on resolving disabled agents to display/edit/re-enable them.
- For the tool-description fix, chose to filter inside `buildTypeListText` rather than re-define `getDefaultAgentNames` / `getUserAgentNames` semantics; those two methods have `buildTypeListText` as their sole consumer (verified by grep), but keeping their meaning intact is cleaner.
- Classified as non-breaking `fix:` — the change aligns code with the documented README/registry contract; explicit spawning of a disabled agent was undocumented buggy behavior.
- Not in any architecture roadmap step (no `#448` reference in `docs/`), so **ship independently**.

## Stage: Implementation — TDD (2026-06-20T12:40:00Z)

### Session summary

Completed 2 TDD cycles and all post-step verification gates.
Step 1 added a 3-line enabled-type gate in `resolveSpawnConfig` (reusing `isValidType`) and 2 new test cases in `test/tools/spawn-config.test.ts`.
Step 2 added an `isEnabled` predicate filter in `buildTypeListText` and 2 new test cases in `test/tools/helpers.test.ts`.
Test count delta: 1047 → 1051 (+4).

### Observations

- No deviations from the plan.
  Both changes were as small as designed: 3 lines in `spawn-config.ts`, 2 lines in `helpers.ts`.
- Extended the `makeRegistry` stub's `resolve` type in `test/tools/helpers.test.ts` to include an optional `enabled` field, so the `isEnabled` predicate could be exercised without touching production code.
- The `makeAgentConfig` helper was added to `test/tools/spawn-config.test.ts` (mirroring the pattern in `test/config/agent-types.test.ts`) rather than importing from a shared fixture, since the existing spawn-config test fixture infrastructure didn't need modification.
- All three plan-enumerated cross-step invariants held green throughout: `resolveAgentConfig` disabled-config behavior, unknown-type fallback, and `getAllTypes` disabled-agent listing.
- Pre-completion reviewer: **PASS** — all deterministic checks, code design, test artifacts, and cross-step invariants clean.
