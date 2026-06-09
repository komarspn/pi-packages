---
issue: 360
issue_title: "fix(pi-subagents): custom agents default to replace mode instead of append"
---

# Retro: #360 — fix(pi-subagents): custom agents default to replace mode instead of append

## Stage: Planning (2026-06-09T02:42:19Z)

### Session summary

Planned the one-line fix flipping the `promptMode` ternary in `custom-agents.ts` so custom agents without an explicit `prompt_mode` default to `append` (matching the built-in default) instead of `replace`.
Enumerated the full change surface: the source line, two existing tests in `test/config/custom-agents.test.ts`, the wizard frontmatter doc comment, and the `README.md` defaults table.

### Observations

- The issue's proposed fix is unambiguous, so no `ask_user` round was needed.
- `grep` confirmed the only default-asserting tests live in `test/config/custom-agents.test.ts`; the broader upstream regression suite uses explicit `promptMode` values and is unaffected.
- Unknown `prompt_mode` values (e.g. `merge`) now resolve to `append` rather than `replace` — flagged as the safer fallback (inheriting a superset of context rather than silently dropping project context).
- Source fix and test updates are coupled into one TDD cycle because the assertions and the changed line move together; docs split into a separate `docs:` commit.
- No `docs/architecture/` references to the default value exist; `CHANGELOG.md` is release-please-owned and untouched.
