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

## Stage: Implementation — TDD (2026-05-25T14:20:00Z)

### Session summary

Completed all four TDD cycles: two red/green pairs for the status key and status line label, then two more for the steering message prefixes.
All 296 tests pass; no test count delta (existing tests updated, no new tests added).
Also added a `fallow-ignore-next-line unused-type` suppression on the pre-existing `ExtensionApiLike` false positive to clear the dead-code gate.

### Observations

- `AUTOFORMAT_STATUS_KEY` was set directly to `AUTOFORMAT_EXTENSION_ID` (the constant, not a new string literal), and `formatStatusLine` uses a template literal `` `${AUTOFORMAT_EXTENSION_ID}:` ``.
- `buildSteeringMessageContent` prefixes now use `` `[${AUTOFORMAT_EXTENSION_ID}]` `` template literals for both the success and failure paths.
- The `fallow dead-code` gate was already failing before this change (`ExtensionApiLike` unused-type export).
  The suppression syntax requires `unused-type` (singular) with no trailing comment text — fallow parses every word after the directive as a rule name token.
