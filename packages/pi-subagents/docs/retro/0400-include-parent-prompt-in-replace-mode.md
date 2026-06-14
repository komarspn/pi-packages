---
issue: 400
issue_title: "perf(pi-subagents): include parent system prompt in replace mode for KV cache reuse"
---

# Retro: #400 — Include parent system prompt in replace mode for KV cache reuse

## Stage: Planning (2026-06-14T00:42:49Z)

### Session summary

Produced a numbered plan for including the parent system prompt as a cacheable prefix in `buildAgentPrompt()`'s replace branch, mirroring the [#180] append-mode reorder.
The change is a single-function edit plus test and README updates, planned across three TDD/docs commits.

### Observations

- Three design decisions were confirmed with the operator (issue author = gh user) before planning:
  1. Ship as breaking `perf!:` with a `BREAKING CHANGE:` footer — replace-mode agents inherit the parent prompt on upgrade with no user edit, and the thin two-line header is removed.
  2. Use `genericBase` as the no-parent fallback, consistent with append mode.
  3. Apply uniformly to all replace agents, including built-in `Explore` and `Plan` (one code path, no special-casing).
- The operator raised a cross-extension concern about the `genericBase` fallback interacting with `@gotgenes/pi-anthropic-auth`.
  Investigation of that package's `system-prompt-shaping.ts` / `request-shaping.ts` showed no new interaction: the `x-anthropic-billing-header` block is prepended unconditionally for OAuth, and de-fingerprinting keys off `PI_DEFAULT_PROMPT_PREFIX` (absent from `genericBase`, which is already neutral).
  Captured this in the plan's Background and Risks.
- `parentSystemPrompt` is a required `string` at the `session-config` layer (sourced from `snapshot.systemPrompt`), so the `genericBase` fallback is effectively a defensive/test-only path in real sessions.
- The thin replace header string (`You are a pi coding agent sub-agent`) appears only in `prompts.ts` and its test — no skill or live doc pins it; README needs three edits (Explore/Plan rows, `prompt_mode` table, Patch 3 `<active_agent>` wording, the last already slightly stale post-#180).
- Notable emergent scope point: `Explore`/`Plan` are built-in replace-mode agents, so this change affects them visibly — surfaced and confirmed rather than assumed.

## Stage: Implementation — TDD (2026-06-14T00:54:46Z)

### Session summary

Completed all 3 TDD cycles in `packages/pi-subagents`.
The change is a single-function edit to `src/session/prompts.ts` (hoist `identity`, rewrite replace branch) plus test updates and README/skill-doc corrections.
Test count went from 973 to 975 (+2 net new tests) across 59 test files.

### Observations

- Step 1 (Red): rewrote 2 existing replace-mode tests and added 2 new ones (4 failures confirmed against old code); the old "ignores parent prompt" test premise inverted cleanly into "includes parent prompt as base."
- Step 2 (Green): hoisting `const identity = parentSystemPrompt ?? genericBase;` above the `if` block and replacing the `replaceHeader` template were the only `src/` changes; also updated two positional `<active_agent>` tests in the same commit since they broke the moment the branch changed (`tagIdx === 0` → `toBeGreaterThan(0)`).
- The `BREAKING CHANGE:` footer wording was taken verbatim from the plan and landed in the `perf!:` commit.
- Pre-completion reviewer: WARN — one finding: `.pi/skills/package-pi-subagents/SKILL.md` still said "prepends" for the `<active_agent>` tag; fixed in a follow-up `docs:` commit before shipping.
- No deviations from the plan's Module-Level Changes list; no lockfile changes; fallow dead-code exited zero.

[#180]: https://github.com/gotgenes/pi-packages/issues/180
