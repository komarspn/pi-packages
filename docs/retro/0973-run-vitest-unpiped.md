---
issue: 973
issue_title: "Add a purpose-built test-running tool so TDD cycles stop hand-assembling vitest shell chains"
---

# Retro: #973 — Add a purpose-built test-running tool so TDD cycles stop hand-assembling vitest shell chains

## Stage: Planning (2026-09-29T05:59:29Z)

### Session summary

Measured Vitest's real output under Pi's bash tool before choosing a form: a passing run is already 9 lines, even for `pi-permission-system`'s 4824-test suite, so the hand-built filter chains compensate for nothing.
The operator chose docs-only at the gate over a project-local extension, a private workspace package, and a published package.
The plan (`docs/plans/0973-run-vitest-unpiped.md`) rewrites the `testing` skill's `## Running tests` and the `/tdd-plan` Red step to prescribe an unpiped run, `-t` narrowing, and `&&` pairing with `check`.

### Observations

- Transcript survey (994 root-cwd sessions): 3306 `vitest run` commands, 2356 piped to `| tail` (exit status masked), 774 to `| grep`, 181 redirected to `/tmp`, 72 with a mutation backup/restore.
- The compact output comes from non-TTY stdout, not only Vitest's `agent` reporter: output was identical with `AI_AGENT`/`PI_CODING_AGENT` unset.
- A failing run is about 20 lines per failure (131 lines for 6 failures, measured); that is the one real verbosity the docs-only route accepts.
- The #962 backup race is already covered: the `cp`-in-its-own-tool-call rule landed in `tdd-plan.md` on 2026-09-24 (`299b2925`), after #962.
- Rejected the tool options under principle 5; the strongest candidate, recorded in the plan's Open Questions, is a private workspace package with a built-in `mutation` parameter (apply, run, restore in `finally`).
  Also noted: `.pi/**` is excluded from ESLint and has no tsc or Vitest coverage, so a project-local extension would ship untested.
- The `git-workflow` and `ship.md` redirect-then-`tail` idiom is predicted unchanged; it is correct for long-output gates and plausibly what agents over-generalize to Vitest.
- No follow-up issue filed; the trigger to revisit is a recurrence in later retros.

## Stage: Implementation — Build (2026-09-29T06:07:31Z)

### Session summary

Both plan steps landed as separate commits: two new bullets plus a reworded failure bullet in `.pi/skills/testing/SKILL.md` `## Running tests`, and an "unpiped" Red-step sentence in `.pi/prompts/tdd-plan.md`.
The four Test Impact commands were re-run before committing and reproduced the plan's figures (9 lines, 4824 tests, `-t` narrowing, `&&` pairing).

### Observations

- No deviations from the plan; the drafted text went in verbatim and the em-dashes emitted cleanly.
- Baseline and per-step `pnpm run lint` passed; no `.ts`, `src/`, or `test/` files were touched, so `check` and the full suite were not required.
- Pre-completion reviewer: PASS; it independently re-ran all four commands and confirmed the `git-workflow`/`ship.md` redirect idiom does not contradict the new guidance.

## Stage: Final Retrospective (2026-09-29T06:15:50Z)

### Session summary

One trunk session covered planning, build, ship, and retro.
The planned tool became a two-file docs change: the `testing` skill and the `/tdd-plan` Red step now prescribe an unpiped Vitest run.
CI passed on `d9895568`, #973 closed, and nothing released because every changed file sits outside `packages/`.

### Observations

#### What went well

- Measuring before designing changed the deliverable.
  Real Vitest runs, including a failure produced by injecting and reverting a mutation, showed the output was already compact (9 lines for a 4824-test suite).
  A `grep` over 994 session transcripts showed the actual defect: 2356 of 3306 `vitest run` commands piped to `| tail`, which masks the exit status.
  The issue framed the problem as composition burden; the evidence pointed to a habit that loses the exit status.
- The session transcript corpus worked as design evidence for a workflow issue; this is the first time it was used that way on a tooling request rather than for a retro lens.
- The plan drafted the exact replacement text and dry-ran every prescribed command.
  `/build-plan` applied the text verbatim, and the reviewer reproduced all four figures independently.

#### What caused friction (agent side)

- `premature-convergence` — the planning gate marked "Private workspace package" as recommended, even though the substance message itself showed a bare run already meets the issue's three desired behaviors and cited principle 5.
  The operator chose docs-only.
  Impact: none on artifacts; the recommendation pointed away from the answer the evidence supported.
- `other` — two mutations used to build a failure sample survived, because the `pi-nocd` tests assert through the exported constant; a third mutation produced the failures.
  Impact: 2 extra tool calls.
- `other` — a self-composed gate idiom, `cmd >log 2>&1; rc=$?; echo rc=$rc; [ $rc -ne 0 ] && tail …`, exits 1 when the gate passes, so the tool reported `error` on four passing runs (build baseline lint, ship lint, ship `fallow dead-code`).
  `git-workflow`'s own recipe (`cmd >log 2>&1 || tail -30 log`) exits cleanly.
  Impact: noise only; each run was read correctly from `rc=0`.
- `instruction-violation` (self-identified) — in `/ship` step 9 the agent (`claude-sonnet-5`) ran `git log "$PLAN"^..HEAD` without the block's own `PLAN=$(…)` line, which failed in a fresh shell.
  The `shell-traps` fresh-shell rule and the `ship.md` step 9 block already cover this.
  Impact: 1 failed call, retried with the SHA inlined.

#### What caused friction (user side)

- The operator's gate answer left the two conditional questions (mutation, typecheck) unanswered, which was correct because docs-only made them moot.
  Bundling questions that are conditional on the first one cost nothing here, but a two-step gate would have avoided presenting them at all.

### Diagnostic details

- **Model-performance correlation:** planning, build, and retro ran on `anthropic/claude-opus-5-5`; ship ran on `anthropic/claude-sonnet-5`, a fit for mechanical gates.
  The `pre-completion-reviewer` ran on `claude-sonnet-5` (from its own transcript) and re-derived every figure, so there was no mismatch.
- **Feedback-loop gap analysis:** no gap.
  `pnpm run lint` ran at the build baseline and after each step, and the prescribed commands were re-run before the first commit.

#### Follow-up measurement

The effect of this change is measurable with the planning survey: count `vitest run` commands piped to `| tail` in sessions dated after 2026-09-29.
If the share stays near the measured 71% (2356 of 3306), the prose did not dislodge the habit.
The plan's Risks section names a `pi-permission-system` deny rule as the escalation.

### Changes made

1. `.pi/skills/clarification-gates/SKILL.md` (`## The option space`): added one sentence requiring that `recommended` mark the option the gate's own substance supports, and that recommending a mechanism over a sufficient no-mechanism option name the gap it closes.
