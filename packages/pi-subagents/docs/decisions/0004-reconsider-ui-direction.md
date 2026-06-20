---
status: accepted
date: 2026-06-18
---

# 0004 — Reconsider the UI direction from first principles

## Status

Accepted.
Completes Phase 18 (reconsider the UI) and gateways Phase 19 (implement the recorded decisions).
Decision-only: this ADR changes no runtime code.
The inherited UI stays live until Phase 19 acts on these decisions.

## Context

Phase 18's spine (Steps 1–7, #420 through #426) disentangled the activity tier from the core.
The core now owns all run state in one place (`SubagentState`), the widget self-drives from lifecycle events, the LLM-facing `subagent` tool no longer depends on the widget, and the public event contract's declared channels equal its emitted channels.
The UI is therefore a pure reactive consumer of the broadcast-plus-query surface — _substitutable_.

This final step decides the UI's _direction and distribution_, not whether substitution is possible.
The goal is **substitutable, not optional**: a human needs some surface, but the specific UI is replaceable — the way Pi ships a default TUI built on the same public API any extension targets.
The disentangled core stays byte-for-byte identical whether or not a given UI consumer is installed (the composition invariant), so a replacement UI is a downstream concern even though _some_ UI is not.

Unlike the worktrees provider seam (generative, rationed — one provider the core consults), the UI is an observational consumer (unlimited, the core never waits on it).
That asymmetry is why packaging the UI is the secondary question and decoupling it was the real win.

Three operator-framed concerns shape the per-component judgment.

1. **Foreground progress is already shown by the tool call.**
   In foreground the `subagent` tool's inline `onUpdate` stream renders progress well; the above-editor widget duplicates it.
2. **Background agents have no tool-call display.**
   When agents run in the background there is no inline stream, so _something_ must indicate their state — and multiple subagents can run in parallel, so that surface must represent N concurrent agents at once.
3. **Operator visibility into a subagent's session is a distinct, richer need.**
   "Switch into a subagent's session, scroll/read it, switch between subagents, and exit back to root" is a navigation interaction, not a live overlay.
   The core already persists each child as a standalone Pi session JSONL at `Subagent.outputFile`, and `Subagent.messages` exposes the full history — so the data was never the limit; the bespoke, width-capped `ConversationViewer` overlay was.

### Relevant Pi SDK surface

Verified against `@earendil-works/pi-coding-agent@0.79.1`:

- `ExtensionActions.switchSession(sessionPath, { withSession })` switches the **active** session to a different session file.
  It is a full active-session takeover: it fires `session_before_switch` / `session_shutdown`, invalidates the current session context (`setBeforeSessionInvalidate` exists for host-owned UI teardown), and returns `{ cancelled }`.
  The switched-to session is fully interactive — `ReplacedSessionContext` exposes `sendUserMessage`.
- `session-manager` exports `loadEntriesFromFile(filePath)` / `parseSessionEntries(content)`, which read a session file's entries without switching — the read-only alternative to a full takeover.

## Decision

Judge each UI component on the first principles above, then record the distribution.

### A — Foreground widget: shrink to background agents only

The above-editor widget duplicates the foreground tool's inline `onUpdate` stream.
The widget survives **only** as the background-agent status surface (concern 2): foreground runs suppress it, the inline stream is authoritative there, and the background surface keeps the widget's existing per-agent tree so it represents N parallel agents at once.
The change is _when_ the widget shows (background-only), not _what_ it shows.

### B — Conversation viewer: replace the bespoke overlay with native session navigation

Remove the bespoke `ConversationViewer` overlay.
Operator visibility (concern 3) is served by Pi's own session machinery applied to the already-persisted child session file, not a hand-rolled transcript renderer — the recursive-Pi insight applied to `Subagent.outputFile`.

The illustrative call shape (Phase 19, not final):

```typescript
// "View running agents" → pick a child → switch into its persisted session
const child = manager.getRecord(id);
if (child?.outputFile) {
  await ctx.switchSession(child.outputFile);
  // operator reads/scrolls in Pi's native viewer; a later switch returns to root
}
```

This is Tell-Don't-Ask (hand Pi the session path; Pi owns the viewer) and keeps the core free of transcript-rendering code.

This decision records the _direction_ (native session machinery over a bespoke renderer), not the _mechanism_.
`switchSession` is a full active-session takeover and is interactive, so the operator UX is gated on a Phase 19 spike that chooses between (i) true `switchSession` round-trips and (ii) a read-only transcript built from `loadEntriesFromFile` that renders Pi-standard entries without leaving the root session.
See "Phase 19 entry criteria."

### C — `/agents` menu: dissolve the monolithic command into focused surfaces

