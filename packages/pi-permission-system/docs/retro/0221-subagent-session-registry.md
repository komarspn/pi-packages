---
issue: 221
issue_title: "Expose subagent session registry and tool-level permission query on PermissionsService"
---

# Retro: #221 — Expose subagent session registry and tool-level permission query

## Stage: Planning (2026-05-25T18:00:00Z)

### Session summary

Filed issue #221 as a prerequisite for #101 (native permission-system awareness for in-process subagents).
Explored both `pi-permission-system` and `pi-subagents` in depth to identify the exact friction points blocking #101, then designed the registry approach and wrote the implementation plan.

### Observations

- The filesystem-based detection path (`subagentSessionsDir`) is fundamentally incompatible with pi-subagents' session directory layout (`<parent-dir>/<basename>/tasks/` vs `<agentDir>/subagent-sessions/`).
  This isn't a configuration issue — the path structures serve different purposes and cannot be aligned without breaking one package's conventions.
- `PermissionManager.getToolPermission()` already exists with clean semantics; exposing it on the service is a trivial one-line delegation.
  The real work is threading the registry through detection and forwarding.
- The `resolvePermissionForwardingTargetSessionId` function currently lacks `sessionDir` in its options — the registry lookup requires adding this parameter, which cascades through `confirmPermission` and `waitForForwardedPermissionApproval`.
  Steps 3–5 in the TDD order handle this cascade incrementally.
- Session originally started as planning for #101, but pivoted to filing and planning #221 after identifying that pi-permission-system prep work would make #101 trivial.
  Issue #101's plan is deferred until #221 is implemented.
