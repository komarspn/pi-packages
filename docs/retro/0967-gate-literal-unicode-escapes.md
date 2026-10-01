---
issue: 967
issue_title: "Gate the visible forms of em-dash corruption (literal \\u2014, split sentences), not just invisible bytes"
---

# Retro: #967 — Gate the visible forms of em-dash corruption

## Stage: Planning (2026-09-23T22:04:17Z)

### Session summary

Planned a sibling lint script, `scripts/lint/unicode-escapes.mjs`, that masks markdown code spans and fenced blocks and then rejects a literal `\uXXXX`/`\u{…}` escape or a bare `uXXXX` token in prose, decoding the unambiguous escapes under `--fix`.
It is wired like #960's gate (prek hook, `lint`, `lint:fix`, the `pi-autoformat` `.md` chain) and ships with two repairs: the `0301` retro's `\u2192` and a `\u2014` in an `authorizer-chain.ts` comment.
The plan is `docs/plans/0967-gate-literal-unicode-escapes.md`, nine TDD steps, one Tidy-First preparatory `test:` step.

### Observations

- **Code-span masking is the whole design.**
  A naive `git grep` finds 54 lines in 22 markdown files, 15 of them retros; a prototype masker reduces that to 1 hit, which is real corruption.
  So neither `docs/retro/**` nor `CHANGELOG.md` needs an exemption, answering two of the issue's three open questions by measurement.
- **The split-sentence form is not gateable, and the reason is `rumdl`'s reflow.**
  A scratch file run through `rumdl fmt` with the repo config rejoined all three split shapes; the operator asked whether the 0 hits came from that cleanup, and it does.
  What survives is either a grammatical missing dash (undetectable) or a joined bare `u2014` (caught by the bare-token check).
  The looser pre-reflow pattern had 28 false positives in 11 files.
- **Operator chose decode-on-`--fix`, after asking how a doc that means the literal survives.**
  Answer: backticks (already used by every current mention) or CommonMark's `\\u`, which the gate excludes by requiring exactly one preceding backslash.
  Design addition from that exchange: decode only when the result is visible (not `\p{C}`/`\p{Z}`), so decoding never plants a byte #960's gate rejects.
- **Code comments were found corrupt too.**
  `authorizer-chain.ts:47` holds `\u2014` from `6d52c8c6`; `widget-renderer.ts:222` spells escapes in a comment on purpose, so a comment gate needs tokenizing.
  The operator chose to fix the one line in this plan (as `style:`, skipped by `cliff.toml`) rather than file a follow-up; no issues were filed.
- **Frontmatter is the gate's own first test case.**
  This issue's title contains the literal escape; written `\\u2014` inside YAML double quotes, it is YAML-correct and outside the gate.
  The prototype enumerates `git ls-files`, so its first run skipped the still-untracked plan; once tracked, both frontmatters surfaced as hits until the prototype gained the exactly-one-backslash rule, after which the tree reports only the `0301` line.
  `/tdd-plan` should keep both files in the step 3 whole-tree check as the regression case for that rule.
- The issue carries no labels; `scope:repo` would be the correct one.

#### Deferred tidyings

- `scripts/lint/invisible-characters.mjs` and the new `scripts/lint/unicode-escapes.mjs` — `parseArgs` and the tracked-file listing will duplicate about 20 lines; declined at two callers, following the unextracted two-caller precedent `fallow dupes` reports in `packages/pi-permission-system/scripts/`.
  Trigger: a third lint script.
- A generic `runLinter({paths, fix}, io, {scan, repair, format})` over both lint scripts — rejected; the two repairs differ in shape (code-point filter vs. offset splice).

## Stage: Implementation — TDD (2026-09-23T22:39:49Z)

### Session summary

All nine plan steps landed as nine commits: the shared `memoryIo` double, `maskCode`, the report-only scan and CLI, `--fix` decoding, the `0301` retro repair, the `authorizer-chain.ts` comment, the prek/`lint` wiring, the `pi-autoformat` chain entry, and the docs.
The root suite went from 9 files / 178 tests to 10 files / 221 tests (+43); the whole-tree scan is clean and takes 0.42 s.
Pre-completion reviewer: PASS.

