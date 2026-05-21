---
issue: 78
issue_title: Change denied tool message
---

# Soften denial messages

## Problem Statement

When a tool call is denied — either by policy or by the user at an interactive prompt — the extension appends a "Hard stop" suffix to the denial reason returned to the agent:

> Hard stop: this permission denial is policy-enforced.
> Do not retry or investigate bypasses; report the block to the user.

This aggressive language causes the LLM to interpret the denial as a blanket ban on *all* similar operations (e.g., all writes), not just the specific call that was denied.
The result is reduced utility: the agent avoids subsequent tool calls it would otherwise be allowed to make.

## Goals

- Replace every "Hard stop" denial suffix with informative, scoped language that describes *what* was denied, *who* denied it (policy rule vs. user prompt), and *why* (including any user-supplied reason), without prescribing what the agent should do next.
- Consolidate the three inline "Hard stop" strings in gate descriptors into calls to shared formatting functions, eliminating text duplication.
- Update all test assertions that match on "Hard stop" to reflect the new wording.

## Non-Goals

- Making the denial message user-configurable (possible follow-up).
- Refactoring the gate descriptor structure or the `GateDescriptor.messages` interface.
- Changing the "ask" prompt wording (the messages shown to the *user* when asking for approval).
- Changing the `unavailableReason` messages (no "Hard stop" language there).
- Changing the skill-read denial message (it already omits "Hard stop").

## Background

Denial messages are produced in two categories across four source files:

### Centralized hint functions

