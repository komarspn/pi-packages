---
issue: 280
issue_title: "Rename the internal Agent class to Subagent"
---

# Retro: #280 — Rename the internal `Agent` class to `Subagent`

## Stage: Planning (2026-05-31T00:09:51Z)

### Session summary

Produced a numbered implementation plan to rename the subagent-instance cluster in `src/lifecycle/` from the bare `Agent*` family to `Subagent*`, consolidate the duplicate `AgentStatus` union into the public `SubagentStatus`, and update the architecture doc.
The plan is a 7-step refactor (no behavior change), each step an atomic language-service rename that leaves the tree green.

### Observations

- Scope decisions confirmed with the user via `ask_user`: (1) rename the module files too (`agent.ts` → `subagent.ts`, `agent-manager.ts` → `subagent-manager.ts`, plus test/helper files), and (2) full-consistency rename of adjacent identifiers — `subscribeAgentObserver`, the `SubagentManagerObserver` `onAgent*` methods, and the `createTestAgent` helper.
- Layering catch: pointing `WorkspaceDisposeOutcome.status` directly at `service.ts`'s `SubagentStatus` would create a `lifecycle → service` cycle (`service.ts` already imports the workspace collaborator types).
  Resolution: keep the union's single home in the lifecycle layer (`subagent.ts`) and have `service.ts` re-export it, mirroring the existing `LifetimeUsage` / workspace re-export pattern.
- Acceptance-grep catch: the issue's `grep src/lifecycle/` for bare `Agent` matches comments and string literals (e.g. the two `"Agent not configured …"` error messages), not just symbols.
  The language-service rename does not touch those, so each step must sweep residual comment/string occurrences; step 7 has a final grep gate.
- Compound names (`AgentSession`, `AgentInvocation`, `AgentTypeRegistry`, `AgentTool`, `AgentSpawnConfig`) are not bare-word matches and are explicitly out of scope.
- Non-breaking — `refactor:` commits throughout; `verify:public-types` runs after the status consolidation and the final step since the public bundle (`dist/public.d.ts`) is rolled from `src/service/service.ts`.
- Also flagged the `package-pi-subagents` SKILL.md for an internals-naming update (it references `AgentManager`, `Agent`, `make-agent`).
