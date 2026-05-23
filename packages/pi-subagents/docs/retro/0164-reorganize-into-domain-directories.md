---
issue: 164
issue_title: "refactor(pi-subagents): reorganize source into domain directories"
---

# Retro: #164 — refactor(pi-subagents): reorganize source into domain directories

## Stage: Planning (2026-05-23T00:00:00Z)

### Session summary

Read issue #164, confirmed #157 (import normalization) was a prerequisite and had been completed.
Explored the full `src/` and `test/` structure, mapped every relative import in the 26 files to be moved, and produced a four-commit plan that moves files domain-by-domain in dependency order.

### Observations

- Issue #157 removed `.js` suffixes and introduced `#src/*` aliases in `test/` files.
  This makes the reorganization cleaner: test imports are flat `#src/agent-manager` → `#src/lifecycle/agent-manager` with no depth variation.
- `lifecycle/` and `observation/` have a circular dependency (`agent-manager` ↔ `record-observer`), so they must be moved in a single commit (Step 3).
  All other domains can be committed independently.
- `vitest.config.ts` uses `"test/**/*.test.ts"` — test files in new subdirectories are
  auto-discovered without config changes.
- Three UI test files (`conversation-viewer.test.ts`, `display.test.ts`,
  `widget-renderer.test.ts`) are misplaced at `test/` root; left out of scope for this issue.
- No `default-agents.test.ts`, `context.test.ts`, or `execution-state.test.ts` exist —
  those src modules have no dedicated test files.
- The import tables in the plan enumerate every path change; `pnpm run check` will catch
  any missed update before each commit.

## Stage: Implementation — TDD (2026-05-23T16:55:00Z)

### Session summary

Executed all four plan steps (config, session, lifecycle+observation, service) plus a fifth unplanned step converting all `src/` internal imports to `#src/` aliases.
All 50 test files and 805 tests pass throughout.
Updated `docs/architecture/architecture.md` to reflect the completed restructuring.

### Observations

- The plan's consumer tables were mostly complete but missed a few files: `src/ui/widget-renderer.ts` and `src/session-config.ts` (still at root during step 1) both imported `agent-types`; `src/service-adapter.ts` imported `model-resolver`; `test/parent-snapshot.test.ts` had a `vi.mock("#src/context")` path.
  All caught immediately by `pnpm run check` or a failing test.
- `src/service-adapter.ts` and `src/service.ts` (still at root during step 3) imported `parent-snapshot` and `usage` which moved in that step, so they had to be fixed as part of step 3's commit rather than step 4's.
- The `#src/` alias conversion (fifth commit) was added after the user correctly observed that `src/` files should use the same alias style as `test/` files.
  This eliminates all `../` relative cross-directory imports from `src/`.
  Future file moves in `src/` now only require updating the `#src/domain/name` string — no relative depth arithmetic.
- Biome auto-fixed 14 files (import sorting / trailing whitespace) during the `#src/` conversion step; committed via `git add -A` after the pre-commit hook run.
