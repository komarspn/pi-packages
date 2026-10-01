---
issue: 935
issue_title: "Audit and prune the prompt templates and subagent definitions"
---

# Audit and prune the prompt templates and subagent definitions

## Release Recommendation

**Release:** ship independently

Every touched path is repo-root tooling: `.pi/prompts/`, `.pi/agents/`, `AGENTS.md`, `scripts/agent-docs/`, `test/agent-docs/`, and `docs/agent-docs-audit/`.
None ships in a package tarball, and no package roadmap references this issue, so it joins no batch and cuts no release.

## Problem Statement

[#934] audited `AGENTS.md` and the skills, wrote the admission test, and added `/audit-agent-docs`, but it deferred the prompt templates and subagent definitions to this issue.
The issue asks for the same audit-and-prune pass over those two classes.
It raises two scope questions: does invocation-time cost need its own clause in the admission test, and does the `Refs #N` compression rule apply unchanged to templates?

The measurements taken at planning answer the first question in the opposite direction from the issue's premise.
Since [#937] shrank `AGENTS.md`, the templates and agent definitions cost more per month than the always-loaded file does.

## Goals

- `/audit-agent-docs` takes an optional corpus argument:
  - `docs` covers `AGENTS.md` and the skills;
  - `workflow` covers the prompt templates and subagent definitions;
  - no argument covers both.
  Each corpus writes its own inventory in the dated audit directory.
- The template states how the admission test's second question applies to each class.
  It also names the three shapes of `Refs #N` found in templates and says which one the compression rule governs.
- A new tested script, `scripts/agent-docs/invocation-volume.mjs`, reports body words × invocations per template and per agent over a window.
  This number is the `workflow` corpus's before/after, just as `always-loaded.mjs` provides the before/after for `docs`.
- `always-loaded.mjs` counts subagent descriptions, which the `subagent` tool's description loads into every session.
- `/retro` Step 7 applies the admission gate to template and agent additions, and its "leave a `Refs #N` pointer" clause is removed.
  That clause is the regrowth pump for this corpus.
- Run `/audit-agent-docs workflow` once in a fresh session and land the prune.
- Not breaking: nothing under `packages/` changes.

## Non-Goals

- No per-class clause in `AGENTS.md`'s admission test (operator decision at the design gate).
  The three questions stay as written; the per-class reading of question 2 lives in `/audit-agent-docs` and `/retro` Step 7, which are paid for only when invoked.
- Re-auditing `AGENTS.md` and the skills.
  The `docs` corpus stays available through the argument, but this issue's run is `workflow` only.
- Template and agent frontmatter (`model:`, `description:`, `tools:`).
  Model choice for the subagents belongs to [#969]; the audit reads and changes only bodies.
- The `unloaded-rule` retro lens and its count in `/audit-agent-docs` Step 1 belong to [#939].
  It edits the same template but a different step, and the two changes compose.
- A shared flag parser for the four `scripts/agent-docs/*.mjs` CLIs.
  The Tidy-First assessor rated it optional: each script derives its defaults differently, and the new script's `--since` default depends on `--until`.
- Making `model-usage.mjs`'s `DEFAULT_PREFIX` portable (deferred in [#934]'s planning; still deferred).
- A numeric budget for the workflow corpus.
  The first run records the number, as [#934] did for `docs`.

## Background

### What is being pruned (measured on HEAD, 2026-09-29)

| Class                | Files | Words (`wc -w`) | `Refs #N` citations                                            |
| -------------------- | ----- | --------------- | -------------------------------------------------------------- |
| Prompt templates     | 13    | 33,234          | `plan-issue.md` 60, `ship.md` 28, `tdd-plan.md` 14, others 0–9 |
| Subagent definitions | 3     | 5,663           | `pre-completion-reviewer.md` 4, others 0                       |

### Where each class's words are paid

Pi's `system-prompt.ts` lists skills only, so a template's `description:` never reaches the model.
Its body enters the session as the expanded user message at invocation and stays in context for the rest of the session.
An agent definition's `description:` is always loaded: `packages/pi-subagents/src/tools/agent-tool.ts` lists every agent type in the `subagent` tool's description.
Its body is the child's system prompt on every dispatch.
It is appended to the parent's prompt, because the default `prompt_mode` is `append` (`create-subagent-session.ts`, `custom-agents.ts:67`).
Children inherit the parent's skills, so an agent can load a skill the same way the parent does.

### Invocation volume (measured with a throwaway scan)

The scan read `~/.pi/agent/sessions/*pi-packages*` for session files dated 2026-08-29 onward, 282 sessions in all.
It matched a template when the first line of a user message equalled the template's H1, and an agent by the `subagent` call's `subagent_type`.
It ran in 0.8 s.
All 90 `plan-issue` matches were unique by `(timestamp, id)`, so forked sessions did not double-count them.

| File                      | Words | Invocations | Volume  |
| ------------------------- | ----- | ----------- | ------- |
| `plan-issue.md`           | 6,292 | 90          | 566,280 |
| `pre-completion-reviewer` | 2,841 | 126         | 357,966 |
| `ship.md`                 | 3,739 | 63          | 235,557 |
| `retro.md`                | 2,557 | 92          | 235,244 |
| `tdd-plan.md`             | 2,557 | 82          | 209,674 |
| `tidy-first-assessor`     | 1,593 | 82          | 130,626 |
| `sync-worktree.md`        | 1,094 | 66          | 72,204  |
| all other 9 files         | —     | —           | 66,467  |

The total is 1,874,018 words.
At its current 1,879 words, `AGENTS.md` loaded into the same 282 sessions would total about 530k.
The templates and agents therefore cost about 3.5× the always-loaded file, so invocation-time cost does not lower the bar for either class.

### The growth pump

38 of the last 60 commits to `.pi/prompts` and `.pi/agents` are `docs(retro):`, and 40 commits have touched them since 2026-09-17.
`/retro` Step 7 puts only `AGENTS.md` additions through the admission test.
Its item 1 also suggests that rationale leave behind "a `Refs #N` pointer", which contradicts the test's third question.
This is the same pump [#934] closed for `AGENTS.md`.

### Constraints that apply

- An edited template body is stale in the session that edits it, so the implementing session cannot run the extended `/audit-agent-docs`.
  The audit runs in a fresh session, exactly as [#934]'s step 10 did.
- `pi-autoformat` reflows every `Edit`, so each applied row re-reads its region before editing.
- Templates cross-reference numbered steps within a file (`ship.md`'s "steps 9 and 10") and across files (`/plan-improvements` Step 1, `/tdd-plan` step 7).
  A prune that removes a whole numbered item renumbers the rest and silently breaks those references.
- Four templates have no `## Load skills` section: `retro-note.md`, `ship-no-issue.md`, `ship.md`, and `sync-worktree.md`.
- `scripts/**/*.mjs` are `fallow` entry points, and the root `vitest.config.mjs` already includes `test/**/*.test.mjs`.

## Design Overview

### The admission test by class

The three questions are unchanged, and questions 1 and 3 read identically for every class.
Question 2 asks where a passage belongs; its reading per class goes into `/audit-agent-docs` as a new `## The admission test by class` section:

| Class            | A passage passes question 2 when…                                                                                      | When it fails                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AGENTS.md`      | it is needed before any workflow step has run, or it is an environment fact                                            | `offload → <skill>`                                                                       |
| Skill body       | it fires at the trigger the skill's description names                                                                  | `offload → <skill>`                                                                       |
| Prompt template  | it fires at this template's step and no skill the template loads already owns it                                       | `delete` (dup of `<skill>`) when the skill already says it; `offload → <skill>` otherwise |
| Agent definition | the child needs it and does not receive it from `AGENTS.md`, the dispatch prompt, or a skill the body tells it to load | as for templates                                                                          |

One duplication shape is not a duplicate.
A reviewer agent's check that mirrors an instruction a template gives the implementer is a second actor verifying the first, which is the point of the reviewer.
The verdict turns on whether the two passages address the same actor.

Invocation cost changes no verdict: a passage a current model does not need is waste wherever it is paid.
Cost changes the order of the walk and what the assessment reports, and the volume table puts `plan-issue.md` and `pre-completion-reviewer` first.

### The three shapes of `Refs #N`

1. **A provenance suffix**, such as `(Refs #883)`.
   The compress rule applies unchanged: the suffix survives only when the issue encodes an active constraint.
   The bulk-strip regex from [#934] (`s/ \(Refs #[0-9]+(, #[0-9]+)*\)//g`) matches this shape only.
2. **Syntax the template reads or writes**, such as `Refs #$1` in a commit body, "read the PR body for `Refs #N`", or `Refs #A, #Z`.
   This is an instruction, not a citation, so the rule does not reach it.
3. **An issue number as data**:
   - a sample row (the `triage-backlog.md` tables);
   - an example of shape (`finish-phase.md`'s `Feature issues [#736], [#720]`);
   - a pointer to a live artifact the step reads (`triage-backlog.md`'s `#639` open decision).
   These are kept as data.
   A pointer to a live artifact is kept only while the artifact is open.

An inline incident narrative ("#873's plan named `reload()`, but …") is a question-3 `compress` like any other story.

### `/audit-agent-docs` with a corpus argument

```text
/audit-agent-docs            → corpus "all"      (docs + workflow)
/audit-agent-docs docs       → AGENTS.md, .pi/skills/*/SKILL.md
/audit-agent-docs workflow   → .pi/prompts/*.md, .pi/agents/*.md
```

Any other value stops the run.

| Step                 | `docs`                                                                                                      | `workflow`                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Session name         | `Agent-doc audit — <date> (docs)`                                                                           | `Agent-doc audit — <date> (workflow)`                                                                            |
| Step 1 measure       | `always-loaded.mjs` → `always-loaded-before.txt`                                                            | `invocation-volume.mjs --until <date>` → `invocation-volume.csv`, and `--total` → `invocation-volume-before.txt` |
| Step 1 carry-forward | newest prior inventory whose `corpus:` covers `docs`; the legacy 2026-09-17 `inventory.md` counts as `docs` | newest prior inventory whose `corpus:` covers `workflow` (none on the first run)                                 |
| Step 2 walk          | as today                                                                                                    | each template, then each agent; `plan-issue.md` and `pre-completion-reviewer.md` get their own summary lines     |
| Step 3 inventory     | `inventory-docs.md`                                                                                         | `inventory-workflow.md`                                                                                          |
| Step 6 re-measure    | `always-loaded-after.txt`                                                                                   | `invocation-volume-after.txt`, run with the same `--until`                                                       |
| Step 6 `git add`     | `AGENTS.md .pi/skills/`                                                                                     | `.pi/prompts/ .pi/agents/` (plus `.pi/skills/` when an offload landed there)                                     |

`doc-growth.csv` and `model-usage.csv` are written for every corpus.

The inventory frontmatter gains `corpus: docs|workflow|all`.
Its header carries each measured corpus's before/after line.

Step 5 gains rules for templates and agents:

- **Never delete a whole numbered step or a heading in a prune.**
  Record such a row as `keep (revisit)` with the rationale "whole-step removal needs renumbering".
  Numbered steps are cross-referenced by number, both within files and across them.
- **Never edit frontmatter, an H1, or an argument placeholder** (`$1`, `$@`).
  The H1 is `invocation-volume.mjs`'s match key.
- **A template-to-skill `offload`** appends the passage to the skill.
  It also makes sure the template loads that skill:
  - a line in `## Load skills` when the template has one;
  - otherwise "load the `<skill>` skill" at the step that needs it.
- **An agent-to-skill `offload`** makes the agent body tell the child to load the skill at the point it applies.

Step 6 gains two checks:

- `grep -h '^# ' .pi/prompts/*.md` is identical before and after, which confirms no H1 moved.
- Every `Step N`/`step N` reference into an edited template still resolves.

The `AGENTS.md` admission test's closing pointer ("`/audit-agent-docs` applies this test to the whole file and the skills on demand") widens to name all four classes.
Its three questions are untouched.

### `invocation-volume.mjs`

```javascript
// scripts/agent-docs/frontmatter.mjs — new home for frontmatter parsing
export function frontmatterDescription(markdown); // renamed from always-loaded's skillDescription
export function markdownBody(markdown);           // text after the closing fence; whole text when no frontmatter

// scripts/agent-docs/invocation-volume.mjs — new
export function templateHeading(markdown);        // first "# " line of markdownBody(markdown), or ""
export function* invocations(lines, { since, until });
//   yields { kind: "template", key: <first line of a user message's text> }
//   and    { kind: "agent",    key: <subagent_type> } for a `subagent` toolCall with no `resume`
//   for entries whose ISO timestamp t satisfies since <= t < until (string compare on YYYY-MM-DD bounds)
export function volumeRows(files, events);
//   files: { kind, file, key, words }[]; events: Iterable<{ kind, key }>
//   → { kind, file, words, invocations, volume }[] sorted by volume desc; events matching no file are dropped
```

The CLI takes `--until YYYY-MM-DD` (exclusive; default today UTC) and `--since YYYY-MM-DD` (default 30 days before `--until`).
It also takes `--root`, `--sessions-dir`, and `--prefix`, the last two defaulting to `model-usage.mjs`'s now-exported constants.
Its output is either a CSV (`kind,file,words,invocations,volume`) or, with `--total`, the single line `templates=<n> agents=<n> total=<n>`, which follows `always-loaded.mjs`'s shape.
Words are `countWords(markdownBody(text))`, because frontmatter is never sent to the model.

The call site reads top-down and keeps each piece pure:

```javascript
const files = [...templateFiles(root), ...agentFiles(root)];         // { kind, file, key, words }
const events = transcriptPaths({ sessionsDir, prefix })
  .flatMap((p) => [...invocations(readFileSync(p, "utf8").split("\n"), { since, until })]);
const rows = volumeRows(files, events);
```

The template matching is keyed on the H1, so if a template's H1 changed inside the window, invocations under the old H1 are dropped.
The Step 5 rule above stops the audit from causing that drop, and a 30-day default window bounds the effect of an H1 changed by some other commit.

Import edges added: `invocation-volume → frontmatter, doc-growth, model-usage`, and `always-loaded → frontmatter`.
Neither `frontmatter.mjs` nor `model-usage.mjs` imports anything under `scripts/agent-docs/`, and `doc-growth.mjs` imports nothing from its siblings, so no cycle forms.

### `always-loaded.mjs` counts agent descriptions

`alwaysLoadedWords({ agentsMd, skillDescriptions, agentDescriptions })` returns `{ agentsMd, descriptions, agentDescriptions, total }`.
The CLI line becomes `agentsMd=… descriptions=… agentDescriptions=… total=…`.
The existing `descriptions=` field keeps its meaning (skill descriptions), so the 2026-09-17 README's quoted line still parses.
The predicted value on HEAD is `agentDescriptions=70` (measured with `wc -w` on the three description lines; `countWords` splits on the same whitespace).
The series takes a one-time +70 step at this commit.

### `/retro` Step 7

The gate paragraph widens from "each proposed `AGENTS.md` addition" to additions to `AGENTS.md`, a skill, a prompt template, or an agent definition.
It gains two lines giving the template and agent reading of question 2 from the table above.
The "44 of its last 60 commits" sentence is replaced by a count-free statement that this retro is where these files grow, so no hand-authored number goes stale.
Item 1's "(or a `Refs #N` pointer)" becomes a pointer kept only when the issue encodes an active constraint.
Items 2–4 are unchanged.

## Module-Level Changes

| File                                         | Change                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/agent-docs/frontmatter.mjs`         | New: `frontmatterDescription` (moved and renamed from `always-loaded.mjs`'s `skillDescription`), built on a private `splitFrontmatter`; later `markdownBody`        |
| `scripts/agent-docs/always-loaded.mjs`       | Imports `frontmatterDescription`; `alwaysLoadedWords` gains `agentDescriptions`; CLI reads `.pi/agents/*.md`                                                        |
| `scripts/agent-docs/model-usage.mjs`         | Export `DEFAULT_SESSIONS_DIR` and `DEFAULT_PREFIX`; no other change                                                                                                 |
| `scripts/agent-docs/invocation-volume.mjs`   | New: `templateHeading`, `invocations`, `volumeRows`, CLI                                                                                                            |
| `test/agent-docs/frontmatter.test.mjs`       | New: the five `skillDescription` tests moved and renamed; `markdownBody` tests                                                                                      |
| `test/agent-docs/always-loaded.test.mjs`     | Loses the `skillDescription` block; `alwaysLoadedWords` tests gain the agent term                                                                                   |
| `test/agent-docs/invocation-volume.test.mjs` | New                                                                                                                                                                 |
| `.pi/prompts/audit-agent-docs.md`            | Corpus argument, per-class admission reading, `Refs` shapes, template/agent apply rules, workflow measurement, per-corpus inventory and commits                     |
| `.pi/prompts/retro.md`                       | Step 7 gate widened; item 1's `Refs` clause tightened                                                                                                               |
| `AGENTS.md`                                  | Admission test's closing pointer names all four classes                                                                                                             |
| `docs/agent-docs-audit/<date>/`              | Written by the audit run: `inventory-workflow.md`, `invocation-volume.csv`, before/after totals, `doc-growth.csv`, `model-usage.csv`                                |
| `.pi/prompts/*.md`, `.pi/agents/*.md`        | Pruned by the audit run (bodies only)                                                                                                                               |
| `scripts/agent-docs/doc-growth.mjs`          | Predicted unchanged: `countWords` is imported as is, and its `prompts`/`subagent_defs` buckets already exist                                                        |
| `docs/agent-docs-audit/2026-09-17/README.md` | Predicted unchanged: it documents how that snapshot was regenerated, and that run did not use the new script; the `descriptions=` field it quotes keeps its meaning |
| `vitest.config.mjs`, `.fallowrc*`            | Predicted unchanged: `test/**/*.test.mjs` and `scripts/**/*.mjs` already cover the new files                                                                        |
| `.pi/skills/delegation/SKILL.md`             | Predicted unchanged by steps 1–7: it describes the agents' roles, not their word counts; the audit may land a template-to-skill offload elsewhere in `.pi/skills/`  |

`skillDescription` has one consumer outside its own module, `test/agent-docs/always-loaded.test.mjs`, verified by grep over `*.mjs` and `*.md` outside the plan and retro archives.

## Test Impact Analysis

- `invocations` has the discriminating input domain:
  - user versus assistant entries;
  - a heading on a message's first line versus a quoted heading later in the message;
  - a `subagent` call with and without `resume`;
  - a `subagent` call versus another tool;
  - timestamps before `since`, inside the window, and on or after `until`.
  Each gets a test.
- `volumeRows` pins the product, the ordering, and the dropping of unknown keys.
- `templateHeading` runs over every real template on HEAD in one test, as the real-sample surface.
  All 13 must yield a non-empty heading that is unique across the set.
  `retro.md` carries a second `#` line inside a fence at line 127, so first-occurrence semantics is the case that matters.
- The moved `frontmatterDescription` tests are unchanged except for the name.
- The template's prescribed commands were dry-run at planning:

| Command                                      | Expected                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/agent-docs/always-loaded.mjs`  | Today `agentsMd=1879 descriptions=568 total=2447`; after step 3 it gains `agentDescriptions=70`, total 2517                  |
| `grep -h '^# ' .pi/prompts/*.md`             | 14 lines: 13 H1s plus `retro.md`'s fenced `# Retro: #N — <issue title>`                                                      |
| `grep -L '^## Load skills' .pi/prompts/*.md` | `retro-note.md`, `ship-no-issue.md`, `ship.md`, `sync-worktree.md`                                                           |
| Throwaway invocation scan (see Background)   | 1.87M total over 2026-08-29 onward; the script's entry-timestamp window may differ slightly from the scan's file-date filter |

## Invariants at risk

- **`model-usage.mjs`'s CSV output is unchanged by exporting its constants** ([#934]'s invariant).
  Step 2 verifies it with an output diff that excludes the current week, as [#934]'s step 3 did.
- **`/retro` Step 7's items 2–4 keep their text and order** ([#934]).
  The only intended changes are the gate paragraph and item 1's parenthetical, and the step 7 commit's diff must show nothing else.
  No test covers prompt prose, so the diff is the check.
- **Each template loads the skills whose triggers its steps hit** ([#937]).
  A template-to-skill offload adds a load line and never removes one.
  The audit's Step 6 compares the sorted set of skill names the template loads (its backticked `<name>` followed by `skill`) against the same over `git show HEAD:<template>` for each edited template: the after set must be a superset of the before set.
- **Template H1s are stable.**
  This invariant is new: it serves `invocation-volume.mjs` and every later audit's before/after.
  The Step 6 H1 diff above pins it.
- **Numbered-step cross-references resolve.**
  They serve the executing agent of every template.
  The Step 5 no-whole-step rule and the Step 6 cross-reference check pin it.
- **The 2026-09-17 audit's files are not rewritten.**
  The first `workflow` run writes a new dated directory.

## TDD Order

1. **`refactor(scripts): move frontmatter parsing into frontmatter.mjs`**.
   This prepares steps 3 and 5.
   `skillDescription` is about to read agent files, which its name misrepresents, and `markdownBody` needs the same fence parsing.
   Create `scripts/agent-docs/frontmatter.mjs` with `frontmatterDescription` built on a private `splitFrontmatter`.
   `always-loaded.mjs` imports it.
   Move the five tests into `test/agent-docs/frontmatter.test.mjs` and rename them.
   Verify: `node scripts/agent-docs/always-loaded.mjs` prints `agentsMd=1879 descriptions=568 total=2447` (unchanged), and `pnpm fallow dead-code` is clean.
2. **`refactor(scripts): export model-usage's session-store defaults`**.
   This prepares step 6: its CLI must resolve the same store and prefix.
   Add `export` to `DEFAULT_SESSIONS_DIR` and `DEFAULT_PREFIX`.
   Verify: `node scripts/agent-docs/model-usage.mjs` output, with the current week's rows excluded, diffs empty against a pre-step capture.
3. **`feat(scripts): count subagent descriptions in the always-loaded total`**.
   Red: update the two `alwaysLoadedWords` `toEqual` tests to the four-field shape, and add a test where only `agentDescriptions` is non-empty.
   Green: the new parameter, the result field, and the CLI read of `.pi/agents/*.md` through `frontmatterDescription`.
   Killing mutation: drop `agentDescriptions` from the `total` sum.
   This kills the agent-only test and the updated sum test.
   Verify: the CLI prints `agentsMd=1879 descriptions=568 agentDescriptions=70 total=2517` on HEAD.
4. **`refactor(scripts): extract invocation events from session transcripts`**.
   New `scripts/agent-docs/invocation-volume.mjs` with `invocations`, plus `test/agent-docs/invocation-volume.test.mjs` (red: the module does not exist).
   It has no CLI yet, so no consumer, hence `refactor:`.
   Killing mutations, one per class:
   - Yield the first `# `-prefixed line anywhere in a user message instead of its first line.
     This kills the quoted-heading test.
   - Drop the `resume` exclusion.
     This kills the resume test.
   - Drop the `until` bound.
     This kills the after-window test.
   - Drop the `since` bound.
     This kills the before-window test.
   - Yield an agent event for any `toolCall` with a `subagent_type` argument regardless of `name`.
     This kills the other-tool test.
5. **`refactor(scripts): compute invocation volume per template and agent`**.
   Add `markdownBody` to `frontmatter.mjs`, and `templateHeading` and `volumeRows` to `invocation-volume.mjs`, test-first.
   Killing mutations:
   - Make `markdownBody` return the whole text.
     This kills the frontmatter-excluded test.
   - Make `templateHeading` return the last `#` line.
     This kills the real-sample test on `retro.md`.
   - Compute `volume` as `words + invocations`.
     This kills the product test.
   - Emit a zero-word row for an unknown key instead of dropping it.
     This kills the unknown-key test.
6. **`feat(scripts): report per-template and per-agent invocation volume`**.
   The CLI goes under the `process.argv[1] === fileURLToPath(import.meta.url)` guard, with `--since`, `--until`, `--root`, `--sessions-dir`, `--prefix`, and `--total`.
   It has no unit test beyond steps 4–5, following `model-usage.mjs`'s precedent.
   Verify:
   - `node scripts/agent-docs/invocation-volume.mjs --since 2026-08-29 --until 2026-09-29` ranks `plan-issue.md` first and `pre-completion-reviewer` second.
   - Its invocation counts are within a few of the Background table's.
   - `--total` prints one line.
   - It runs in under 5 s.
   Record the measured total in the commit body.
7. **`feat: extend /audit-agent-docs to prompt templates and subagent definitions`**.
   `.pi/prompts/audit-agent-docs.md` gains:
   - the corpus argument and a validation stop;
   - `## The admission test by class`;
   - the three `Refs` shapes in Step 2;
   - per-corpus measurement and carry-forward in Step 1;
   - per-corpus inventory naming and header in Step 3;
   - the template/agent apply rules in Step 5;
   - the H1 and cross-reference checks and per-corpus `git add` and commit subjects in Step 6.
   `AGENTS.md`'s admission-test pointer names the four classes.
   Before committing, dry-run every shell block the template now prescribes against a scratch directory.
   Verify: `pnpm run lint` is clean, and `node scripts/agent-docs/always-loaded.mjs` reports the `AGENTS.md` delta, which goes in the commit body.
8. **`docs: gate retro-driven template and agent additions on the admission test`**.
   `.pi/prompts/retro.md` Step 7 changes per the Design Overview.
   Verify: the diff touches only the gate paragraph and item 1's parenthetical.
   Then stop: the pre-completion reviewer runs over steps 1–8.
   The extended command cannot run in this session.
9. **The `workflow` audit runs in a fresh session: `/audit-agent-docs workflow`.**
   The implementing session does not execute this step.
   The run lands `docs(agent-docs): audit <date> (workflow)` and `docs: prune workflow agent docs per <date> audit`.
   The plan's acceptance is met when both commits are on `main` and the inventory's invocation-volume "after" is below its "before".
   Only then `/ship 935`: the stage summary after step 8 names this fresh-session run as the next step, not `/ship` (a lesson from [#934]'s TDD retro).

## Risks and Mitigations

- **A prune deletes a template instruction that was load-bearing for the executing agent.**
  The recurrence heuristic applies as it does for `docs`: grep the retros before a `delete`, and a post-prune recurrence is the restoration signal.
  The prune is one commit, so reverting a line is cheap.
  Templates have a sharper failure mode than skills, because a missing step changes what `/ship` or `/tdd-plan` does.
  That is why whole-step deletions are excluded from the prune.
- **The inventory is too large to gate in one pass.**
  At [#934]'s density (201 rows over 43,645 words), the workflow corpus's 38,897 words would give about 180 rows (estimated).
  The per-file summary lines, headed by `plan-issue.md` and `pre-completion-reviewer.md`, let the operator review by file inside the one gate.
- **A template-to-skill offload moves a rule out of the path that guaranteed it was read.**
  The template always loads the destination skill after the move, and [#939]'s lens is the measurement if that proves insufficient.
- **The invocation count is wrong for a template that changed its H1 inside the window.**
  The count comes out low, never high.
  The audit itself cannot cause this (Step 5 rule), and the 30-day window bounds exposure to other commits.
- **Reviewer checks get pruned as duplicates of template instructions.**
  The by-class section names this shape explicitly as not a duplicate.
- **The retro Step 7 widening is ignored, and the templates regrow.**
  The next `workflow` audit's `doc-growth.csv` `prompts` series measures it, as [#934] set up for `agents_md`.

## Open Questions

- Whether `/audit-agent-docs` with no argument should default to `all` or to the corpus audited least recently.
  Deferred: `all` is the simpler rule, so see how the first combined run sizes up.
- Whether the invocation-volume window should become "since the prior audit of this corpus" instead of a fixed 30 days.
  Deferred: a fixed window keeps runs comparable.

[#934]: https://github.com/gotgenes/pi-packages/issues/934
[#937]: https://github.com/gotgenes/pi-packages/issues/937
[#939]: https://github.com/gotgenes/pi-packages/issues/939
[#969]: https://github.com/gotgenes/pi-packages/issues/969