### Observations

- **Two of step 2's planned killing mutations survived the tests as first written, and both were test defects.**
  A triple-backtick fence with no blank line inside masks identically as an inline span, so the fence logic was never exercised by the backtick cases; each now holds a blank line, which a span cannot cross.
  The at-least-n closer mutation needed a longer run *inside* a span (a single-backtick span holding a double-backtick run), not the plan's double-backtick span.
  The plan's mutation list was right to exist; its predicted killing tests were wrong.
- **The plan's `+` in the bare-token lookbehind was vacuous.**
  `U+2014` cannot match a lowercase `u` plus four hex digits whatever the lookbehind says; dropped it and moved the mutation to the word-character lookbehind, which `menu2014` pins.
- **A step 1 relocation mutation found a pre-existing weak pin.**
  Deleting `writes.push` in `memoryIo` left all 178 tests green, because the #960 tests only ever assert `writes` is empty; the new "decodes, names the file" test asserts `writes` equals `["a.md"]`, which the sibling suite never did.
- **zsh's `echo` decodes `\u2014` itself**, so the first step 8 chain check printed an em-dash for the *without-entry* case and looked like `rumdl` was decoding.
  Re-running with `print -r` and `sed -n` showed the real bytes; worth knowing for any future check of this gate from the shell.
- **Step 6 used a scripted substitution from the code point** (`perl -CSD ... \x{2014}`) rather than a typed glyph, per `markdown-conventions`, and `od -c` confirmed the three-byte em-dash landed.
  `next-version.sh pi-permission-system` reported nothing to release before and after the `style:` commit.
