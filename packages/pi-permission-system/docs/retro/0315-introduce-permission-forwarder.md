---
issue: 315
issue_title: "Introduce a PermissionForwarder collaborator that owns forwarding state"
---

# Retro: #315 — Introduce a PermissionForwarder collaborator that owns forwarding state

## Stage: Planning (2026-06-02T11:40:00Z)

### Session summary

Produced the implementation plan for Phase 3, Step 2 of the package roadmap — the first of a three-issue lift-and-shift (#315 → #316 → #317).
The plan introduces a `PermissionForwarder` class that owns the forwarding dependency set and delegates to the existing `polling.ts` free functions, wires `ForwardingManager` to it, and constructs the single forwarder in `index.ts`.

### Observations

- Decided to **reuse `PermissionForwardingDeps` as the constructor parameter** rather than define a parallel `PermissionForwarderDeps` interface.
  The eight bag members are exactly what the delegated free functions still need this issue; a parallel interface would duplicate them field-for-field and be deleted in #317.
  The "owns individual fields" end state is realized in #317 when the bag is dismantled.
- Decided `ForwardingManager` should depend on a **narrow `InboxProcessor` seam** (only `processInbox`), not the concrete `PermissionForwarder`.
  This mirrors the existing `ForwardingController` convention, follows the code-design/design-review guidance (narrow interface over concrete class), and lets `forwarding-manager.test.ts` drop its `as unknown as PermissionForwardingDeps` cast.
- `requestApproval` is introduced now but stays unused by production until #316, when `PermissionPrompter` consumes it via a separate narrow `ApprovalRequester` interface.
- Plan said no architecture-doc edit was required; that was revisited during TDD (see below).
- Tooling note: the repo enforces markdown with **rumdl**, not `markdownlint` — the convention skill phrases rules using markdownlint IDs, which is misleading.

## Stage: Implementation — TDD (2026-06-02T12:00:00Z)

### Session summary

Completed both planned TDD cycles.
Step 1 added `PermissionForwarder` + `InboxProcessor` (`permission-forwarder.ts`) with delegation tests; Step 2 rewired `ForwardingManager` and `index.ts` and migrated `forwarding-manager.test.ts` onto an injected `InboxProcessor` mock.
Test count went from 1753 → 1756 (+3 from the new forwarder suite); the full suite, `check`, `lint`, and `fallow dead-code` are all green.

### Observations

- Both implementation commits are `refactor:` (behavior-preserving), not `feat:` — the suggested commit types in the plan matched.
- The `forwarding-manager.test.ts` rewrite replaced the `vi.mock("../src/forwarded-permissions/polling")` setup with a hoisted `mockProcessInbox` injected as `{ processInbox }`.
  Typed the stub as `vi.fn((): Promise<void> => Promise.resolve())` so it satisfies `InboxProcessor` without a cast, and re-seeded `mockResolvedValue(undefined)` in `beforeEach` (after `mockReset()` the manager's `.finally()` would otherwise call `.finally` on `undefined`).
- Deviation from the plan: the plan stated no architecture-doc edit was required, but Step 1 (#314) is marked `✅` in the roadmap, so for consistency (and to pre-empt a doc-staleness flag) I marked Phase 3 Step 2 `✅` in `architecture.md` with a past-tense outcome and a forward reference to #317.
  Committed separately as `docs:`.
- The `git describe --tags` base (`pi-permission-system-v10.0.0`) predates several already-merged PRs (#314, #292), so `tag..HEAD` diffs include unrelated files; scoped the reviewer to the four #315 commits.
- Pre-completion reviewer: **PASS** — all deterministic checks green, 5/5 acceptance criteria code-verified, no design or dead-code concerns, all 6 Mermaid diagrams parsed.
