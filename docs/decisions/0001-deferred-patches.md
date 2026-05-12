---
status: accepted
date: 2026-05-11
---

# 0001 — Deferred fork patches and upstream-PR strategy

## Status

Accepted

## Context

This fork was created to land three pieces of work identified during RepOne issue [#442](https://github.com/Tiny-IG-Software/repone/issues/442):

1. **Peer-dep rename** — `@mariozechner/pi-*` → `@earendil-works/pi-*`.
2. **Patch 2 — Re-activate extension tools post-`bindExtensions`** (Spike 3 finding).
3. **Patch 3 — Inject `<active_agent>` tag** (Spike 4 finding).

A fourth piece of work was scoped during the same spike round but deferred:

- **Patch 1 — Mirror parent's `additionalExtensionPaths` (and siblings) into the child's `DefaultResourceLoader`** (Spike 2 finding).

This ADR records why Patch 1 was deferred and the strategy for upstream PRs back to [`tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents).

## Decision

### Patch 1 is deferred

The original Spike 2 finding was that the parent's `additionalExtensionPaths` does not propagate to the child's `DefaultResourceLoader`. The fix was sketched as "plumb parent's `additionalExtensionPaths` (and siblings) into the child."

During planning for this fork, two implementation constraints surfaced:

1. The parent's `DefaultResourceLoader.additionalExtensionPaths` is **private** — no public getter on `ExtensionContext`.
2. The parent's CLI flags (e.g., `pi -e <path>`) are parsed in `main.js` and not surfaced through any extension API.

A working patch would have to either:

- Accept new fields in `RunOptions` so callers supply the paths explicitly, **or**
- Reach into `process.argv` to re-resolve `-e`/`--extensions` flags from the child's perspective.

Neither matches the production need. For RepOne (and any consumer that installs extensions via `pi install`), extensions are settings-discoverable: children inherit them independently of the parent's `DefaultResourceLoader` configuration. The `pi -e <path>` ephemeral-extension case is the only beneficiary of Patch 1, and it does not appear in our workflow.

We therefore defer Patch 1 rather than carry a speculative patch in the fork's diff against upstream. A follow-up issue on the RepOne board (linked from #443) captures the criterion for revisiting: **a workflow that needs `pi -e <path>` ephemeral extensions to reach children**.

### Upstream PRs are deferred

Patches 2 and 3 are both clearly upstream-mergeable bug fixes — they finish a mirror the upstream fork already started (carrying the parent's session configuration through to the child). The natural place for them is in `tintinweb/pi-subagents` itself.

We defer opening the PRs until **Patches 2 and 3 have been validated end-to-end in production** through at least one milestone of RepOne usage. The reasoning:

1. Production validation is stronger evidence for the upstream maintainer than the spike findings alone.
2. The patch shapes (especially Patch 2's helper-extraction refactor and Patch 3's exact prepend point) may need adjustment based on real-world behavior; opening PRs prematurely risks needing to amend them under review.
3. Carrying the fork is low-cost while we iterate; the publishing infrastructure mirrors the other Pi siblings.

A follow-up issue on the RepOne board (linked from #443) tracks the upstream-PR work and the criterion for proceeding.

## Consequences

### Positive

- The fork's diff against upstream stays minimal — three patches plus tooling alignment.
- We avoid landing a speculative Patch 1 that would need rework if upstream's `ExtensionContext` API changes.
- We get production evidence before asking the upstream maintainer to review.

### Negative

- The `pi -e <path>` ephemeral-extension case in subagents will not work until Patch 1 lands. We accept this because no consumer in scope uses that pattern.
- Patches 2 and 3 stay carried in `@gotgenes/pi-subagents` rather than upstream. Consumers must use this fork (not the upstream package) to get the patches.

### Operational

- A follow-up issue on the RepOne board (linked from this fork's `README.md` "Deviations from upstream" section and from RepOne issue #443) records both deferrals.
- When upstream PRs are eventually opened, they should be opened separately for Patches 2 and 3 to keep review simple.
- When Patch 1 is eventually added, it should be a separate ADR in `docs/decisions/` with its own follow-up.
