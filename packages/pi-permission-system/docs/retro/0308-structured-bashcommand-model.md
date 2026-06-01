---
issue: 308
issue_title: "Introduce a structured BashCommand model and parse the bash command once per tool_call"
---

# Retro: #308 — Structured BashCommand model and parse-once injection

## Stage: Planning (2026-06-01T00:00:00Z)

### Session summary

Issue #308 was created during what began as the `/plan-issue 306` session, after the owner asked "what architecture or system design changes would make #306 easier?"
and chose to pay the foundation upfront.
The friction analysis surfaced that the three bash gates each parse the command independently (three parses per `tool_call`) and apply three subtly different AST descent policies, and that the command-pattern unit is a flat `string[]` re-derived per feature — the divergence that produced the #301-class bug.
This issue captures the behavior-preserving enabler (a `BashCommand` model for the command-pattern slice plus a single shared parse injected into the gates); #306 (nested-context descent) and #307 (effective-cwd projection) become consumers, mirroring the #304 → #301 split.

### Observations

- Scope was deliberately trimmed from the issue's first draft.
  The original #308 body claimed "path candidates, external paths, and command-pattern units all derive from `commands()`."
  Planning showed that is not behavior-preserving in one step: `pathTokens()`/`externalPaths()` walk the **whole** tree (incl. substitution/subshell interiors), whereas `topLevelCommands()` emits compound statements (`subshell`, `compound_statement`) **whole** and descends only `program`/`list`/`pipeline`/`redirected_statement`.
  A flat `commands()` cannot serve both at the right depth.
  So #308 models only the command-pattern slice; the path/external slices stay as methods on the shared parse and converge per-command in #307 (which needs it anyway).
  The #308 issue body was corrected to match.