| Function                                | File                                                | Callers                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatPermissionHardStopHint(result)`  | `src/permission-prompts.ts`                         | `formatDenyReason`, `formatUserDeniedReason`                                                                                                                         |
| `formatExternalDirectoryHardStopHint()` | `src/handlers/gates/external-directory-messages.ts` | `formatExternalDirectoryDenyReason`, `formatExternalDirectoryUserDeniedReason`, `formatBashExternalDirectoryDenyReason`, plus inline in `bash-external-directory.ts` |

### Inline "Hard stop" strings (not calling shared functions)

| Location                                   | Context                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `src/handlers/gates/path.ts` line 63       | `userDeniedReason` callback in `describePathGate`     |
| `src/handlers/gates/path.ts` line 105      | `formatPathDenyReason()` function body                |
| `src/handlers/gates/bash-path.ts` line 125 | `userDeniedReason` callback in `describeBashPathGate` |

All three inline strings use identical wording scoped to path denial.
They should call a shared function so the message text lives in one place.

### Test assertions referencing "Hard stop"

| Test file                                                  | Count |
| ---------------------------------------------------------- | ----- |
| `tests/permission-prompts.test.ts`                         | 3     |
| `tests/handlers/external-directory-integration.test.ts`    | 3     |
| `tests/bash-external-directory.test.ts`                    | 1     |
| `tests/handlers/gates/external-directory-messages.test.ts` | 4     |

Total: 11 assertions.

### Relevant AGENTS.md constraints

- Keep scope tight; prefer small, reversible changes.
- Preserve intentional behavior unless there is a clear reason to change it.
- The skill-read gate already omits "Hard stop" — this change aligns the other gates with that precedent.

## Design Overview

### Message strategy

The existing denial messages already contain the informative parts — subject, operation, matched pattern, and (for user denials) the user-supplied reason.
The "Hard stop" suffix adds no information; it only carries behavioral instructions that cause over-suppression.

The change **removes the "Hard stop" suffix** and, where the base message does not already indicate the denial source, appends a short clause noting it was policy-enforced.
No behavioral instructions ("do not retry", "report the block") are included.

### Concrete message changes

#### Policy-deny suffix (tool/bash/MCP gate)

Before: `"Hard stop: this permission denial is policy-enforced. Do not retry or investigate bypasses; report the block to the user."`

After: empty string (the base message from `formatDenyReason` already says "is not permitted" and includes the matched pattern).

The `formatPermissionHardStopHint` function is **removed** and its two call sites in `formatDenyReason` and `formatUserDeniedReason` drop the suffix concatenation.

#### Policy-deny suffix (external-directory gate)

Before: `"Hard stop: this external directory permission denial is policy-enforced. Do not retry this path, do not attempt a filesystem bypass, and report the block to the user."`

After: empty string (the base messages already say "is not permitted" with full context).

The `formatExternalDirectoryHardStopHint` function is **removed** and all call sites drop the suffix concatenation.

#### Path-gate inline strings

Before (inline in `path.ts` and `bash-path.ts`): `"Hard stop: this path permission denial is policy-enforced. Do not retry this path, do not attempt a filesystem bypass, and report the block to the user."`

After: the inline strings are removed entirely.
`formatPathDenyReason` already says "is not permitted to access path '…' via tool '…'" — no suffix needed.
The `userDeniedReason` callbacks already say "User denied access to path '…'" with the user-supplied reason — no suffix needed.

### Result shape

No interface or type changes.
`GateDescriptor.messages.denyReason` and `GateDescriptor.messages.userDeniedReason` remain `string` / `(decision) => string`.
The strings are simply shorter.

## Module-Level Changes

### `src/permission-prompts.ts`

- **Remove** `formatPermissionHardStopHint` export.
- **Update** `formatDenyReason` — drop the `. ${formatPermissionHardStopHint(result)}` suffix.
- **Update** `formatUserDeniedReason` — drop the `${formatPermissionHardStopHint(result)}` suffix.

### `src/handlers/gates/external-directory-messages.ts`

- **Remove** `formatExternalDirectoryHardStopHint` export.
- **Update** `formatExternalDirectoryDenyReason` — drop the `${formatExternalDirectoryHardStopHint()}` suffix.
- **Update** `formatExternalDirectoryUserDeniedReason` — drop the `${formatExternalDirectoryHardStopHint()}` suffix.
- **Update** `formatBashExternalDirectoryDenyReason` — drop the `${formatExternalDirectoryHardStopHint()}` suffix.

### `src/handlers/gates/bash-external-directory.ts`

- **Update** `userDeniedReason` callback — drop the `${formatExternalDirectoryHardStopHint()}` suffix.
- **Remove** the `formatExternalDirectoryHardStopHint` import (no longer needed).

### `src/handlers/gates/path.ts`

- **Update** `formatPathDenyReason` — remove the inline " Hard stop: …" suffix from the template literal.
- **Update** `userDeniedReason` callback in `describePathGate` — remove the inline " Hard stop: …" suffix.

### `src/handlers/gates/bash-path.ts`

- **Update** `userDeniedReason` callback in `describeBashPathGate` — remove the inline " Hard stop: …" suffix.

### Removed-symbol audit

`formatPermissionHardStopHint` and `formatExternalDirectoryHardStopHint` are the only exports being removed.

Import sites:

- `formatPermissionHardStopHint` — only used internally in `permission-prompts.ts` (not imported elsewhere in `src/`).
  Tests: imported in `tests/permission-prompts.test.ts`.
- `formatExternalDirectoryHardStopHint` — imported in `src/handlers/gates/bash-external-directory.ts` and `tests/handlers/external-directory-integration.test.ts` and `tests/handlers/gates/external-directory-messages.test.ts`.

All import sites are updated in the plan.

## Test Impact Analysis

### New tests enabled

No new test surfaces are created — the change is purely a message-text update.

### Tests that must change

1. `tests/permission-prompts.test.ts` — 3 assertions checking `toContain("Hard stop")` must be replaced with assertions on the updated text (e.g., `not.toContain("Hard stop")` or positive match on the informative portion).
   The test for `formatPermissionHardStopHint` must be **removed** (function no longer exists).
2. `tests/handlers/gates/external-directory-messages.test.ts` — 4 assertions checking `toContain("Hard stop")` must be updated.
   The test for `formatExternalDirectoryHardStopHint` must be **removed**.
3. `tests/handlers/external-directory-integration.test.ts` — 3 assertions checking `toContain("Hard stop")` must be updated.
   The import of `formatExternalDirectoryHardStopHint` must be removed.
4. `tests/bash-external-directory.test.ts` — 1 assertion checking `toContain("Hard stop")` must be updated.

### Tests that stay as-is

All other permission-prompt and gate tests that do not assert on "Hard stop" text remain unchanged.
Tests for `formatDenyReason`, `formatUserDeniedReason`, and the gate descriptor shapes still exercise the same code paths — they just produce shorter strings.

## TDD Order

1. **Red → Green:** Update `formatPermissionHardStopHint` tests and remove the function.
   Update `formatDenyReason` and `formatUserDeniedReason` tests to expect no "Hard stop" suffix.
   Implement the changes in `src/permission-prompts.ts`.
   Commit: `feat: remove "Hard stop" suffix from tool/bash/MCP denial messages (#78)`
2. **Red → Green:** Update `formatExternalDirectoryHardStopHint` tests and remove the function.
   Update `formatExternalDirectoryDenyReason`, `formatExternalDirectoryUserDeniedReason`, and `formatBashExternalDirectoryDenyReason` tests to expect no "Hard stop" suffix.
   Implement the changes in `src/handlers/gates/external-directory-messages.ts`.
   Commit: `feat: remove "Hard stop" suffix from external-directory denial messages (#78)`
3. **Red → Green:** Update `bash-external-directory.ts` inline `userDeniedReason` callback and its test assertion.
   Remove the `formatExternalDirectoryHardStopHint` import.
   Commit: `feat: remove "Hard stop" suffix from bash external-directory user-denied message (#78)`
4. **Red → Green:** Update `path.ts` `formatPathDenyReason` and `userDeniedReason` callback inline strings.
   Update `bash-path.ts` `userDeniedReason` callback inline string.
   Update `external-directory-integration.test.ts` assertions and imports.
   Update `bash-external-directory.test.ts` assertion.
   Commit: `feat: remove "Hard stop" suffix from path denial messages (#78)`

## Risks and Mitigations

| Risk                                                                               | Mitigation                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LLM now retries denied operations in a loop because the message is too permissive. | The base messages still clearly state "is not permitted" / "User denied", which is sufficient for modern LLMs to understand denial. The skill-read gate has shipped without "Hard stop" language with no observed retry loops. |
| Removing exported functions breaks downstream consumers.                           | Both functions are internal to the package — not re-exported from the package entry point. The only consumers are internal callers and test imports.                                                                           |
| Subtle wording differences across the 5 gate surfaces confuse the LLM.             | Each message already describes the specific denied operation (tool name, path, MCP target) — surface-specific context is preserved.                                                                                            |

## Open Questions

- If retry loops are observed after shipping, consider adding a lightweight scoped note like "This denial applies to this specific operation." as a suffix — but defer until evidence emerges.
