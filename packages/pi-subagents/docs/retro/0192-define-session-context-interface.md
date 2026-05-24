---
issue: 192
issue_title: "Define SessionContext narrow interface"
---

# Retro: #192 — Define SessionContext narrow interface

## Stage: Planning (2026-05-24T16:00:00Z)

### Session summary

Planned the pure-additive `SessionContext` interface for `src/types.ts`.
Traced all 5 consumed fields against the SDK's `ExtensionContext` type declarations to confirm shape alignment.
Single TDD step: add the interface and verify with `pnpm run check`.

### Observations

- The interface is trivial in scope — one new export with no consumers changing.
  This is intentionally the smallest possible first step to unblock Layer 1 (#193).
- `ModelRegistry` already exists as a local narrow interface in `src/session/model-resolver.ts`; `SessionContext` imports it rather than redeclaring.
- `sessionManager` uses an inline structural type (3 methods) rather than importing the SDK's `ReadonlySessionManager` (13 methods) — ISP applies here.
- No design ambiguity required `ask_user`; the issue's proposed change section was fully specified.
