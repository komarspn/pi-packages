---
issue: 445
issue_title: "pi-subagents: implement native session navigation for any subagent (live or completed)"
---

# Retro: #445 — pi-subagents: implement native session navigation for any subagent (live or completed)

## Stage: Planning (2026-06-22T00:00:00Z)

### Session summary

Produced `docs/plans/0445-native-session-navigation.md`, a sliced plan for Phase 19 Step 4.
The operator (issue author) chose Pi's per-entry TUI-component renderer as the eventual target but explicitly invited a Kent Beck "make the change easy, then make the easy change" breakdown into incremental, releasable additions, and chose `manager.listAgents()`-only as the candidate set.
The plan scopes #445 to the first releasable vertical slice — full list → pick → read-only live transcript using `serializeConversation` text rendering behind a renderer-agnostic `TranscriptSource` seam — and names two follow-ups (TUI-component renderer; evicted-agent file source).

### Observations

- **Two `ask_user` rounds drove scope.**
  Round 1: renderer choice (text vs TUI components) and candidate-set scope.
  Round 2: decomposition strategy.
  The operator's note on round 1 ("If this sounds large, it's probably because it is... what would Kent Beck do") reframed the whole plan from one big issue into a sliced first release.
- **Key architectural finding — the file-snapshot branch is unreachable in #445.**
  `SubagentManager.removeRecord` calls `record.disposeSession()` then `agents.delete(id)` atomically, and `disposeSession()` does not null `subagentSession`.
  So no record in `listAgents()` is ever session-disposed; with the `listAgents()`-only candidate set, every listed session-ready record has a live session, and the dual-source "evicted/untracked → file" branch has no caller.
  Implementing it now would be dead code that fails the `fallow dead-code` gate.
  This sharpened the slice: #445 ships the **live source only** behind the seam.
- **Type-boundary plan.** `AgentMessage` is not in the `@earendil-works/pi-coding-agent` barrel and `@earendil-works/pi-agent-core` is not a dependency, so the plan derives `SessionMessage = SessionContext["messages"][number]` from the barrel-exported `SessionContext` rather than adding a dep. `serializeConversation` takes a mutable `Message[]`, so the renderer spreads (`serializeConversation([...messages])`); `AgentMessage`→`Message` assignability is flagged as a TDD step-2 `pnpm run check` verification with a typed-adapter fallback.
- **Seam justifies its weight via testability, not just the follow-up.** `TranscriptSource` + narrow `NavigableSubagent` interfaces let the pure module be unit-tested with light stubs (no full `Subagent`/`TUI`/`AgentSession`), and decouple the renderer (text→components) from sourcing (live→file) for the two named follow-ups.
- **Doomed-code avoidance.**
  The navigator must not import `message-formatters.ts` or `conversation-viewer.ts` (both deleted in Step 5, [#442]); the streaming indicator is a small local helper and the transcript text is Pi's `serializeConversation`.
- **Open item for ship time:** the architecture roadmap's Step 4 description currently scopes full dual-source + components as one step and will need rescoping to match the slice, plus filing the two follow-up issues.
  Command name `subagent-sessions` is proposed but flagged confirmable.
- Release: ship independently (roadmap Step 4 is `Release: independent`, spike-gated; not part of the "dissolve-agents" batch).
