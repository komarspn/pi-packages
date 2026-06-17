---
issue: 418
issue_title: '[Bug] Even though "Allow" is configured, the permission system still prompts for confirmation on access requests'
---

# Retro: #418 — Even though "Allow" is configured, the permission system still prompts

## Stage: Planning (2026-06-17T14:17:37Z)

### Session summary

Diagnosed the reported false external-directory prompt as a symlink-vs-pattern-matching bug: both external-directory gates resolve `/tmp` → `/private/tmp` (the macOS symlink) before matching, so the user's `/tmp/*` pattern never hits.
The actual firing surface in the report is the **bash** gate (`toolName: "bash"`, `ls -la /tmp/`), driven by `BashProgram.externalPaths` returning the canonical path; the tool gate (`describeExternalDirectoryGate`) has the same defect via `canonicalNormalizePathForComparison` (whose own docstring says "not for pattern matching").
Produced a 6-step TDD plan that matches `external_directory` patterns against both the typed and the symlink-resolved forms as aliases, keeping the canonical path only for the outside-CWD boundary and infra-read checks.

### Observations

- This is a third-party issue (`lipaysamart`); ran the `ask_user` direction gate.
  Operator chose **fix it** and **match both typed and resolved forms** (not lexical-only).
- Deliberately reused the existing resolver surface by adding an optional `surface` param to `resolvePathPolicy`/`checkPathPolicy` rather than adding a new method — architecture.md lines 594–595 flag resolver-surface widening as a risk, and `evaluateAnyValue` (last-match-wins across aliases) is already wired for `PATH_SURFACES`, so the alias mechanism is free.
- Kept `BashProgram.externalPaths(): string[]` shape (value semantics change canonical → lexical, dedup identity stays canonical) to avoid churning its 29 test references; most use synthetic non-existent paths where `canonicalizePath` no-ops.
- Flagged the #393 false-green risk: the gates now resolve through `checkPathPolicy`, so `makeHandler` must route the `external_directory` surface onto `checkPathPolicy` or `makeSurfaceCheck`-driven tests silently pass `allow`.
  The step-5 real-instance acceptance test (real tmpdir symlink) is the backstop.
- Noted a security upside worth keeping in the commit body: the fix also closes a silent-allow hole where a symlinked **deny** (`/tmp/*: deny`) previously fell through to the `*` fallback.
- The tool gate gains a `resolver` parameter (mirroring `describePathGate`); its `input` becomes `{}` and it carries a `preCheck`, like the bash gate already does.
- Distinct from #413 (docs-only discoverability of the `external_directory` allow-list): #418 is a genuine matching bug where the right surface and pattern were already configured.

## Stage: Implementation — TDD (2026-06-17T14:53:29Z)

### Session summary

Implemented the fix across 6 commits (the plan's 6 TDD steps), though steps 3 and 4 were merged into one `fix:` commit (see Observations).
The full suite went from 2003 to 2015 tests (+12, +1 new acceptance test file); `pnpm run check`, `pnpm run lint`, and `pnpm fallow dead-code` are all clean.
Both external-directory gates now match a path's typed and symlink-resolved aliases on the `external_directory` surface, fixing the reported `/tmp/*` false prompt while keeping the canonical path for the outside-CWD boundary.

### Observations

- **Steps 3 and 4 merged.**
  The plan listed the bash gate (step 3) and tool gate (step 4) as separate commits, but the `external-directory-session-dedup` test couples them: a bash command approves a directory for the session, then a `read` must reuse that approval.
  Because step 3 moved the bash approval pattern from the canonical (`/private/tmp/*`) to the lexical (`/tmp/*`) namespace, the tool gate had to move to the same namespace in the same commit or the cross-tool dedup test would fail with a green suite.
  Folded both into one `fix:` commit with the rationale in the body.
- **#393 false-green bit twice.**
  Two integration tests (`external-directory-session-dedup.test.ts`, `tool-call.test.ts`) and the dedup shutdown test silently passed `allow` once the gates routed through `checkPathPolicy`.
  Fixed by threading the `surface` arg through `makeHandler`'s `checkPathPolicy` dispatcher, and by adding a delegating `checkPathPolicy` mock to the two inline handlers in the dedup test that override `permissionManager.checkPermission` directly (not via the session bag).
  The full suite — not the edited file — was the only thing that caught these, exactly as the package skill warns.
- **Acceptance test fixture artifact.**
  The real-symlink acceptance test's "allow keyed on the resolved path" case initially failed on macOS because `mkdtemp` returns an unresolved `/var/folders/...` path while `realpathSync` resolves `/var` → `/private/var`.
  Fixed by keying that one config pattern on `realpathSync(realDir)`.
  The typed-path and bash cases needed no such adjustment.
- **No new resolver method.**
  Generalized the existing `resolvePathPolicy`/`checkPathPolicy` with an optional `surface` param (default `"path"`) rather than adding a method, honoring the architecture's resolver-surface-widening risk note.
  `gate-fixtures.ts` needed no change — its `vi.fn<ScopedPermissionResolver["resolvePathPolicy"]>()` stubs picked up the new optional param automatically.
- **Pre-completion reviewer: PASS** — all deterministic checks green, docs/architecture/SKILL alignment verified, Mermaid diagrams validated, cross-step invariants (#352, #393, bash config-deny, canonical boundary) confirmed test-pinned.
  No WARN findings.
