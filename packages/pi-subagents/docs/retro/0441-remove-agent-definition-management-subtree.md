---
issue: 441
issue_title: "pi-subagents: remove the orphaned agent-definition management subtree"
---

# Retro: #441 — pi-subagents: remove the orphaned agent-definition management subtree

## Stage: Planning (2026-06-23T00:00:00Z)

### Session summary

Produced a deletion-only plan for Phase 19 Step 6: `git rm` the orphaned creation wizard, config editor, and their two file-ops helpers (plus tests), prune `test/helpers/ui-stubs.ts` to just `makeMenuUI`, and update the two current-state docs.
Verified against `main` that the five modules are pure orphans (no `src/` importer, `index.ts` clean) and that this is the unreleased tail of release batch "dissolve-agents".
The plan routes to `/build-plan` (no test cycles) with two commits.

### Observations

- Two deviations from the issue body, both forced by the codebase + the authoritative architecture doc rather than by preference, so no `ask_user` gate was used:
  1. `menu-ui.ts` (the `MenuUI` interface) must also be deleted — it is orphaned by the same cut, and `architecture.md` lines 346/1076 explicitly schedule its removal under #441.
     The issue body omits it.
  2. `makeMenuManager` is removed whole, not just its `spawnAndWait` field — after the four test files go, its only consumer is its own self-test, so it is residual clutter.
     The architecture doc's "if no surviving consumer remains" phrasing licenses this.
- `ui-stubs.ts` survives because `makeMenuUI` still has a real consumer (`subagents-settings.test.ts`); only the three other helpers (and the private `DEFAULT_TEST_AGENT_CONFIG` + the `AgentConfig` import) are pruned.
- Commit type is `refactor(pi-subagents):`, not `feat!:` — deleting already-unreachable code changes no observable behavior at this step.
  The release is driven by Step 5's unreleased breaking `feat!:` (`cb813f2c`, after tag `pi-subagents-v17.5.0`); landing this tail lets release-please cut the major bump.
- Production duplication goes to zero when `agent-config-editor.ts` is deleted (the 11-line `disableAgent`/`ejectAgent` clone); pin with `pnpm fallow dupes`.
- Historical docs under `docs/plans/`, `docs/retro/`, and `docs/architecture/history/` mention the deleted modules only as records of completed phases — left untouched per convention; only `architecture.md` current-state and `SKILL.md` are updated.

## Stage: Implementation — Build (2026-06-23T17:00:00Z)

### Session summary

Executed the two-commit plan: `git rm` the five orphaned `src/ui/` modules and four test files in one atomic commit; pruned `test/helpers/ui-stubs.ts` and `ui-stubs.test.ts` to `makeMenuUI` only in the same commit.
Second commit updated `architecture.md` (directory tree, Step 6 ✅ and Landed note, Mermaid node) and `SKILL.md` (UI domain row 11→6).
Three additional doc-fixup commits addressed stale `architecture.md` prose (domain flowchart, cross-extension diagram, "What the core owns," "Composition model") deferred from #442.
All checks green: 62 test files / 950 tests, `fallow dead-code` clean, `fallow dupes` shows 0 production clone groups.

### Observations

- The pre-completion reviewer surfaced five stale `architecture.md` sections not covered by the plan's declared doc scope — all carried over from #442's retro note "Deferred the holistic architecture-doc refresh … to the batch tail [#441]."
  Required three extra doc-fixup commits (`e440d0d1`, `04b13812`, and the SKILL.md file-count fix) beyond the plan's two.
  **Lesson:** when a retro note explicitly defers a doc refresh to the batch tail, include it in the batch-tail plan's "Module-Level Changes" doc section so it isn't discovered only by the reviewer.
- `makeMenuManager` was removed whole (not just its `spawnAndWait` relay) because its only post-cut consumer was its own self-test — exactly the right call, consistent with the planning decision.
- Final file count in `src/`: 57 (was 58 in SKILL.md header; now corrected).
- Pre-completion reviewer: **PASS** (third dispatch, after two WARN rounds on the stale doc sections).
