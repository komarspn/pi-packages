---
issue: 217
issue_title: "Extract overwrite guard from UI (Phase 13, Step 4)"
---

# Retro: #217 — Extract overwrite guard from UI

## Stage: Planning (2026-05-26T20:00:00Z)

### Session summary

Produced a 5-step TDD plan to extract the duplicated overwrite-guard + write + reload + notify pattern from `AgentConfigEditor.ejectAgent` and `AgentCreationWizard.showManualWizard` into a shared `writeAgentFile` function in a new `src/ui/agent-file-writer.ts` module.
Confirmed dependency #214 (closure-to-class conversion) is already closed.

### Observations

- The `showGenerateWizard` overwrite guard was explicitly scoped out — it has different lifecycle semantics (spawned agent writes the file, post-write check is conditional).
  This avoids a leaky abstraction with a discriminator parameter.
- Narrow ISP interfaces (`FileWriter`, `WriterUI`, `Reloadable`) keep the extracted function decoupled from the full `AgentFileOps` and `MenuUI` interfaces — 2/6 and 2/6 methods respectively.
- Both consumer call sites hold `this.fileOps` and `this.registry` as private fields and receive `ui` as a method parameter, so no constructor or wiring changes are needed.
- Existing tests in both consumer test files use `expect.stringContaining("already exists")` for overwrite prompts, which is stable across the extraction.
