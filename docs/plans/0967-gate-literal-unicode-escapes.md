---
issue: 967
issue_title: "Gate the visible forms of em-dash corruption (literal \\u2014, split sentences), not just invisible bytes"
---

# Gate literal Unicode escapes in markdown prose

## Release Recommendation

**Release:** ship independently

The issue is repo-level tooling with no `pkg:*` label and no roadmap step, so it belongs to no release batch.
Nothing it touches should cut a release: every file is outside `packages/` except one comment in `pi-permission-system`, committed as `style:`, which `cliff.toml` skips (`{ message = "^style", skip = true }`).
Confirm with `./scripts/release/next-version.sh pi-permission-system` at ship time rather than dispatching by reflex.

## Problem Statement

`scripts/lint/invisible-characters.mjs` ([#960]) closed the invisible-byte form of em-dash corruption, but the visible forms still reach commits.
An em-dash (or a check mark, or an arrow) written in an `Edit` body can land as the literal six characters `\u2014`, as a bare newline that splits the sentence, or as a newline followed by a bare `u2014`.
All three are valid markdown, so `rumdl` passes them, and none contains a control or zero-width character, so the #960 gate passes them too.
The only detector today is a hand-run `grep '\\u20'`, and the prose rules that ask for it (the system-prompt addendum, `markdown-conventions`) were loaded and still not applied in #859, #960, #962, and `pi-anthropic-auth` #74.
The issue's argument is the one #960 made: the mechanism has to be a gate.

## Goals

- Reject a literal `\uXXXX` or `\u{…}` escape, and a bare `uXXXX` token, in the prose of any tracked markdown file, at pre-commit, in `pnpm run lint` (hence CI), and between turns via `pi-autoformat`.
- Skip inline code spans and fenced code blocks, so a document may still quote the escape it is warning about.
- Under `--fix`, decode an unambiguous escape to the character it spells; report everything else.
- Repair the one live corruption in markdown and the one found in a TS comment.
- Not breaking: no published package's behavior, output, or default changes.

## Non-Goals

- **Gating the split-sentence form.**
  Measured below: `rumdl`'s `sentence-per-line` reflow rejoins every split shape before a commit, so what survives is either a missing dash that still reads as grammatical, which no pattern can see, or a joined bare `u2014`, which this gate does catch.
  The looser pattern that would catch a split before reflow reports 28 false positives in 11 files.
  The manual scan in `markdown-conventions` stays.
- **Escapes in code comments.**
  `widget-renderer.ts:222` spells `\u251C\u2500` in a comment on purpose, to mirror the string literal below it; telling that apart from corruption needs a JavaScript tokenizer.
  The one corrupt comment found at planning time is repaired by hand in this plan; a general comment gate was offered as a follow-up and not taken.
- **Indented (four-space) code blocks and inline HTML `<code>`.**
  Neither is masked; an escape inside one fails loudly rather than silently, and there are 0 such hits today.
- **Other escape spellings** (`\x2014`, `&mdash;`, `U+2014`).
  `&mdash;` renders correctly, and `U+2014` is how prose names a code point.
- **A commit-message check.**
  `git-cliff` copies commit subjects into `CHANGELOG.md`, which this gate scans; 0 of the repo's commit subjects carry an escape today (measured), so a `commit-msg` hook is left as an Open Question.
- **Porting to `pi-anthropic-auth`.**
  The issue plans that port separately, once this lands.
- **Extracting a shared `scripts/lint/` CLI module.**
  The Tidy-First assessor offered it as optional; see Design Overview.

## Background

### Measurements

All taken at planning time on `main`, over 1242 tracked `*.md` files, with a disposable prototype of the design below (`/tmp/proto967.mjs`, not committed).

| Check                                                                           | Naive `git grep`                         | Prose only (code spans and fences masked)                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `\uXXXX` escape                                                                 | 54 lines in 22 files (15 of them retros) | 1: `packages/pi-permission-system/docs/retro/0301-evaluate-bash-command-chains.md:50` |
| Bare `uXXXX` token                                                              | —                                        | 0                                                                                     |
| `\u{…}` braced escape                                                           | —                                        | 0                                                                                     |
| Split sentence, strict `' \n [a-z]'`                                            | —                                        | 0                                                                                     |
| Split sentence, loose (line ends lowercase, next starts lowercase, same indent) | —                                        | 28 in 11 files, all deliberate hand-wrapping                                          |

The one prose hit is real damage: `` `npm install > out.txt` \u2192 `["npm install"]` `` wanted an arrow.
Every other `\u` mention in a retro, plan, or skill sits in backticks, so neither `docs/retro/**` nor `CHANGELOG.md` (0 hits) needs an exemption.
Outside markdown, 38 tracked files carry escapes legitimately (TS string literals, a JSON string in `package.json`), which is why the gate is markdown-only.
Prototype wall-clock over the whole tree: 0.75 s (measured, `time node /tmp/proto967.mjs`).

The split-sentence claim was measured, not argued: a scratch file holding all three split shapes, run through `pnpm exec rumdl fmt --config .rumdl.toml`, came back as

```text
The floor when pi reports a value is fine.
The floor when pi reports a value.
The floor u2014 when pi reports.
```

`rumdl fmt` runs after every `Edit`/`Write` (the `pi-autoformat` `.md` chain) and again at pre-commit (the `rumdl-fmt` hook).

The TS comment is `packages/pi-permission-system/src/authority/authorizer-chain.ts:47`, `` // `defer` \u2014 try the next link. ``, introduced by `6d52c8c6`.

### Existing surfaces

`scripts/lint/invisible-characters.mjs` is the shape to follow: pure exported functions at the top, `run({ paths, fix }, io)` composing repair-then-scan into `{ lines, exitCode }`, and a CLI body guarded by `process.argv[1] === fileURLToPath(import.meta.url)`.
Its test (`test/lint/invisible-characters.test.mjs`, 407 lines) drives `run` through an in-memory `memoryIo(tree)` double at line 206.
The root `vitest.config.mjs` includes `test/**/*.test.mjs`; baseline 9 files, 178 tests (measured).

Wiring points, as #960 left them:

- `prek.toml` local block: `invisible-characters` hook, `types = ["text"]`, first.
  `prek util identify README.md` reports `markdown` among the tags (measured, prek 0.5.3), so `types = ["markdown"]` scopes the new hook.
- `package.json` `lint` and `lint:fix` each end with the `invisible-characters` invocation.
- `.pi/extensions/pi-autoformat/config.json` `.md` chain: `["invisible-characters", "rumdl"]`.
  An ordinary formatter's non-zero exit is recorded and the chain continues (`executeChainGroup` in `packages/pi-autoformat/src/formatter-executor.ts` pushes the run and `continue`s), so a report-only finding still lets `rumdl` run.

No markdown parser is installed at the root (`node_modules` has none), so code-span masking is hand-written.

### Constraints from AGENTS.md

- Principle 1: every number above was produced by a command.
- Principle 5: the gate is a script plus config lines in existing surfaces, the same footprint as #960.
- `packages/*/docs/` is outside release scope; the `authorizer-chain.ts` comment is not, hence `style:`.

## Design Overview

### A sibling script, not an extension of #960's

`invisible-characters.mjs` classifies single code points in every text file.
This check matches a text pattern in markdown prose after masking code, a different responsibility with a different file set, so it lives in `scripts/lint/unicode-escapes.mjs`.

### Masking code

```javascript
/** `text` with fenced blocks and inline code spans blanked to spaces; length and newlines preserved. */
export function maskCode(text)
```

- A fence opens on a line whose first non-blank characters are three or more backticks or tildes, at any indentation (this repo nests fences in list items), and closes on a line of the same character, at least as long, followed only by whitespace.
  An unclosed fence runs to the end of the file, as in CommonMark.
- An inline span opens on a backtick run of length n and closes on the next run of exactly n, within one paragraph (a blank line ends the search).
  An unmatched run stays literal text.
- A backslash-escaped backtick outside a span is a literal backtick, not an opener.
- Masked characters become spaces, newlines are kept, so an offset in the masked text is the same offset in the original.

### Findings

```javascript
/**
 * @returns {{line: number, column: number, token: string, replacement: string | null}[]}
 */
export function findUnicodeEscapes(text)
```

Scanning the masked text:

| Token                                                  | Finding                   | `replacement`                             |
| ------------------------------------------------------ | ------------------------- | ----------------------------------------- |
| `\uXXXX` after exactly one backslash                   | yes                       | the decoded character, when it is visible |
| `\uD83D\uDE00` (surrogate pair)                        | one finding spanning both | the decoded astral character              |
| Lone surrogate                                         | yes                       | `null`                                    |
| `\u{1F600}`                                            | yes                       | the decoded character, when it is visible |
| `\\uXXXX` (escaped backslash)                          | no                        | —                                         |
| Bare `uXXXX` (not after a word character, `\`, or `+`) | yes                       | `null`                                    |
| `U+2014`                                               | no                        | —                                         |

"Visible" means the decoded character is not in `\p{C}` (controls, format characters, surrogates, private use, unassigned) or `\p{Z}` (separators).
Decoding `\u000c` or `\u200b` would plant exactly the bytes #960's gate rejects, and decoding `\u00a0` would hide the character, so those stay report-only.

The `\\uXXXX` exclusion is the markdown-native way out for a document that genuinely wants the literal in bare prose: CommonMark renders `\\u2014` as `\u2014`.
Backticks remain the recommended form, and all 54 current mentions already use them.

A bare `uXXXX` is report-only because what it stood for depends on context the token does not carry: the reflow above shows `floor u2014 when` could want `floor — when`, but nothing proves that it was an escape rather than an identifier.

Columns count code points, as in the sibling.

### Repair and the command

```javascript
/** @returns {{text: string, decoded: number}} — splices each non-null replacement at its offset */
export function repairUnicodeEscapes(text)

/** `path:line:column: \u2014 (decodes to U+2014)` or `path:line:column: u2014 (bare; report only)` */
export function formatFinding(path, finding)

/** @returns {{lines: string[], exitCode: number}} — repair first under `fix`, then scan */
export function run({ paths, fix }, io)
```

`run` mirrors the sibling's: `--fix` rewrites only files with something to decode and names each (`decoded <path>`), then the scan runs over the rewritten text, so a report-only finding still exits 1.
The consumer sketch, at the CLI:

```javascript
const { lines, exitCode } = run(
  { paths: paths.length > 0 ? paths : trackedMarkdown(), fix },
  { readFile: readFileSync, writeFile: (path, text) => writeFileSync(path, text, "utf8") },
);
```

With no paths the CLI enumerates `git ls-files -z -- '*.md'`; with paths it scans them as given (prek and `pi-autoformat` already filter to markdown).
No binary check: every input is markdown.

`parseArgs` and the tracked-file listing duplicate about 20 lines of the sibling.
The Tidy-First assessor offered extracting them into a shared module as optional; the plan declines it, following the repo's own precedent: `pnpm fallow dupes` already reports a 43-line block shared by two sibling CLI scripts in `packages/pi-permission-system/scripts/` that was left unextracted at two callers.
A third lint script is the trigger.

### Frontmatter

A YAML double-quoted scalar is scanned like prose.
Decoding `\u2014` there is meaning-preserving, since YAML decodes that escape itself; an issue title that genuinely contains the literal is written `\\u2014`, which is both YAML-correct and outside the gate.
This plan's own frontmatter is the first instance.

### Wiring

| Surface                     | Invocation                      | Placement                                  |
| --------------------------- | ------------------------------- | ------------------------------------------ |
| `prek.toml` local hook      | `--fix`, `types = ["markdown"]` | second, after `invisible-characters`       |
| `pnpm run lint`             | read-only, all tracked markdown | appended                                   |
| `pnpm run lint:fix`         | `--fix`                         | appended                                   |
| `pi-autoformat` `.md` chain | `--fix`                         | between `invisible-characters` and `rumdl` |

Decoding before `rumdl` means the reflow sees the real character.

## Module-Level Changes

| File                                                                            | Change                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/lint/memory-io.mjs`                                                       | New. `memoryIo(tree)` moved from the sibling test.                                                                                                                                                                                                       |
| `test/lint/invisible-characters.test.mjs`                                       | Import `memoryIo` instead of defining it.                                                                                                                                                                                                                |
| `scripts/lint/unicode-escapes.mjs`                                              | New. `maskCode`, `findUnicodeEscapes`, `repairUnicodeEscapes`, `formatFinding`, `run`, CLI.                                                                                                                                                              |
| `test/lint/unicode-escapes.test.mjs`                                            | New.                                                                                                                                                                                                                                                     |
| `packages/pi-permission-system/docs/retro/0301-evaluate-bash-command-chains.md` | Line 50: `\u2192` decoded to `→` by `--fix`.                                                                                                                                                                                                             |
| `packages/pi-permission-system/src/authority/authorizer-chain.ts`               | Line 47: `\u2014` replaced by `—` in the comment.                                                                                                                                                                                                        |
| `prek.toml`                                                                     | New `unicode-escapes` hook.                                                                                                                                                                                                                              |
| `package.json`                                                                  | Append to `lint` and `lint:fix`.                                                                                                                                                                                                                         |
| `.pi/extensions/pi-autoformat/config.json`                                      | New formatter; inserted in the `.md` chain.                                                                                                                                                                                                              |
| `README.md`                                                                     | Line 68 hook list; a paragraph after line 72 describing the check; line 79 `lint` comment.                                                                                                                                                               |
| `AGENTS.md`                                                                     | Line 50: pre-commit hooks also reject literal Unicode escapes in markdown prose.                                                                                                                                                                         |
| `.pi/skills/markdown-conventions/SKILL.md`                                      | § Non-ASCII in authored prose: a literal escape in prose is now decoded by the hook and `pi-autoformat`; quote one in backticks, or `\\u` for bare prose. The split-sentence paragraph stays, with the reflow fact that explains why it cannot be gated. |

### Predicted unchanged

- `scripts/lint/invisible-characters.mjs`: no shared-module extraction (see Design Overview).
- `.pi/skills/edit-tool/SKILL.md`: line 26 is about the form-feed form and `oldText` matching; it names no escape gate.
  Falsifiable by grepping it for `\u` after step 9.
- `.github/workflows/ci.yml`: CI runs `pnpm run lint`.
- `vitest.config.mjs`: the include glob already matches `test/lint/*.test.mjs` and excludes `memory-io.mjs`.
- `.rumdl.toml`: its `CHANGELOG.md` exclusion is for `rumdl`'s rules, not this gate.

### Grep basis

- No export is removed or renamed.
- The mechanism-name grep for the reworded prose (`invisible`, `pre-commit hooks`, `rumdl fmt`) across `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `.pi/skills/*/SKILL.md`, and `.pi/prompts/*.md` produced the three doc rows above; `CONTRIBUTING.md` names `pnpm run lint` without its parts.

## Test Impact Analysis

All coverage is new; no existing test exercises this layer, and the sibling's tests change only their `memoryIo` import.

| Surface                | Cases                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maskCode`             | backtick fence; tilde fence; longer closing fence; fence indented in a list item; unclosed fence masks to end; single-backtick span; double-backtick span containing a backtick; unmatched backtick left literal; span continuing over one newline; span not crossing a blank line; backslash-escaped backtick not an opener; output length and newline positions equal the input's           |
| `findUnicodeEscapes`   | `\u2014` found with its decoded replacement; escape inside a span not found; escape inside a fence not found; `\\u2014` not found; surrogate pair as one finding; lone surrogate with `null`; `\u{1F600}` decoded; `\u000c`, `\u200b`, `\u00a0` found with `null`; bare `u2014` found with `null`; `U+2014` and `menu2014` not found; column counted in code points after an astral character |
| `repairUnicodeEscapes` | decodes one; decodes several on one line with correct offsets; leaves report-only findings and masked code untouched; `decoded` count                                                                                                                                                                                                                                                         |
| `formatFinding`        | decodable and report-only shapes                                                                                                                                                                                                                                                                                                                                                              |
| `run`                  | report-only exit 1; clean exit 0; `--fix` decodes and exits 0; `--fix` with a report-only finding still exits 1; an unchanged file is not rewritten                                                                                                                                                                                                                                           |

The real-corpus check comes from `maskCode`'s input domain: after step 3, `node scripts/lint/unicode-escapes.mjs` over the whole tree must report exactly the 0301 line.
That covers the four-backtick outer fence in `markdown-conventions`, the retros' quoted escapes, and every CHANGELOG, not only the shapes pictured above.

Commands the new docs prescribe, dry-run at planning time with the prototype: the whole-tree scan (1 hit, 0.75 s).
`/tdd-plan` re-runs them against the real script.

## Invariants at risk

| Invariant                                                                      | Constituency                                            | Pinned by                                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| #960's gate still rejects and repairs what it did                              | every commit                                            | `test/lint/invisible-characters.test.mjs` stays green after step 1 moves `memoryIo`; it imports the real `run`, not a mock        |
| `invisible-characters` stays first in the `.md` chain and the prek local block | the #960 ordering rationale (report a byte where it is) | steps 7 and 8 insert after it; verified by reading the diff                                                                       |
| A document can still quote an escape                                           | skills and retros that teach the rule                   | whole-tree scan reports only 0301 at step 3, and 0 after step 5, with this plan and its retro committed                           |
| Decoding never plants an invisible byte                                        | the #960 gate                                           | the `\u000c`/`\u200b`/`\u00a0` `null`-replacement tests                                                                           |
| `pnpm run lint` stays fast                                                     | every session and CI                                    | prototype scan 0.75 s (measured); re-measure `node scripts/lint/unicode-escapes.mjs` at step 7 and expect under 1.5 s (estimated) |
| `pi-autoformat` does not block an edit                                         | its published non-goal                                  | an ordinary formatter's failure is recorded and the chain continues (`formatter-executor.ts`)                                     |

## TDD Order

1. **`test: share the in-memory io double across lint tests`**

   Move `memoryIo(tree)` from `test/lint/invisible-characters.test.mjs` into `test/lint/memory-io.mjs` and import it.
   Prepares step 3: the new test drives `run` through the same `{ readFile, writeFile }` shape and would otherwise copy the double verbatim.
   No new tests; verify `pnpm run test:scripts` still reports 9 files and 178 tests.

2. **`refactor(scripts): mask markdown code spans and fenced blocks`**

   `maskCode` and its `Surface` row, red first.
   `refactor:` because nothing consumes it until step 3.

   Killing mutations:
   - Make the fence opener require column 0 → the list-indented fence case reddens.
   - Close an inline span on a run of *at least* n backticks → the double-backtick span case reddens.
   - Let a span search cross a blank line → the blank-line case reddens.
   - Replace masked newlines with spaces → the length-and-newline invariant case reddens.

3. **`feat(scripts): report literal Unicode escapes in markdown prose`**

   `findUnicodeEscapes`, `formatFinding`, `run` in report-only mode, and the CLI.
   `feat:` because the command is runnable once it lands.

   Killing mutations:
   - Drop the call to `maskCode` → the in-span and in-fence cases redden.
   - Accept any number of preceding backslashes → the `\\u2014` case reddens.
   - Return the decoded character without the visibility check → the `\u000c`/`\u200b`/`\u00a0` cases redden.
   - Remove the `+` from the bare-token lookbehind → the `U+2014` case reddens.
   - Make `run` exit 0 unconditionally → the report-only exit case reddens.

   Verify: `node scripts/lint/unicode-escapes.mjs` exits 1 naming only `packages/pi-permission-system/docs/retro/0301-evaluate-bash-command-chains.md:50`.

4. **`feat(scripts): decode literal Unicode escapes with --fix`**

   `repairUnicodeEscapes` and `run`'s `fix` branch, whole lifecycle in this step: which findings are decoded, that a report-only finding still exits 1 under `--fix`, and that an unchanged file is not rewritten.

   Killing mutations:
   - Splice using masked-text offsets shifted by one → the several-on-one-line case reddens.
   - Decode `null`-replacement findings as the empty string → the report-only-untouched case reddens.
   - Make `--fix` exit 0 whenever it decoded something → the report-only-still-fails case reddens.

5. **`docs: decode a literal arrow escape in the #301 retro`**

   `node scripts/lint/unicode-escapes.mjs --fix packages/pi-permission-system/docs/retro/0301-evaluate-bash-command-chains.md`, which exercises `--fix` on organic data.
   Verify: `git diff` shows only `\u2192` → `→` on line 50; the whole-tree scan exits 0.

6. **`style(pi-permission-system): write the em-dash in an authorizer-chain comment`**

   Replace `\u2014` with `—` at `src/authority/authorizer-chain.ts:47`.
   Verify: `pnpm run check`; `./scripts/release/next-version.sh pi-permission-system` prints the same result before and after the commit.

7. **`build: gate commits on literal Unicode escapes in markdown`**

   The `prek.toml` hook, the `lint` append, and the `lint:fix` append in one commit, so hook and script never disagree.
   Killing mutation: delete the hook entry, then plant `\u2014` in bare prose in a staged scratch `.md` file; it commits.
   With the hook restored, confirm `git commit` decodes it and `pnpm run lint` fails on a planted bare `u2014`, then remove the scratch file.
   Verify: `pnpm run lint` exits 0; record the script's own wall-clock.

8. **`build: decode Unicode escapes in markdown between turns`**

   The `pi-autoformat` formatter entry and `.md` chain insertion.
   The running Pi loaded this config at start, so verify by running the `.md` chain's three commands by hand on a scratch file with and without the new entry: without it `rumdl fmt` leaves `\u2014` in place, with it the file holds `—`.

9. **`docs: document the Unicode-escape gate`**

   `README.md`, `AGENTS.md` line 50, `markdown-conventions`.
   Verify: `pnpm exec rumdl check .`; `node scripts/lint/unicode-escapes.mjs` exits 0 over the edited docs (they quote the escape in backticks); `node scripts/agent-docs/always-loaded.mjs` records the `AGENTS.md` word delta in the commit body.

## Risks and Mitigations

| Risk                                                                                                  | Mitigation                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--fix` decodes a deliberate escape in bare prose                                                     | 0 such mentions today (measured); backticks and `\\u` both keep a literal, and `markdown-conventions` says so after step 9 |
| A hand-written masker misreads some markdown shape and flags a quoted escape                          | The whole-tree scan over all 1242 files is the domain test at step 3; a misread fails loudly, never silently               |
| A bare-token false positive on a real identifier                                                      | Report-only, so it never rewrites; 0 hits today (measured)                                                                 |
| A commit subject with an escape reaches a generated `CHANGELOG.md` and fails CI on the release commit | 0 of the history's subjects carry one (measured); Open Question below                                                      |
| The `style:` commit cuts a `pi-permission-system` release                                             | `cliff.toml` skips `^style`; step 6 verifies with `next-version.sh` before and after                                       |
| An agent's later `oldText` still carries `\u2014` after `pi-autoformat` decoded the file              | The mismatch fails loudly, and `markdown-conventions` already says to copy non-ASCII `oldText` from a fresh `Read`         |

## Open Questions

- Should a `commit-msg` check reject an escape in a subject, since `git-cliff` copies subjects into `CHANGELOG.md`?
  Deferred until one occurs; not filed.
- Should a third `scripts/lint/` script appear, extract `parseArgs` and the tracked-file listing into a shared module then.

[#960]: https://github.com/gotgenes/pi-packages/issues/960
