# @gotgenes/pi-session-tools

Pi extension providing session metadata tools for multi-session workflows.

## Tools

### `set_session_name`

Set the current session's display name (shown in the session selector).

```text
set_session_name({ name: "#42 Planning — Extract ExtensionPaths" })
```

Use a stage-encoded format to identify both the issue and workflow stage:

| Stage         | Format                       |
| ------------- | ---------------------------- |
| Planning      | `#N Planning — <title>`      |
| TDD           | `#N TDD — <title>`           |
| Build         | `#N Build — <title>`         |
| Retrospective | `#N Retrospective — <title>` |

### `get_session_name`

Get the current session's display name, if one has been set.

```text
get_session_name({})
```

### `read_session`

Read the current session's entries as a structured transcript.
Useful for retro lenses and cross-session context.

```text
read_session({ types?: string[], limit?: number })
```

Parameters:

- `types` — filter to specific entry types (e.g. `["message", "compaction"]`).
  Omit for all.
- `limit` — return only the most recent N entries after filtering.

The output is a human-readable transcript: numbered user/assistant turns, one-line tool call summaries with correlated result status, and metadata events (compaction, model changes).
Tool result bodies, thinking content, and image data are omitted.

```text
1. user
How do I fix the login bug?

---

2. assistant [anthropic/claude-sonnet-4-20250514]
Let me check the auth flow.
  [tool] Read — path: src/auth/login.ts → completed
  [tool] Bash — command: pnpm vitest login → error
The test is failing because...

---

[compaction] Context compacted (48000 tokens before)

---

[model change] → anthropic/claude-opus-4-20250514
```

### `read_parent_session`

Read the parent session's entries as a structured transcript when running inside a subagent.
Derives the parent session file from the subagent directory layout.
Returns an error if not running in a subagent context.

```text
read_parent_session({ types?: string[], limit?: number })
```

Parameters and output format are the same as `read_session`.

## Install

```bash
pi install @gotgenes/pi-session-tools
```

Or add to `.pi/settings.json`:

```json
{
  "packages": ["npm:@gotgenes/pi-session-tools"]
}
```
