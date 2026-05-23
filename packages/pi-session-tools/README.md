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