- `BashCommand` is intentionally a one-field type (`text`).
  Adding `context`/`name`/`argv`/`pathCandidates`/`effectiveCwd` now would be a fallow-flagged dead field; each is added by its consuming issue (#306 adds `context`, #307 adds the path/cwd fields).
  The value of introducing the object now is the stable extension seam — #306/#307 add fields rather than migrate a `string[]` return type.
- The 1027-line `test/bash-external-directory.test.ts` exercises the `extractTokensForPathRules` / `extractExternalPathsFromBashCommand` facades directly (~90 call sites). #304 kept those facades for exactly this suite (lift-and-shift).
  So #308 keeps them and switches only the **production gates** to the injected `BashProgram`; the facades become a test-only seam (fallow treats tests as consumers, so they stay live).
  Fully retiring them is a deferred cleanup.
- AST shapes were verified with a throwaway `web-tree-sitter` probe before writing assertions: `command_substitution` wraps `$(…)` and backticks; `process_substitution` wraps `<(…)`/`>(…)`; `subshell` wraps `( … )`; `file_redirect` is a **sibling** of the command inside `redirected_statement` (redirect targets attach to that command); `compound_statement` is the `{ … }` brace group, which runs in the current shell (relevant to #307's `cd`-scoping, not #308).
- `resolveBashCommandCheck` is reshaped from "parse internally via an injectable `decompose`" to "combine a caller-supplied `units` list," moving decomposition into the handler so it flows from the single shared parse.
  The `?? checkPermission(command)` empty-units fallback is preserved (never-weaker).
- New `BashProgram.commands()` needs the `// fallow-ignore-next-line unused-class-member` suppression (singular kind, no trailing prose) — the private-ctor + static-factory false positive documented in the #304 retro.
- Sibling issues filed this session: #307 (project a running effective working directory across `cd`s onto path candidates) and #309 (unify the advisory `checkPermission`/RPC bash path with the gate's decomposed fidelity — deferred because it needs a warm parser and changes public sync-API semantics; it is advisory-path polish, not an enforcement gap, since the gate is already decomposed).
- Ship-time warning carried forward from the #301 retro: this is a `refactor:`-heavy enabler; if it ships stacked under #306, release-please omits it from the changelog, so #308 must be closed explicitly.

### Diagnostic details

- **Feedback-loop gap analysis** — Steps 1–3 are each paired with `pnpm run check` in the plan because they are behavior-preserving signature changes the type checker catches before the suite; step 3 additionally runs the full suite because `resolveBashCommandCheck` is a shared helper.
- **Escalation-delay tracking** — The "single flat `commands()` for all slices" design was abandoned once the `compound_statement`/`subshell` whole-emit parity issue surfaced during AST verification, before any plan text committed to it.

## Stage: Implementation — TDD (2026-06-01T23:37:13Z)

### Session summary

Implemented the structured `BashCommand` model and parse-once injection across four TDD steps (three `refactor:` code commits + one `docs:` commit), plus a follow-up `refactor:` cleanup of stale fallow suppressions.
`BashProgram.topLevelCommands(): string[]` became `commands(): BashCommand[]`; `PermissionGateHandler` now parses the bash command once per `tool_call` and injects the shared `BashProgram` into all three bash gates; `resolveBashCommandCheck` became a pure combiner over caller-supplied `units`.
Test count unchanged (1704 → 1704 — the renamed/reshaped suites assert the same coverage); `pnpm run check`, `pnpm run lint`, `pnpm run test`, and `pnpm fallow dead-code` all green; no permission decision changed.

### Observations

- Deviation from the plan: the plan kept the two bash path gates and `resolveBashCommandCheck` `async` (returning `Promise<...>`) "to keep the handler's `await` call site and the gate-producer signature unchanged."
  Once parsing moved into the handler, none of these three functions performs async work, and eslint `@typescript-eslint/require-await` (on for `src/`, off for `test/` per the root `eslint.config.js` override) rejected an `async` function with no `await`.
  So `describeBashPathGate`, `describeBashExternalDirectoryGate`, and `resolveBashCommandCheck` were made **synchronous** (`GateResult` / `PermissionCheckResult`), and the handler's bash tool-gate producer is synchronous too.
  This is the honest, lint-clean outcome and aligns the two bash path gates with their already-synchronous siblings (`describePathGate`, `describeExternalDirectoryGate`); the `gateProducers` array type `Array<() => GateResult | Promise<GateResult>>` and the `await produce()` loop accept both shapes with no call-site change.
  The plan's note that the resolver "stays async" did not anticipate the `require-await` rule.
- The gate suites construct a real `BashProgram` via a local `describeGate` helper that mirrors the handler's parse-once derivation exactly (`tcc.toolName === "bash" && command ? await BashProgram.parse(command) : null`), so the gates are exercised through the production wiring rather than a hand-built token list.
- Fallow surfaced two stale suppressions after step 2/3: with the gates calling `pathTokens()` / `externalPaths(cwd)` directly on the injected `BashProgram` **parameter**, fallow resolves both methods as used, so their `unused-class-member` suppressions became stale.
  `commands()` keeps its suppression because it is only ever called on an **inferred-type** value (the handler's `const bashProgram = … ? await BashProgram.parse(command) : null`), which fallow cannot resolve through.
  The fallow gate runs from the repo root (203 entry points); the suppression cleanup also relocated the `externalPaths` JSDoc, which had drifted above `commands()` (pre-existing jumble from #301/#304).
- The empty/missing-command bash edge changed routing shape but not the decision: the old code always routed bash through `resolveBashCommandCheck("", …)`, which fell back to `checkPermission("bash", { command: "" })`; the new handler routes a null `bashProgram` (empty command) to the else branch `checkPermission("bash", tcc.input, …)`.
  The full suite (including `tool-call.test.ts`) stayed green, confirming no observable decision change.
- The extractor facades (`extractTokensForPathRules`, `extractExternalPathsFromBashCommand`) are untouched and remain live via the 1027-line `test/bash-external-directory.test.ts` characterization suite (the #304 lift-and-shift seam); they are now a test-only seam in production terms.
- Pre-completion reviewer verdict: **PASS** (all deterministic checks green; deviation to sync gates verified behavior-preserving; Mermaid diagrams parsed clean; dead-code clean).
- Ship-time warning still applies: this is a `refactor:`-heavy enabler; release-please omits `refactor:` commits from the changelog, so if #308 ships stacked under #306 it must be closed explicitly.
