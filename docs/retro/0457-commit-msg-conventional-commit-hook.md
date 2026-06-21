---
issue: 457
issue_title: "Add a commit-msg hook to validate Conventional Commit headers"
---

# Retro: #457 — Add a commit-msg hook to validate Conventional Commit headers

## Stage: Planning (2026-06-21T00:00:00Z)

### Session summary

Planned a repo-root `commit-msg` hook that validates Conventional Commit headers via `@commitlint/cli` + `@commitlint/config-conventional`, wired through the existing `prek` framework.
The plan rejects the malformed `type!(scope):` form (which mis-versioned #452) while accepting `type(scope)!:` and bare `type!:`, using the default config-conventional parser with no custom `type-enum`.
Filed as a repo-root plan (`docs/plans/0457-…`) since the change touches only root tooling and no package source; next step is `/build-plan`.

### Observations

- The `pkg:pi-permission-system` label is incongruent — confirmed with the operator that this is monorepo infra, not a package change, so it lives in the top-level `docs/plans/`.
  The label was applied because the motivating incident (#452) was a permission-system release.
- Verified the default `@commitlint/config-conventional` `type-enum` is identical to release-please's `changelog-sections` types (`feat`, `fix`, `perf`, `revert`, `docs`, `style`, `chore`, `refactor`, `test`, `build`, `ci`) — so the hook and release tooling agree with no custom type list.
- The malformed `fix!(scope):` form fails the conventional header pattern (the `!` breaks the `(scope)` and `:` anchors), so commitlint reports `type-empty`/`subject-empty` — exactly the desired rejection, no custom rule needed.
- Key friction decision: raised `header-max-length` from the default 100 to 120 (operator-confirmed) because the repo's longest real subject is 101 chars and several sit at 100 — long package scopes plus `(#NNN)` refs eat the budget.
- `prek` supports the top-level `default_install_hook_types` key, so adding `["pre-commit", "commit-msg"]` makes the existing `prepare` → `prek install` install both shims with no script change.
- Worktree gotcha captured in the plan: the hook must pass the real commit-message file path (prek's `commit-msg` candidate filename), not rely on commitlint's `.git/COMMIT_EDITMSG` fallback, because the repo's worktree workflow makes `.git` a file pointing at a separate gitdir.
- Scope left free-form (no `scope-enum`), operator-confirmed — catching scope typos is out of scope for the `!`-placement bug and would risk false rejections on no-scope root commits.
- Flagged `fallow dead-code` as a risk: the new root devDeps are tooling-only (referenced by `prek.toml`/config, not imported by TS), but existing CLI-only root devDeps (biome, rumdl, fallow) are not flagged, so commitlint should follow suit — `.fallowrc.json` `ignoreDependencies` is the fallback.
- Structured as a build plan (no red→green cycles); correctness is confirmed by piping sample headers through `commitlint` and linting a window of real history (`--from=HEAD~30 --to=HEAD`).
