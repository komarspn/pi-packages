---
issue: 202
issue_title: "Use `pi-autoformat` tag in all user-visible messages"
---

# Retro: #202 — Use `pi-autoformat` tag in all user-visible messages

## Stage: Planning (2026-05-25T20:00:00Z)

### Session summary

Identified four sites in `extension.ts` that use the bare `autoformat` tag instead of the full `pi-autoformat` extension ID.
Wrote a four-step TDD plan covering the status key, status line label, and steering message prefixes.
Confirmed that `AUTOFORMAT_EXTENSION_ID` is already imported in `extension.ts` and can be reused directly.

### Observations

- Investigated whether `customType: "autoformat-steering"` and the `autoformat:touched` EventBus channel should also change; decided against it — `customType` follows the same no-prefix convention as `subagent-notification` in pi-subagents, and the EventBus channel is internal.
- The `Autoformatted` word in `buildLegacySuccessMessage` is not a tag — it's sentence-initial prose already wrapped by `reportMessage` which prefixes with `[pi-autoformat]`.
- Roughly 13 test assertions in `extension.test.ts` need updating; all are straightforward string replacements.
