---
issue: 973
issue_title: "Add a purpose-built test-running tool so TDD cycles stop hand-assembling vitest shell chains"
---

# Run Vitest unpiped instead of hand-assembling filter chains

## Release Recommendation

**Release:** ship independently

The change touches only `.pi/skills/testing/SKILL.md` and `.pi/prompts/tdd-plan.md`, which sit outside every package's release scope, so nothing is released.

## Problem Statement

During TDD, the agent wraps nearly every test run in a hand-built chain, such as `vitest run <file> >/tmp/t.log 2>&1; grep -E "×|Tests " /tmp/t.log`, and often pairs it with `run check` and a `cp` backup for a killing mutation.
Each piece encodes a rule the agent must remember: keep the exit status, filter the log, run from the root with `--filter`.
The issue proposed a purpose-built tool to take that composition off the agent.

Planning measured what the chain is compensating for, and found that most of it compensates for nothing.
Under Pi's bash tool, Vitest 4.1.11 already prints a short summary.
The agent filters output that is already compact, and the filter (`| tail`, `| grep`) is what loses the exit status.

## Goals

- State in the `testing` skill that a bare Vitest run is already short and keeps its exit status, and make the bare command the default.
- Replace the `testing` skill bullet that sends the agent to "read the unfiltered `tail`" of a failure.
  That bullet currently legitimizes the pipe.
- Give the agent the narrowing tools that replace filtering: `-t <name>` to scope a run, and `&&` to pair a run with `check` without losing either status.
- Point `/tdd-plan`'s Red step at the unpiped run.

This is non-breaking: guidance only, with no code or config default changed.

## Non-Goals

- **A test-running tool, in any form** (project-local extension, private workspace package, or published package).
  The operator chose docs-only at the planning gate.
  Principle 5 applies: the measured output is already compact, so a mechanism would buy only shorter *failure* output and a structural mutation restore.
  Revisit only if those recur (see Open Questions).
- **Changing the killing-mutation backup rules** in `tdd-plan.md` (lines 100–106).
  The `cp`-in-its-own-tool-call rule that addresses the #962 race landed on 2026-09-24 (`299b2925`, the #609 retro), after #962's session.
  Nothing has shown it insufficient yet.
- **The redirect rule in `git-workflow` (line 33) and `ship.md` (lines 116–117)** (`>/tmp/x.log 2>&1 || tail -30`).
  It governs `lint`, `check`, and `commit`, whose output can be long; it stays correct and unchanged.
  The Vitest guidance below is the narrower rule for a command whose output is already short.
- Folding lint (Biome, ESLint, `rumdl`) into any test-running path.

## Background

Measurements taken during planning (all measured, 2026-09-29, Vitest 4.1.11, from the repo root through Pi's bash tool):

| Run                                                                  | Lines | Bytes | Exit |
| -------------------------------------------------------------------- | ----- | ----- | ---- |
| `pi-nocd` single file, passing                                       | 9     | 239   | 0    |
| `pi-permission-system` full suite (172 files, 4824 tests), passing   | 9     | 268   | 0    |
| `pi-nocd` single file, 6 of 11 failing (injected mutation, reverted) | 131   | 4724  | 1    |
| `pnpm --filter @gotgenes/pi-nocd run check`, passing                 | 1     | 15    | 0    |

A passing run prints no per-file lines, only the `Test Files` / `Tests` summary.
The output is identical with `AI_AGENT` and `PI_CODING_AGENT` unset, so the compactness comes from the non-TTY stdout rather than Vitest's `agent` reporter (which `std-env`'s `isAgent` would also select, since Pi sets `AI_AGENT=pi` in `packages/coding-agent/src/cli/setup.ts`).
A failing run prints one `×` line per failing test, then each failure's assertion message, Expected/Received diff, and a code frame (about 20 lines per failure), then the summary.

Transcript survey of the root-cwd session directory (994 files, measured with `grep` over `"command":"…vitest run…"`):

| Pattern within a `vitest run` bash command             | Count |
| ------------------------------------------------------ | ----- |
| All `vitest run` commands                              | 3306  |
| piped to `\| tail`                                     | 2356  |
| piped to `\| grep`                                     | 774   |
| redirected to `/tmp`                                   | 181   |
| also running `run check`                               | 305   |
| also doing a `cp`/`checkout`/`stash` backup or restore | 72    |
| using `-t`/`--testNamePattern`                         | 27    |

The dominant pattern is `| tail`, which makes the pipeline's exit status `tail`'s (always 0).

Existing guidance:

- `.pi/skills/testing/SKILL.md` `## Running tests` gives the bare commands but never says the output is already short.
  Its last bullet says to re-run a failing file and "read the unfiltered `tail`", which endorses the pipe.
- `.pi/prompts/tdd-plan.md` line 82 (Red step) gives the bare command without saying to leave it unpiped.
- `.pi/skills/git-workflow/SKILL.md` line 33 and `.pi/prompts/ship.md` lines 116–117 give the redirect-then-`tail` idiom for long-output gates.
  Agents plausibly generalize it to Vitest, where the redirect is unnecessary.

## Design Overview

This is a docs change in two files.
The rule has three parts:

1. **Run Vitest bare.**
   Its summary is already short (9 lines for a 4824-test suite), and a bare call keeps the exit status.
   No `| tail`, no `| grep`, no `/tmp` redirect.
2. **Narrow the run, not the output.**
   Scope with a file path and `-t "<name>"` rather than filtering the log; a failing run's detail (about 20 lines per failure) is the signal the agent needs.
3. **Chain with `&&`.**
   `vitest run <file> && pnpm --filter … run check` keeps both statuses and skips the typecheck when tests fail.

