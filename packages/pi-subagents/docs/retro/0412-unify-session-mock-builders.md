---
issue: 412
issue_title: "Unify the three overlapping session-mock builders in pi-subagents tests"
---

# Retro: #412 — Unify the three overlapping session-mock builders in pi-subagents tests

## Stage: Planning (2026-06-16T00:00:00Z)

### Session summary

Planned the unification of the three `test/helpers/` session-mock builders.
A structural read showed the three sit on two axes (AgentSession-vs-`SubagentSession`, event-bus-vs-factory), that `createSubagentSessionStub` already composes `createMockSession` (intrinsic delegation, not duplication), and that the only genuine independent redeclaration of the four shared base fields lives in `createFactorySession`.
The operator chose targeted reuse with a working-bus core default; the plan folds `createFactorySession` onto the `createMockSession` core and leaves the other two builders untouched.

### Observations

- The issue is the operator's own and explicitly flags the wrong-abstraction risk (Sandi Metz quote), so the `Decide` gate used `ask_user` to choose between full composable factory (A), targeted reuse (B), and decline-and-document (C).
  Operator picked **B** with the **working event bus as the core default**.
- Rejected option A (the issue's literal "Proposed change") because a multi-facet `createSessionMock()` with opt-in `withTurnLoop()`/`withBindFacet()` is the over-parameterized factory the issue itself warns against; the honest target is only `createFactorySession`'s independently-redeclared base.
- De-risked the key feasibility assumption with a throwaway `tsc --noEmit` probe: spreading `...createMockSession()` (which returns `MockSession & Record<string, unknown>`) preserves `Mock<...>` typing on the facet methods because `unknown & Mock<...>` narrows to `Mock<...>`.
- Behavioral delta is the inert→working `subscribe` plus new `emit`/`sessionManager` fields on the factory session; confirmed no factory/lifecycle test emits or asserts on the inert subscribe, and `session.dispose` stays a spy (`create-subagent-session.test.ts:194`).
- Plan is two commits: a `refactor(test):` cycle (one new event-bus self-test + the rewrite) and a `docs:` cycle updating the Phase 17 Step 7 note in `architecture.md` to record the resolution.
