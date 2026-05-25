---
issue: 176
issue_title: "Deepen retrospective introspection with model attribution and diagnostic lenses"
---

# Retro: #176 — Deepen retrospective introspection with model attribution and diagnostic lenses

## Stage: Planning (2026-05-25T20:00:00Z)

### Session summary

Produced a 12-step TDD plan spanning pi-subagents (model attribution in `getAgentConversation` and `formatAssistantMessage`), pi-session-tools (two new introspection tools: `read_session` and `read_parent_session`), and the `/retro` prompt (diagnostic lenses).
Confirmed with the user that all four acceptance criteria should be included and that attribution should apply to both the text export and the UI conversation viewer.

### Observations

- The `AssistantMessage` type from `@earendil-works/pi-ai` already carries `provider` and `model` — the attribution change is a pure formatting addition with no SDK gaps to work around.
- `getAgentConversation()` has no existing tests (noted in retro #172), so the TDD plan starts by adding them — a prerequisite win.
- The `formatAssistantMessage()` signature change is backward-compatible (optional parameter), so existing tests and callers continue to work without modification.
- Parent session discovery relies on the `tasks/` directory convention from `deriveSubagentSessionDir()`.
  This is a convention-based approach — not an explicit API — so the plan includes validation and informative error messaging.
- `loadEntriesFromFile()` is exported from `@earendil-works/pi-coding-agent` despite being documented as "exported for testing" — worth monitoring for SDK stability.
- pi-session-tools currently has no tests at all; the new tools will establish the test infrastructure for this package.