### Replacement text for `.pi/skills/testing/SKILL.md` `## Running tests`

The first two bullets stay.
Insert after them:

```markdown
- Run Vitest bare — no `| tail`, `| grep`, or `>/tmp/…` redirect.
  Its non-TTY summary is already short (measured: 9 lines for `pi-permission-system`'s 4824-test suite), and a pipe replaces Vitest's exit status with the filter's, so a failing run reads as a pass.
  A failing run adds one `×` line per failing test and about 20 lines of assertion detail per failure; that detail is the signal, so narrow the run instead of the output: pass the test path, and `-t "<name>"` for one test.
- Pair a run with the typecheck using `&&`: `pnpm --filter @gotgenes/<pkg> exec vitest run <test-path> && pnpm --filter @gotgenes/<pkg> run check` keeps both exit statuses and skips `check` when a test fails.
```

Replace the last bullet (the one telling the agent to read the unfiltered `tail`) with:

```markdown
- When a multi-file run reports a failure, re-run the failing file alone, unpiped — a `grep`/`sed` filter over Vitest output often matches nothing and prints empty, which reads as "no failure" rather than "wrong filter".
```

At write time, use the colon alternative from the `markdown-conventions` em-dash guidance if the em-dash does not emit cleanly.

### Replacement text for `.pi/prompts/tdd-plan.md` line 82

```markdown
   Run only the affected test file, unpiped: `pnpm --filter @gotgenes/<pkg> exec vitest run <test-path>` and confirm failures (plain `pnpm vitest run` fails at the repo root in this workspace; a `| tail` or `| grep` replaces Vitest's exit status with the filter's).
```

## Module-Level Changes

- `.pi/skills/testing/SKILL.md`: in `## Running tests`, add two bullets (bare run, `&&` pairing) and reword the last bullet, as drafted above.
- `.pi/prompts/tdd-plan.md`: reword the Red step's run sentence (line 82), as drafted above.

Predicted unchanged, with the claim each prediction rests on:

- `.pi/skills/git-workflow/SKILL.md` line 33 and `.pi/prompts/ship.md` lines 116–117: the redirect idiom is correct for `lint`/`check`/`commit`, the commands they name.
  The Vitest rule is additive, not a contradiction.
- `.pi/prompts/tdd-plan.md` lines 100–106 (mutation backup): see Non-Goals.
- `.pi/prompts/build-plan.md`, `.pi/agents/pre-completion-reviewer.md`: they run `pnpm run test`/`check` at the root, not per-file Vitest chains.
- `AGENTS.md`: the Index already routes "write or debug a test" to `testing`; no new row is needed (admission test question 2).

## Test Impact Analysis

The prescribed commands are the testable surface.
Each was dry-run at planning time; `/build-plan` re-runs them as verification:

1. `pnpm --filter @gotgenes/pi-nocd exec vitest run test/working-directory-prompt.test.ts`: 9 lines, `Tests  11 passed (11)`, exit 0.
2. `pnpm --filter @gotgenes/pi-nocd exec vitest run test/working-directory-prompt.test.ts -t "heading marker"`: `Tests  1 passed | 10 skipped (11)`, exit 0.
3. `pnpm --filter @gotgenes/pi-nocd exec vitest run test/working-directory-prompt.test.ts && pnpm --filter @gotgenes/pi-nocd run check`: the Vitest summary, then `$ tsc --noEmit`, exit 0.
4. `pnpm --filter @gotgenes/pi-permission-system exec vitest run`: 9 lines, `Tests  4824 passed (4824)` at planning time (the count moves as tests land; the line count is the claim), exit 0.

The "9 lines" figure quoted in the skill text must match what command 4 prints at build time; re-measure it and update the literal if it moved.

## TDD Order

This plan has no test cycles; `/build-plan` executes it.

1. Edit `.pi/skills/testing/SKILL.md` `## Running tests` per the drafted text.
   Re-run commands 1–4 above and confirm the quoted figures.
   Commit: `docs: run Vitest unpiped instead of filtering its output (#973)`.
2. Edit `.pi/prompts/tdd-plan.md` line 82 per the drafted text.
   Commit: `docs: point the tdd-plan Red step at an unpiped Vitest run (#973)`.

Steps 1 and 2 may fold into one commit if `/build-plan` prefers; both are guidance for the same rule.

## Risks and Mitigations

- **Habit persists despite the guidance.**
  2356 of 3306 runs piped to `tail` while no rule told the agent to; prose may not dislodge it.
  Mitigation: the rule names the concrete failure (a pipe turns a red run green) rather than a style preference.
  The `/retro` feedback-loop lens will surface recurrences.
  A `pi-permission-system` deny rule on `vitest run*| tail` is a possible escalation, like the existing `rg -r` tripwire, but it is deferred until the prose is shown to fail.
- **The "9 lines" figure drifts** if a Vitest upgrade changes the non-TTY summary.
  Mitigation: the skill states it as measured, and Test Impact command 4 re-measures it at build time.
- **Long failure output in a many-failure run** (about 20 lines per failure, measured) stays verbose.
  Accepted: `-t` and single-file scoping bound it, and it is the case the tool option would have addressed (Open Questions).

## Open Questions

- If later retros show failure-output volume or the mutation backup race recurring despite this guidance, revisit the tool options from the planning gate.
  The private workspace package with a built-in `mutation` parameter was the strongest candidate: apply, run, and restore in `finally` would retire the `tdd-plan.md` backup rules by construction.
  No follow-up issue is filed; the trigger is a recurrence, not a known gap.
