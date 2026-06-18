---
issue: 423
issue_title: "pi-subagents: make the agent widget self-drive from lifecycle events"
---

# Retro: #423 — Make the agent widget self-drive from lifecycle events

## Stage: Planning (2026-06-17T00:00:00Z)

### Session summary

Planned Phase 18 Step 4 of the widget/tool decoupling track: making `AgentWidget` a `SubagentManagerObserver` that self-drives its 80 ms timer from lifecycle notifications, wired via a new `CompositeSubagentObserver` fan-out, and removing all inbound widget calls from the spawn tools.
Wrote a four-step plan (three `refactor:` commits + a `docs:` sweep) at `packages/pi-subagents/docs/plans/0423-widget-self-drive-from-lifecycle.md`.

### Observations

- **Wiring mechanism was the live design decision.**
  `SubagentManager` has a single `observer` slot.
  Three options surfaced: (A) a `CompositeSubagentObserver` fan-out in `index.ts`, (B) make the manager hold an observer list, (C) subscribe the widget to the public `pi.events` channels.
  The operator initially leaned toward B (matching the issue's literal file list) but was unsure; after reframing around the decouple + overridable-UI north star, they chose **A**.
  Rationale recorded in the plan: A keeps the core closed for modification, B moves fan-out *into* the core (wrong direction), and C front-runs the Step 6 ([#425]) public-event-contract reconciliation.
  Key insight that flattened the decision: all three options keep the widget's `manager.listAgents()` reference, so they only change the *trigger*, not the data source — full broadcast-plus-query decoupling is the Step 8 ([#427]) concern.
- **`markFinished` is fully redundant** and is deleted, not relocated: `seedFinishedAgents()` (added in [#421] / [#422]) already seeds any agent with `completedAt` on each poll tick.
  This matters because the manager **never fires `onSubagentCompleted` for foreground agents** (`onRunFinished` guards on `isBackground`), so the widget could not learn of foreground completion via the observer anyway — polling covers it.
- **Construction cycle** (widget needs manager → manager needs observer → observer includes widget) is broken by constructing the composite with `[eventsObserver]`, passing it to the manager, then `observer.add(widget)` after the widget is built; the manager consults the observer only lazily at spawn time.
- **TDD ordering avoids a behavior gap:** Step 2 wires the widget as an observer *while the spawn tools still drive it* (idempotent double-drive), strictly before Step 3 removes the spawn-tool calls — so no commit leaves the widget without a timer-start signal.
  The new widget observer methods need no `fallow-ignore` because they are invoked polymorphically through `SubagentManagerObserver` (the `SubagentEventsObserver` precedent).
- This step narrows `AgentToolWidget` to `setUICtx` only but keeps the `AgentTool` widget constructor param; full removal is Step 5 ([#424]).
- Non-breaking and internal-only (no public service/settings surface touched), so `refactor:`/`docs:` commits, no `BREAKING CHANGE` footer.

[#421]: https://github.com/gotgenes/pi-packages/issues/421
[#422]: https://github.com/gotgenes/pi-packages/issues/422
[#424]: https://github.com/gotgenes/pi-packages/issues/424
[#425]: https://github.com/gotgenes/pi-packages/issues/425
[#427]: https://github.com/gotgenes/pi-packages/issues/427
