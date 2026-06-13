---
issue: 395
issue_title: "feat(pi-permission-system): deny patterns with custom reason"
---

# Retro: #395 — feat(pi-permission-system): deny patterns with custom reason

## Stage: PR Review (2026-06-13T01:30:06Z)

### Session summary

Third-party PR #395 (author `@k0valik`, not the repo owner) extends the flat permission config with an object syntax for deny rules carrying an optional custom `reason`, surfaced to the agent in the block message (e.g. `npm *` → deny, `Reason: Use pnpm instead`).
The underlying problem is real: a denied command currently yields only a generic block message, so the agent is told *no* but never *why* or *what to do instead* — a denial that teaches is more actionable.
Operator's chosen direction: **adopt the capability with our own simplified design**, planned via `/plan-issue`; use the PR as reference, not the merge target.

### Evaluation

What is valuable (keep):

- The capability and API shape — `reason` threaded onto `Rule` (`rule.ts`) and `PermissionCheckResult` (`types.ts`), surfaced in `buildToolDenyBody` (`denial-messages.ts`) as `Reason: <reason>.` appended after the sentence-ending period.
- Backward-compatible config syntax `{ "action": "deny", "reason": "..." }`; existing string values are untouched.
- Schema (`schemas/permissions.schema.json`), example (`config/config.example.json`), `docs/configuration.md`, and TypeScript types all kept aligned — matches the package's "keep schema/example/docs/loader/types aligned" rule.
- Non-breaking and least-privilege-preserving: the object form only annotates `deny`, so it can never loosen policy (deny stays deny; `reason` is purely explanatory). `feat:` (not `feat!:`) is correct.
- Solid test coverage (17 new tests across `normalize`, `rule`, `denial-messages`, `permission-manager-unified`), including malformed-`reason` rejection and last-match-wins propagation.

What I would change (over-built / divergent — simplify in our design):

- **Duplicated type guard.**
  `isDenyWithReason` is defined twice — in `normalize.ts` (typed `value is DenyWithReason`) and in `config-loader.ts` (typed against an inline anonymous `{ action: "deny"; reason?: string }`, not the named `DenyWithReason`).
  Two copies of the same predicate with divergent annotations.
  Collapse to one shared guard beside `isPermissionState` in `common.ts`, returning `value is DenyWithReason`.
- **Single-inhabitant discriminator.**
  `DenyWithReason.action` can only ever be `"deny"` — schema pins it `"const": "deny"`, both guards check `=== "deny"`, and `normalize.ts` hardcodes `action: "deny"` when building the rule.
  It carries no runtime information beyond disambiguating "this object is a deny-with-reason" from "this object is a nested pattern map" (see the `top-level DenyWithReason object is treated as pattern map` test).
  This is the envelope-whose-only-consumed-field-is-one-value smell the design heuristics flag.
  **Operator decision: keep the explicit `{ action, reason }` shape** — the disambiguation it provides is real and the explicitness is forward-compatible — but treat it as the part to scrutinize, not extend.
- **`PatternValue` type** (minor) — introduced and threaded into `FlatPermissionConfig`; confirm it earns its keep versus inlining `PermissionState | DenyWithReason`.

Surface/security: this is a permission package, so the review weight is on what the change exposes.
The change only adds an annotation to `deny`; it cannot widen access.
No new permission surface, no default change on upgrade.
Least-privilege intact.

Mechanic confirmed during review (drives the scope non-goal): only `deny` reasons reach the agent.
`applyPermissionGate` (`permission-gate.ts`) returns `{ action: "block", reason: messages.denyReason }` for `deny`, and that block reason becomes the tool result the agent reads.
For `ask`, the gate triggers an interactive `GatePrompter.prompt()` to the human user; the agent only sees the outcome, so an `ask` reason would be human-prompt context only and never cause agent backtracking.
For `allow`, nothing is surfaced.
Hence deny-only captures 100% of the agent-facing value.

### Decision and attribution

Direction: **adopt the capability, plan a simplified design** (`/plan-issue #395`).
The retro records the decision so `/plan-issue`'s Decide gate is satisfied — it should plan around this, not re-litigate.

Agreed scope:

- Capability: a custom `reason` on **deny** rules, surfaced in the agent-facing block message.
- Object shape: keep the explicit `{ "action": "deny", "reason": "..." }` form (operator's call).
- Simplify: collapse the two `isDenyWithReason` guards into a single shared guard (in `common.ts`), using the named `DenyWithReason` type at both call sites; reassess whether `PatternValue` earns its keep.

Non-goals:

- No reason on `ask` (would be human-prompt context only — different, weaker, human-facing consumer).
- No reason on `allow` (invisible — dead weight).
- No change to defaults or to any existing string-form config.

Attribution (required durable credit):

- Every implementation/docs commit in `/plan-issue` → `/tdd-plan` carries, at the end of the body after a blank line:

  ```text
  Co-authored-by: k0valik <85703878+k0valik@users.noreply.github.com>
  ```

  The PR commit recorded a placeholder email (`kovalik@example.com`); the GitHub no-reply form (user id `85703878` + login) is used so the trailer links to `@k0valik`'s profile.
- The ship-stage PR/issue close comment thanks `@k0valik` by name and links the implementing SHA(s).
- Never use `Closes #395` in a commit (pre-empts the curated close comment); reference as `Refs #395` / `(#395)`.
