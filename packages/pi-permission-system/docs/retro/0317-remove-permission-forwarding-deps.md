---
issue: 317
issue_title: "Remove PermissionForwardingDeps; inline polling logic as forwarder methods"
---

# Retro: #317 — Remove PermissionForwardingDeps; inline polling logic as forwarder methods

## Stage: Planning (2026-06-02T00:00:00Z)

### Session summary

Produced the implementation plan for the final step (3 of 3) of the forwarding lift-and-shift: inline the `polling.ts` free functions (`confirmPermission`, `waitForForwardedPermissionApproval`, `processForwardedPermissionRequests`) as private `PermissionForwarder` methods reading `this`, dissolve the `PermissionForwardingDeps` bag into constructor-injected fields, and delete `polling.ts`.
Verified prerequisites [#315] and [#316] are already landed, audited every consumer of the removed symbols, and identified the doc/skill references that name them.

### Observations

- Decisive design call: dissolve the bag into individual `private readonly` fields rather than keeping `this.deps`, driven by the architecture doc's Step 2 note ("a later step … removes the bag").
  The lower-churn `this.deps.<field>` alternative was considered and rejected.
- The constructor gains a new `PermissionForwarderDeps` interface (same shape as the deleted `PermissionForwardingDeps`) consumed at exactly one site (`index.ts`); the `index.ts` object literal is unchanged, only its type annotation.
- Type coupling forces a single `refactor:` commit: deleting `polling.ts` breaks `index.ts`, `permission-forwarder.test.ts`, `permission-forwarding.test.ts`, and a stale `vi.mock` in `runtime.test.ts` simultaneously.
  That stale mock in `runtime.test.ts` is provably unused (`runtime.ts` has no polling import) but must be removed in the same commit to keep module resolution valid.
- `getSessionId` and `formatForwardedPermissionPrompt` are exported from `polling.ts` but have no external consumers — they become module-private functions in the forwarder (verify with `pnpm fallow dead-code`).
- Three doc surfaces reference removed symbols and need updating in a follow-up `docs:` commit: `architecture.md` (mark Phase 3 Step 4 done), `permission-prompter.md` (stale `PermissionForwardingDeps` sentence), and `.pi/skills/package-pi-permission-system/SKILL.md` (the `confirmPermission` testing note).
- The decomposition (`buildForwardedRequest`, `pollForForwardedResponse`, `processSingleForwardedRequest`) clears the code-design bar — the first two return values, the third owns a cohesive per-request workflow reading `this` — so it is genuine design, not procedure-splitting.
- Behavior-preservation safety net: `composition-root.test.ts` "subagent registry sharing" round-trip plus the migrated forwarder behavior tests; this is a `refactor:` cycle (keep green), not red→green.
