---
issue: 470
issue_title: "pi-subagents: README still documents the removed /agents command and omits /subagents:settings and /subagents:sessions"
---

# Retro: #470 — pi-subagents README still documents the removed /agents command

## Stage: Planning (2026-06-23T00:00:00Z)

### Session summary

Planned a docs-only refresh of `packages/pi-subagents/README.md` to replace the removed `/agents` interactive-menu surface with the live `/subagents:settings` and `/subagents:sessions` commands, drop the deleted Conversation viewer feature bullet, and remove the eject customization story (ADR-0004 Decision C).
Verified the current command surface against `src/index.ts` `registerCommand` calls and enumerated every stale reference by grep (lines 21, 119, 228–252, 277–303, 318).
Classified as **ship independently** — not a member of any roadmap step or release batch; the `dissolve-agents` batch already shipped as `pi-subagents-v18.0.0`.

### Observations

- Author is the operator (`gotgenes`), and the issue spells out the stale lines and expected behavior precisely, so the `ask_user` gate was skipped — no design ambiguity.
- This is a `/build-plan` (docs-only) change: one reviewable commit, no red→green cycles, verified by `pnpm run lint` (rumdl) plus a re-grep for stale terms.
- Root cause (from the issue itself): the Phase 19 doc-staleness check keyed on module names (`agent-menu.ts`), not the command names a README documents (`/agents`) — the plan-issue README grep checklist now catches this class.
- Scope deliberately excludes `src/`, tests, `architecture.md`, and the ADRs — all already accurate post-Phase-19.
  Only the README lagged.
- `.pi/skills/package-pi-subagents/SKILL.md` needs no update: it is an implementation-architecture reference that does not document slash commands, and its sole `/agents` mention is past-tense Phase 18 historical context (not a live-command reference).

## Stage: Implementation — Build (2026-06-23T00:00:00Z)

### Session summary

Executed the single-step docs plan in one commit: refreshed `packages/pi-subagents/README.md` to the post-Phase-19 command surface.
Replaced the removed `/agents` interactive-menu surface with `/subagents:settings` and `/subagents:sessions`, dropped the Conversation viewer feature bullet (now a Session transcripts bullet), removed the eject customization story (override + `enabled: false` only), and corrected the `subagents:settings_changed` events-table description.
No `src/`/`test/`/`.ts` files touched; `pnpm run lint` and `pnpm run check` stayed green throughout.

### Observations

- Command table descriptions were copied verbatim from the `registerCommand` calls in `src/index.ts` so the README matches `/help` output.
- The post-edit grep for `/agents` still matches lines 22/119/131/132/137 — all legitimate `.pi/agents/<name>.md` file-path references, not the removed command; `eject`/`wizard`/`conversation viewer` return zero matches.
- Pre-completion reviewer: WARN (non-blocking).
- Reviewer warnings: one finding — the planning-stage retro observation incorrectly claimed `SKILL.md` "already references the new commands."
  The conclusion (no skill update needed) was correct, but the justification was wrong.
  Corrected the planning observation in this same retro commit; `SKILL.md` is an architecture reference that does not document slash commands, so it genuinely needs no update.
