---
issue: 463
issue_title: "pi-subagents: add file-snapshot source to /subagent-sessions for evicted agents"
---

# Retro: #463 — pi-subagents: add file-snapshot source to /subagent-sessions for evicted agents

## Stage: Planning (2026-06-23T00:00:00Z)

### Session summary

Produced a 4-step plan for the Phase 19 Step 4b file-snapshot source: implement `fileSnapshotSource(outputFile, readFile)` in the pure `session-navigation.ts`, broaden the `/subagent-sessions` candidate set to evicted agents, and dual-source the handler by `NavigationEntry.kind`.
The central design fork — how evicted agents enter the picker — was resolved with the operator via `ask_user`.

### Observations

- **Eviction is memory management.**
  The cleanup sweep's `disposeSession()` frees the in-memory message history; the transcript survives only on disk.
  So rendering an evicted agent *always* reads the file (`fileSnapshotSource`) regardless of candidate-set strategy — the strategy only affects the picker *label*.
- **Persisted child sessions carry no `type`/`description`.**
  The JSONL has only the conversation plus a header (`id`, `timestamp`, `cwd`, `parentSession`).
  A directory scan (the issue's literal wording) would therefore produce degraded labels and parse every file per open.
- **Decision: manager-retained descriptors over directory scan.**
  The manager stashes a tiny no-messages `EvictedSubagent` descriptor in `cleanup()` before `removeRecord`, cleared in `clearCompleted()`/`dispose()`.
  Rich labels identical to live entries, bounded memory, no per-open parse.
  Coverage is limited to in-session evictions — which are the sweep's only targets, since a fresh manager per session never reloads prior-process subagents.
  Operator confirmed; an `(evicted)` snapshot marker was also chosen for the label.
- **`NavigationEntry` becomes a discriminated union** (`live` | `evicted`); this breaks the handler, the `index.ts` call site, and both UI test files, so step 3 folds all of them into one commit.
- **SDK-runtime call kept direct.** `fileSnapshotSource` calls `parseSessionEntries` / `buildSessionContext` directly rather than injecting them — the injected `readFile` already provides the unit-test seam, and there is no `no-restricted-imports` rule.
- **Transient dead-code risk noted:** `fileSnapshotSource` and `listEvicted()` have no caller until step 3; flagged not to ship before step 3 lands (CI/`fallow` gate the pushed tip).
- Release: independent (Phase 19 Step 4b roadmap tag).
