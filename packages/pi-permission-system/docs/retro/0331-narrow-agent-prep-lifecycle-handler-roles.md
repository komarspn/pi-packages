---
issue: 331
issue_title: "Narrow AgentPrepHandler and SessionLifecycleHandler against role interfaces"
---

# Retro: #331 — Narrow AgentPrepHandler and SessionLifecycleHandler against role interfaces

## Stage: Planning (2026-06-03T22:30:12Z)

### Session summary

Produced a four-step plan to retype `AgentPrepHandler` and `SessionLifecycleHandler` against narrow per-handler session role interfaces (`AgentPrepSession`, `SessionLifecycleSession`) instead of the concrete `PermissionSession`, completing the handler-narrowing arc started by [#325].
The plan reuses the existing two-method `GateHandlerSession` context role for `AgentPrepHandler` and drops the last two `as unknown as PermissionSession` casts in the handler test tree.

### Observations

- `AgentPrepHandler` calls `resolveAgentName(ctx, systemPrompt)` (two args), but `GateHandlerSession.resolveAgentName` is declared single-arg.
  Resolved by widening the role method to an optional `systemPrompt` parameter — behavior-neutral for the gate handler and already present on the concrete method.
  Alternative (a separate `AgentPrepSession.resolveAgentName` declaration) was rejected because the issue directs reusing the context role rather than redefining it.
- `SessionLifecycleHandler` uses `resolveAgentName` but never calls `activate`, so it deliberately does **not** reuse `GateHandlerSession` (that would carry an unused method — an ISP violation).
  Its role declares `resolveAgentName` independently; the signature overlap with `GateHandlerSession` is accepted as normal for role interfaces.
- `AgentPrepHandler` passes `this.session` to `resolveSkillPromptEntries`, so `AgentPrepSession` extends the existing `SkillPermissionChecker` role (`checkPermission`) in addition to `GateHandlerSession`.
- The current `before-agent-start.test.ts` mock carries vestigial `logger` and `getActiveSkillEntries` fields the handler never reads; the retyped literal must drop both or TypeScript's excess-property check rejects them once the cast is gone.
- No `index.ts` wiring change is needed — `PermissionSession` implements the new roles, so it stays assignable to the narrowed constructor parameters.
- Architecture doc already lists this as Phase 3 Step 14; the plan only needs to mark it ✅ and record the role names plus the `resolveAgentName` widening.
- Decided against extracting a shared `refreshConfig` micro-role (single shared method does not clear design-review check 7); declaring it on each role is cheaper than the wrong abstraction.

## Stage: Implementation — TDD (2026-06-03T22:40:34Z)

### Session summary

Implemented all four TDD steps: introduced `AgentPrepSession` and `SessionLifecycleSession` role interfaces, widened `GateHandlerSession.resolveAgentName` to accept an optional `systemPrompt`, added both roles to `PermissionSession`'s `implements` list, retyped both handler constructors, and dropped the last two `as unknown as PermissionSession` casts in the handler test tree using the `vi.fn<T>()` per-field pattern.
No new tests were added (behavior-preserving refactor; existing suite plus `pnpm run check` was the safety net).
Test count held at 84 files / 1817 tests.

### Observations

- Plan deviation: the `before-agent-start.test.ts` mock's `checkPermission` default used `{ state: "allow" }` in the original, but `PermissionCheckResult` requires `toolName`, `source`, and `origin` too.
  Fixed by importing `makeCheckResult` from the shared `handler-fixtures.ts` to build a complete default result — cleaner than duplicating the full shape inline.
- The `vi.fn<AgentPrepSession["method"]>()` pattern worked cleanly for all 11 methods across the two mocks; no union-type erasure issues because the `??`-per-field approach (not spread) was used throughout.
- Pre-completion reviewer: PASS.
  Reviewer WARN: `SessionLifecycleHandler` accesses `session.logger.warn/debug` — a two-hop Law of Demeter reach-through — noted as a pre-existing pattern intentionally carried forward (the `SessionLifecycleSession` role exposes `readonly logger` by design).
  No action required before `/ship-issue`.
