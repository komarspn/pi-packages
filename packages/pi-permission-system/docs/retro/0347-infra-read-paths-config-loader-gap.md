---
issue: 347
issue_title: "piInfrastructureReadPaths in config.json is silently ignored by config-loader merge pipeline"
---

# Retro: #347 — piInfrastructureReadPaths config-loader gap

## Stage: Planning (2026-06-08T21:30:00Z)

### Session summary

Diagnosed `piInfrastructureReadPaths` being silently dropped: it is parsed by `normalizePermissionSystemConfig()` but that runs on the output of `loadAndMergeConfigs()`, whose intermediate `UnifiedPermissionConfig` never declares, parses, or merges the field — structurally identical to the [#332] loader gap.
Produced `docs/plans/0347-infra-read-paths-config-loader-gap.md` with five red→green TDD cycles that add a shared `normalizeOptionalStringArray` helper, carry the field through the unified loader with override-wins merge, and add `refresh`/`save` preservation tests.

### Observations

- Root cause is a missing field in `UnifiedPermissionConfig`, not a matching bug — confirmed `isPiInfrastructureRead()` / `path-utils.ts` matching is correct and out of scope ([#122], [#350] already cover it).
- Verified against the [#332] fix shape: `ConfigStore.save()` spreads `...existing.config`, so once the loader carries the field the save path preserves it automatically — no explicit save-side copy expected (step 5 adds a test that folds in a `save()` fix only if it proves red).
- Decision (`ask_user`): replace (override-wins) merge across layers, not concatenate — every other `UnifiedPermissionConfig` field replaces or deep-shallow-merges, so a concatenating array would be the lone divergent rule; the reported bug is a single-layer drop, so replace is the minimal consistent fix.
- Chose to extract `normalizeOptionalStringArray` into `common.ts` (alongside `normalizeOptionalPositiveInt`) rather than duplicate the inline guard — both `normalizeUnifiedConfig` and the existing `normalizePermissionSystemConfig` validate the same "optional string array" concern, so the helper dedupes rather than adds a third copy.
- Pre-monorepo plans in `docs/plans/archive/` use upstream issue numbers; ignored them for `NNNN` selection.
  Picked `0347` to match the issue.
- No `docs/architecture/`, schema, `config.example.json`, or `docs/configuration.md` changes needed — the field is already declared and documented everywhere except the loader.

[#122]: https://github.com/gotgenes/pi-packages/issues/122
[#332]: https://github.com/gotgenes/pi-packages/issues/332
[#350]: https://github.com/gotgenes/pi-packages/issues/350

## Stage: Implementation — TDD (2026-06-08T22:00:00Z)

### Session summary

Executed all five TDD cycles from the plan in a single session across four commits.
Added `normalizeOptionalStringArray` to `src/common.ts`, refactored `normalizePermissionSystemConfig()` in `src/extension-config.ts` to use it (no behavior change), added `piInfrastructureReadPaths` to `UnifiedPermissionConfig` with parse and override-wins merge in `src/config-loader.ts`, and added `refresh()` + `save()` integration tests to `test/config-store.test.ts`.
Test count grew from 1873 to 1894 (+21).

### Observations

- Step 5 (`save()` preservation) was green immediately against the step-4 production fix — the `...existing.config` spread in `ConfigStore.save()` carries the field automatically once the loader declares and parses it, exactly as predicted from the [#332] precedent.
  No additional `save()` production change was needed.
- The `it.each` for malformed `piInfrastructureReadPaths` values in `test/config-loader.test.ts` used a `const` assertion on the tuple array (`as const`); the `"mixed-type array"` entry `["a", 1]` required the outer array to be typed carefully since `as const` would make `1` a literal `1` not assignable to the union — worked fine with the existing pattern already established for other `it.each` tables in the file.
- Pre-completion reviewer: **PASS** — all deterministic checks clean, no warnings.