The single `/agents` command bundles four unrelated jobs; split them, and do not keep all in one command.
Managing agent _definitions_ through the menu earns no keep — creating or editing agents is better done with other tools (directly in Pi, or a real text editor / IDE).

- **Create new agent (wizard)** → **remove.**
  An operator generates a new agent `.md` by asking a Pi agent directly (more capable than a fixed wizard) or by writing the file in an editor.
- **Agent types (list + config editor)** → **remove.**
  Viewing and editing agent definitions is better served by opening the `.md` files directly in an editor/IDE.
- **Running agents (visibility)** → **keep the responsibility, re-home it.**
  _Something_ must own running-agent visibility; it moves onto the background widget (Decision A) plus the native session navigation (Decision B), not a bespoke in-menu overlay.
- **Settings (concurrency / max turns / grace turns)** → **extract to a focused command** (e.g. `/subagents:settings`).
  Some value, but it does not belong bundled with agent management.

### D — Distribution: keep the surviving UI in-core (substitutable, not extracted)

The spine already made the UI substitutable; a replacement UI is a downstream concern that targets the public broadcast-plus-query surface.
The surviving UI — the background widget, a focused settings command, and the session-navigation glue — **stays in-core** as a reactive consumer.
Extraction to a separate `@gotgenes/pi-subagents-ui` package is **not** chosen now.

This answers the issue's headline question — the UI's _distribution_ — with "keep in core, substitutable," recorded explicitly rather than left implicit.
Extraction remains an available future option precisely because the composition invariant holds: the core is byte-for-byte identical with or without a given UI consumer.
It would be revisited if a second, materially different UI consumer appears, or if the in-core UI starts to pull SDK or rendering concerns back into core modules.

## Consequences

- The inherited UI is no longer preserved by default; each component now has a recorded fate (shrink / replace / dissolve) motivated by the first principles, not by inheritance.
- Phase 18 is complete.
  This ADR gateways Phase 19, which implements the decisions (background-only widget, native session navigation, `/agents` decomposition, `/subagents:settings` extraction) under its own plan and issues.
- No interim regression: this ADR removes nothing.
  The widget, the `ConversationViewer`, and the full `/agents` menu stay live until Phase 19 replaces them.
- Phase 19 must preserve the spine's invariants when it acts on these decisions: the runtime holds zero UI state (#422), the widget is a reactive consumer with no inbound calls from core spawn tools (#423), the LLM tool depends only on manager/runtime/settings/registry (#424), and declared event channels equal emitted channels with no vacant hook (#425).
  These are pinned today by the existing observer/widget/event-contract suites, which Phase 19 inherits.

## Phase 19 entry criteria

The following are open and must be resolved by a Phase 19 spike before committing to a mechanism; they are deliberately not decided here.

- **Root-continuity during a session switch.**
  `switchSession` invalidates the current session context — does the root's in-flight turn survive a switch-out-and-return, and what is the correct "return to root" gesture?
  Resolve before committing to true `switchSession` round-trips.
- **View-only vs interactive.**
  A switched-to child session is interactive (`sendUserMessage`).
  Decide whether steering a child from its own session is desirable, or whether the viewer should be strictly read-only (favoring the `loadEntriesFromFile` transcript path).
- **Parallel-agent navigation.**
  With N background agents running, decide the operator's gesture to pick which child to view and to cycle between them — driven from the background widget, a dedicated command, or both.
- **Settings command namespace.**
  Confirm the final command name/namespace for the extracted settings surface (`/subagents:settings` vs another form) against how sibling packages register namespaced commands.

The agent create/edit surfaces are **not** open questions: both are removed (Decision C).

## Addendum (2026-06-20): Phase 19 entry-criteria answers ([#446])