- **The running session still has the pre-change `pi-autoformat` config**, so none of this session's markdown edits were decoded between turns; the new docs avoid em-dashes in fresh prose for that reason.
- The reviewer independently probed about 20 masker inputs (tab-indented fences, blockquoted fences, HTML comments, tables, frontmatter) and confirmed `[\p{C}\p{Z}]` covers every code point `invisible-characters.mjs` rejects or repairs.
- **The gate's first organic catch was this retro, and it exposed a masker gap the reviewer's probes missed.**
  A malformed double-backtick example in one bullet closed early, and `maskCode`'s span search, which only stops at a blank line, carried the misaligned pairing into later bullets until a backticked `\u2014` read as prose.
  The example was rewritten in words; the gap also runs the other way (a stray backtick in one list item masks an escape in the next, reproduced with `rc=0`), so it is filed as [#974] rather than folded in after review.
  `roadmap-fit` exited at its first step: `scope:repo`, no package phase.

## Stage: Final Retrospective (2026-09-24T04:39:47Z)

### Session summary

Planning, TDD, ship, and this retro ran in one trunk-lane session.
The gate shipped as nine commits plus stage notes, CI went green on the pushed tip, #967 closed with nothing to release (the only package-scoped commit was a `style:` comment fix, which `next-version.sh` confirmed skips), and [#974] was filed for a masker gap the gate exposed while its own retro was being written.

### Observations

#### What went well

- **The gate caught a real defect on its first organic input, and that input was its own retro.**
  A malformed double-backtick example in the TDD stage note misaligned `maskCode`'s span pairing across list items; chasing the report reproduced the opposite failure (a stray backtick hiding an escape, `rc=0`), which became [#974].
  The pre-completion reviewer had probed about 20 masker inputs by hand and missed exactly this shape, so organic data beat a careful synthetic sweep again.
- **The mandatory verify-the-pins step earned its place on step 2.**
  Two planned killing mutations (fence opener at column 0, closer of at least n backticks) left every test green, because a blank-line-free backtick fence masks identically as an inline span.
  Both were test defects that a green suite would have shipped; fixing them cost two test edits before the commit.
- **A `cmp` guard after each `perl -pi` mutation turned two silent no-op mutations into a visible `NOT APPLIED`.**
  Without it, two surviving mutations would have read as vacuous tests.
- **The operator's question in place of an answer improved the design.**
  Asking how a document that means the literal survives decoding produced the `\\u` escape hatch (exactly one preceding backslash) and the visible-character guard, both of which the plan then specified and tested.

#### What caused friction (agent side)

- `instruction-violation` (user-caught, indirectly) — the first `ask_user` gate asserted that `rumdl`'s reflow rejoins a split sentence without having measured it, and priced the decode option's risk without naming how a deliberate literal survives.
  The operator answered both questions with questions; the scratch-file measurement that settled the split-sentence call ran only then.
  The `/plan-issue` rule that a qualitative cost claim is measurable already covers this.
  Impact: one extra gate round, no rework.
- `other` (report shape) — the planning summary put "The next step is `/tdd-plan`" mid-paragraph in a long report, and the operator had to ask.
  `/tdd-plan` and `/ship` end their reports on the next command; `/plan-issue` asks only for "a 5-line summary" and names no closing line.
  Impact: one operator round-trip.
- `other` (shell) — step 8's first chain check printed the em-dash in the *without-entry* case, because zsh's `echo` decodes `\uXXXX` in its argument.
  It briefly read as `rumdl fmt` decoding escapes; `print -r` and `sed -n` showed the real bytes.
  Impact: three extra tool calls, no wrong conclusion committed.
- `missing-context` (self-identified) — the planning prototype enumerated `git ls-files`, so it skipped the still-untracked plan and only saw the frontmatter's `\\u2014` after the commit; the prototype then gained the one-backslash rule the design already specified.
  Impact: one amended retro commit.

#### What caused friction (user side)

- Nothing material.
  The operator's two question-answers were the most valuable interventions of the session, and they were redirecting questions rather than corrections.

### Diagnostic details

- **Model-performance correlation** — planning and TDD ran on `anthropic/claude-opus-5-5`, the ship on `anthropic/claude-sonnet-5`, and this retro on `anthropic/claude-opus-5-5`; both subagents (`tidy-first-assessor`, `pre-completion-reviewer`) ran on `anthropic/claude-sonnet-5`, per their transcripts.
  The split fits: the ship was mechanical and clean (every SHA resolved and ancestry-checked before `issue_close`).
  The reviewer's missed list-item case is a probe-enumeration gap, not a model mismatch: the probe list covered fence and span shapes but no multi-block span pairing.
- **Feedback-loop gap analysis** — no gap.
  Each step ran its test file red and green, Biome on the touched files, and its named mutations; `pnpm run lint` ran at step 7 and at the end, and `pnpm run check` at baseline, after the only `src/` edit (step 6), and at the end.

### Changes made

1. `docs/retro/0967-gate-literal-unicode-escapes.md` — added this Final Retrospective stage entry.
2. `.pi/prompts/plan-issue.md` — the closing instruction now ends the summary on the next command (`/tdd-plan` or `/build-plan`), on its own line.
3. `.pi/skills/shell-traps/SKILL.md` — in the Command flags and state section, a line that zsh's `echo` decodes backslash escapes, with `print -r --`, `printf '%s\n'`, or `sed -n` for printing bytes.
   The operator asked whether this is zsh-specific; measured on this host, `bash` and `dash` print `\u2014` literally, `bash -e` decodes it, and macOS `/bin/sh` decodes `\n` but not `\u`, so the line names zsh and the literal-printing shells.

Considered and not proposed: a gate rule that a rewrite option must name its escape hatch (covered by `/plan-issue`'s differs-and-does-not scenarios rule), a testing rule on fixtures separating overlapping mechanisms (covered by the testing skill's discriminating-assertion rule), and a reviewer probe for spans across block boundaries (one incident; [#974] fixes the mechanism).

[#974]: https://github.com/gotgenes/pi-packages/issues/974
