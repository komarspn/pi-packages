---
issue: 193
issue_title: "SubagentRuntime owns context queries"
---

# Retro: #193 — SubagentRuntime owns context queries

## Stage: Planning (2026-05-24T21:00:00Z)

### Session summary

Planned the Layer 1 change that types `SubagentRuntime.currentCtx` as `SessionContext`, adds three query methods (`buildSnapshot`, `getModelInfo`, `getSessionInfo`), and eliminates 4 `as any` casts from `index.ts`.
The plan covers 7 TDD steps touching `runtime.ts`, `handlers/lifecycle.ts`, `parent-snapshot.ts`, `context.ts`, `service-adapter.ts`, and `index.ts`.

### Observations

- The `pi` field in `currentCtx` is never read back — only stored.
  Dropping it is safe; `SessionLifecycleHandler` already holds `pi` as a constructor param.
- `ExtensionContext` structurally satisfies `SessionContext`, so changing `buildParentSnapshot`'s param type is source-compatible with the `/agents` command handler that passes raw SDK `ctx`.
- `service-adapter.ts` gets the biggest structural change: its two closure params (`getCtx`, `getModelRegistry`) collapse into a single `ServiceRuntimeLike` interface.
- No design ambiguity — the architecture doc's Layer 1 spec and the issue body are fully aligned.
- Test fixtures in `make-deps.ts` are unaffected because the `AgentToolDeps` interface shape doesn't change — only the wiring in `index.ts` that supplies the implementations changes.

## Stage: Implementation — TDD (2026-05-24T20:30:00Z)

### Session summary

Completed all 6 implementation TDD steps plus an architecture doc update in one session.
The `getSessionInfo` implementation needed `?.sessionManager.getSessionFile()` (not `?.sessionManager?.getSessionFile()`) since `sessionManager` is a required field of `SessionContext` — ESLint's `no-unnecessary-condition` caught this at the pre-commit hook.
Final test count: 854 (up from 848 baseline, +6 new tests for `buildSnapshot`, `getModelInfo`, `getSessionInfo`).

### Observations

- The plan's Non-Goals section incorrectly said `buildParentContext` would NOT change.
In practice it had to accept `SessionContext` instead of `ExtensionContext` — they are not substitutable in that direction.
The Module-Level Changes list was correct; only the Non-Goals prose was wrong.
- `context.ts` needed a local `BranchEntry` union type to handle `getBranch(): unknown[]`.
TypeScript's discriminated union narrowing doesn't work when the union includes a catch-all `{ type: string }` arm — explicit casts within each `if` branch were required.
- `service-adapter.ts` ended up using `runtime.currentCtx.modelRegistry` directly (no `getModelInfo()` call needed in the service adapter) — `ServiceRuntimeLike` only needs `currentCtx` and `buildSnapshot`.
This is cleaner than the plan's `getModelInfo(): { modelRegistry: unknown }` approach.
- Biome's `noUnusedPrivateClassMembers` warning caught the leftover `private readonly pi: unknown` in `SessionLifecycleHandler`.
Removed `pi` from the constructor entirely (rather than adding `_` prefix), which also cleaned up `index.ts`.
- The `eslint-disable` directive at the top of `index.ts` had two now-unused entries (`no-unsafe-member-access`, `no-unsafe-call`) removed by `eslint --fix`.
