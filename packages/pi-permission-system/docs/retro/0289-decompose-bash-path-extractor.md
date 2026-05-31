---
issue: 289
issue_title: "Decompose bash-path-extractor.ts: shared token rejection + collect* complexity"
---

# Retro: #289 — Decompose `bash-path-extractor.ts`

## Stage: Planning (2026-05-31T13:44:10Z)

### Session summary

Produced a 4-cycle TDD plan for Phase 2 Step 4: extract the shared token-rejection prelude and pure classifiers into a new `bash-token-classification.ts` module, then reduce the two `collect*` walker hotspots.
The plan is behavior-preserving — existing `bash-external-directory.test.ts` integration suites stay unmodified — with new unit tests added only for the extracted classifiers.

### Observations

- The file has exactly two exports (`extractExternalPathsFromBashCommand`, `extractTokensForPathRules`); every other symbol is private, and a grep across `src/`, `test/`, and the package SKILL confirmed no external consumer of the internals.
  This gave the extraction zero external blast radius.
- Two design forks were surfaced via `ask_user`.
  Chosen: (1) a new `bash-token-classification.ts` module with public API + dedicated unit tests (over keeping helpers private in-file), and (2) converting `collect*` to return-based `string[]` (over preserving the mutated `tokens` accumulator).
- Validated each extraction against the `code-design` "returns a value / owns state / gives behavior to data" test: `rejectNonPathToken` returns a boolean and removes a genuine clone; `classifyPatternCommandFlag` returns a discriminated-union directive (moves the flag decision onto data); the return-based conversion removes an output-argument pattern rather than relocating statements.
- Kept `rejectNonPathToken` and `classifyPatternCommandFlag` private to avoid a `fallow` dead-export flag — only the two classifiers (consumed by the walker) are exported.
- Flagged the Biome/ESLint assertion conflict up front: the `consume-arg` directive variant carries a non-optional `nextArgAction` so the `switch` narrows without `!` or `as`.
- The `collect*` return-based conversion must land in a single commit (Step 3) because the mutual recursion and shared accumulator break at the type level if split.
