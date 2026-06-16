---
issue: 413
issue_title: "Explicitly allow some external directories relative to the home directory"
---

# Retro: #413 — Explicitly allow some external directories relative to the home directory

## Stage: Planning (2026-06-16T15:06:55Z)

### Session summary

Investigated a third-party request (filed by `michaelmior`) to allow outside-CWD directories like `~/.cargo/registry` without prompting.
Found the capability already exists via the `external_directory` surface pattern map; the user's `path`-surface attempt failed because of most-restrictive-wins composition and a missing trailing `*`.
After confirming direction with the operator, wrote a docs-only plan to make the `external_directory` allow-list discoverable across `configuration.md`, `README.md`, `config.example.json`, and the schema.

### Observations

- This is fundamentally a discoverability bug, not a missing feature.
  `"external_directory": { "*": "ask", "~/.cargo/registry/*": "allow" }` already does what the user wants.
- Rejected the tempting "make a `path` allow suppress the `external_directory` gate" approach.
  The four layers compose with most-restrictive-wins, so a `path` allow loosening an `external_directory: ask` boundary would be a security regression, not a fix.
  The operator's instinct (keep `external_directory` as a separate, intentional layer modeled on OpenCode) confirmed this.
- Operator correction on wildcard semantics: do **not** use `**` in examples.
  A single `*` compiles to a greedy `.*` (with the `s` flag in `wildcard-matcher.ts`) and already crosses subdirectory boundaries, so `~/.cargo/registry/*` matches every file beneath the directory.
- Scope trimmed by operator: `configuration.md` + `README.md` + `config.example.json`/schema; `troubleshooting.md` deselected.
- Next stage is `/build-plan` (docs-only), not `/tdd-plan`.
- Alignment constraint applies: `configuration.md`, `README.md`, `config.example.json`, and `schemas/permissions.schema.json` must agree on the `external_directory` pattern-map form.
