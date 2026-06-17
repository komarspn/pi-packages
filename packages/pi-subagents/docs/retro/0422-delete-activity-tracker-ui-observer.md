---
issue: 422
issue_title: "pi-subagents: delete AgentActivityTracker and ui-observer, drop the activity map from the core"
---

# Retro: #422 — Delete AgentActivityTracker and ui-observer, drop the activity map from the core

## Stage: Planning (2026-06-17T00:00:00Z)

### Session summary

Planned Phase 18 Step 3 of the activity-tier disentanglement spine: deleting `AgentActivityTracker` and `ui-observer`, and removing `SubagentRuntime.agentActivity` plus the tracker wiring in the two spawn tools.
Verified the prerequisites (#420, #421) are both closed and that the trackers/map are now write-only dead state after the reader migration.
Wrote a four-step plan (two `refactor:` deletion commits, a module-delete commit, a `docs:` sweep) at `packages/pi-subagents/docs/plans/0422-delete-activity-tracker-ui-observer.md`.

### Observations

- The change is **non-breaking** and internal-only: `AgentActivityTracker`, `ui-observer`, and `agentActivity` are absent from the public service surface (`service.ts`) and settings entry, so no `BREAKING CHANGE` footer.
  Issue author is the operator (`gotgenes`) and the proposed change is unambiguous and roadmap-driven, so the `ask-user` gate was skipped.
- The foreground `observer.onSessionCreated` callback **stays** — it is still the only place `recordRef`/`fgId` bind mid-flight and where `widget.ensureTimer()` fires; only the tracker lines are stripped.
  The background `observer` block, by contrast, did only tracker work and is removed entirely.
- Commit ordering matters: Step 1 (spawners stop passing `agentActivity`) must precede Step 2 (remove the runtime field), or the build breaks.
  Both the param removal and the field/`AgentActivityAccess` removal cascade to call sites and tests at the type level, so each is folded into a single commit.
- Re-render cadence: dropping `subscribeUIObserver` removes event-driven foreground re-renders, leaving the existing 80 ms spinner poll.
  Content is identical within ≤80 ms (the poll reads the same record the core observer populates) — pinned by the streaming-`onUpdate` test, noted as a risk not a regression.
- Found a **pre-existing stale doc** from #421: `architecture.md` still says "the widget reads agent state by polling a shared `Map<string, AgentActivityTracker>`", though #421 already moved the widget onto records.
  Folded that correction into this plan's Step 4 doc sweep alongside the file tree, two Mermaid diagrams, and the SKILL.md domain counts (UI `12 → 10`, header `59 → 57` files).
- Confirmed no orphaned sibling exports: `SessionLike` (used by `subagent-session.ts`) and `SubscribableSession` (used by `record-observer.ts`, `subagent-session.ts`, `types.ts`) both survive the module deletion; `pnpm fallow dead-code` is the Step 3 backstop.
