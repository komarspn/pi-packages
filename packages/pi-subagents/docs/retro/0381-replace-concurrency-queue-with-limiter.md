---
issue: 381
issue_title: "Replace ConcurrencyQueue with a thunk-based ConcurrencyLimiter"
---

# Retro: #381 — Replace ConcurrencyQueue with a thunk-based ConcurrencyLimiter

## Stage: Planning (2026-06-13T00:00:00Z)

### Session summary

Produced a 3-step TDD plan to replace the ID-registry `ConcurrencyQueue` (with its `startAgent` back-edge and `markStarted`/`markFinished` relays) with a pure `ConcurrencyLimiter` that schedules thunks FIFO against a dynamic limit.
The design follows the architecture doc's Phase 17 Step 1 entry and the issue's revised framing closely; the plan adds concrete code sketches for `schedule`/`recheck`/`clear`, the manager call site, the simplified `waitForAll`, and `index.ts` wiring.

### Observations

- Author is `gotgenes` (matches the gh CLI user), so the well-specified proposal was treated as the working hypothesis; the design is unambiguous (down to the architecture-doc Step 1), so the `ask_user` gate was skipped.
- Classified non-breaking: `ConcurrencyQueue`/`ConcurrencyLimiter` are internal — no public API, config, or observable behavior change.
  The FIFO admission gate against `maxConcurrent` is preserved.
- Key design decision beyond the issue sketch: `clear()` must *settle* dropped pending promises (resolve them), not just drop the thunks.
  Every `schedule()` promise becomes `record.promise`, and the post-spawn contract is that it always settles — dropping without resolving would strand a promise.
  This costs a small `settle` handle per pending entry (a few lines beyond the issue's "~40 lines").
- Verified no production caller awaits a *queued* agent's promise in a blocking way (`get-result-tool.ts` guards on `status === "running"`; `spawnAndWait` is foreground/direct; `waitForAll` filters by status), confirming it is safe to give queued agents a real promise.
- Sequencing decision: the `SubagentManagerOptions.queue` → `limiter` swap breaks both call sites (`index.ts` + the manager test helper) and the old test file imports the deleted source, so step 2 is one atomic commit (migrate consumers + delete queue + delete old test).
- `bypassQueue` is kept as-is — it is in the published `SubagentsService` type bundle, so renaming would be breaking; deferred to Open Questions.
- Doc inventory: grep confirmed current-state references to update are the Mermaid lifecycle node, the layout listing, the "What the core owns" bullet, the Step 7 ([#378]) target filename, and the `package-pi-subagents` SKILL lifecycle-domain table.
  `SKILL.md` line 80 (Phase 15 history) keeps `ConcurrencyQueue` as a historical record.

[#378]: https://github.com/gotgenes/pi-packages/issues/378