The Phase 19 Step 1 spike ([#446]) resolved all four entry criteria.
Evidence comes from the bundled `@earendil-works/pi-coding-agent` SDK surface (`packages/pi-subagents/node_modules/@earendil-works/pi-coding-agent/dist`) and a throwaway vitest harness run against a **real child session JSONL** (a 43-entry subagent session: 1 `session` header carrying a `parentSession` backref, 1 `model_change`, 1 `thinking_level_change`, 40 `message` entries).
The harness was discarded after observation; no production source changed.

### Finding 0 — `loadEntriesFromFile` is not part of the package's public surface

The original "Relevant Pi SDK surface" section cited `loadEntriesFromFile` as the read-only alternative to a switch.
The spike found it is **not reachable** from `@earendil-works/pi-coding-agent`, and that this is not a types/runtime mismatch — the type barrel and the runtime barrel agree, both omitting it.
`loadEntriesFromFile` is defined in the deep module `core/session-manager.ts` (annotated `/** Exported for testing */`), but the public barrel `src/index.ts` (→ `dist/index.d.ts` + `dist/index.js`) re-exports only a curated subset of that module — including `parseSessionEntries` but **not** `loadEntriesFromFile`.
The `package.json` `exports` map exposes only `"."` → the barrel, so the deep import `@earendil-works/pi-coding-agent/dist/core/session-manager.js` is not a supported entry point either.
`tsc` correctly rejects `import { loadEntriesFromFile } from "@earendil-works/pi-coding-agent"` with `TS2305: Module … has no exported member 'loadEntriesFromFile'`; the throwaway Vitest harness only reached a runtime `is not a function` because esbuild strips types without type-checking (the package's own `pnpm run check` would have caught it at compile time).
This is not version-specific: the barrel omits it identically in both the pinned `0.79.1` and the latest `0.79.8`, so an SDK upgrade does not surface it — Step 4 should not chase one.
The viable read-only path is therefore `parseSessionEntries(readFileSync(outputFile, "utf8"))` — `parseSessionEntries` _is_ public (both types and runtime) — which the harness confirmed returns the full `FileEntry[]` transcript with no session switch and no active-session mutation.
Step 4 ([#445]) should read the file itself and call `parseSessionEntries`, not `loadEntriesFromFile`.

Upstream references:

- Barrel that omits it: [`packages/coding-agent/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/index.ts).
- Test-annotated definition: [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts).

### Criterion 1 — Root-continuity during a session switch: avoid the switch

`switchSession` is a full active-session takeover: it fires `session_before_switch` (cancellable) and then tears the current runtime down via `session_shutdown` (whose `targetSessionFile` field marks a replacement-driven shutdown).
The root's in-flight turn does **not** survive the takeover — the runtime that owns that turn is invalidated — and a "return to root" would require a second `switchSession(rootSessionFile)` that re-incurs the teardown on the way back.
Because background agents run precisely while the operator keeps working at root, a true `switchSession` round-trip is hostile to a root with a turn in flight.

**Answer:** do not use `switchSession` for navigation.
The read-only transcript path (Criterion 2) sidesteps root-continuity entirely — it never touches the active session, so there is no return gesture to get wrong.

### Criterion 2 — View-only vs interactive: read-only

`ReplacedSessionContext` (handed to a `switchSession` `withSession` callback) extends `ExtensionCommandContext` and exposes `sendUserMessage`/`sendMessage`, so a switched-to child session is interactive.
But operator visibility (concern 3) is framed as "switch in, scroll/read, switch between, exit back to root" — a navigation interaction, not a live steering overlay — and steering already has a home (`steer_subagent` tool / the widget).
Adding in-session steering would create a second, redundant steering surface.

**Answer:** the viewer is strictly **read-only**, rendered from `parseSessionEntries(readFileSync(record.outputFile))` (Finding 0) without leaving the root session.
This also resolves Criterion 1 by construction.

### Criterion 3 — Parallel-agent navigation: command-first

With N background agents running, the operator needs a gesture to pick which child to view.
The background widget (Decision A, [#444]) already represents N parallel agents as a per-agent tree, making it the natural eventual selection surface; a flat command gives a non-widget entry point that lists running background agents and lets the operator pick one keyed on `record.outputFile`.

**Answer:** Step 4 ([#445]) ships a **command** as the primary, unit-testable selection surface (list background agents → pick → render that child's transcript read-only), with a widget gesture as an optional later enhancement.
"Both" remains the eventual target; command-first is the Step 4 starting point because it does not depend on the widget shrink ([#444]) landing first.

### Criterion 4 — Settings command name: `/subagents-settings`

Sibling packages register flat, hyphenated command names with no `:` namespace: `registerCommand("agents", …)` (this package), `"colgrep-reindex"`, `"permission-system"`.
A `/subagents:settings` form would be inconsistent with every existing command in the repo, and `/agents-settings` wrongly implies it manages agent definitions (which Decision C removes).

**Answer:** confirm **`/subagents-settings`** (flat, hyphenated) for Step 2 ([#447]).
Reject the tentative `/subagents:settings` and the `/agents-settings` alternative.

### Net mechanism for Phase 19

- Session navigation (Step 4, [#445]): a read-only transcript rendered from `parseSessionEntries(readFileSync(record.outputFile, "utf8"))`, surfaced through a flat command; no `switchSession`, no `loadEntriesFromFile`.
- Settings command (Step 2, [#447]): `/subagents-settings`.

This keeps transcript rendering out of the core, adds no inbound call from the UI to the core, and preserves the Phase 18 spine invariants (#422–#425).

[#444]: https://github.com/gotgenes/pi-packages/issues/444
[#445]: https://github.com/gotgenes/pi-packages/issues/445
[#446]: https://github.com/gotgenes/pi-packages/issues/446
[#447]: https://github.com/gotgenes/pi-packages/issues/447
