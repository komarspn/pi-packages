---
description: Run fallow analysis, trace from index.ts outward, and propose the next improvement phase
---

# Plan the next improvement round

Package: `$1`

Your job is to analyze the package, identify structural improvements, and propose a numbered phase plan.
Do **not** start implementation — only produce the analysis and plan.

## Sync with remote (do this first)

1. Run `git pull --ff-only`.
2. If it fails for **any** reason, stop and report the failure.

## Load skills

Load these skills before starting analysis:

- `improvement-discovery` — heuristics, smell taxonomy, prioritization framework.
- `fallow` — how to run and interpret fallow output.
- `package-<PKG>` — package-specific context (replace `<PKG>` with `$1`).
- `code-design` — design principles and structural heuristics.
- `markdown-conventions` — for the output document.

## Analysis (follow the improvement-discovery workflow)

### Step 1: Run fallow

Run the full fallow suite for the package:

```bash
cd packages/$1
pnpm fallow:health 2>&1 || true
pnpm fallow:dead-code 2>&1 || true
pnpm fallow:dupes 2>&1 || true
pnpm fallow health --hotspots --targets --score 2>&1 || true
```

Record: health score, dead code findings, production/test duplication, hotspots, refactoring targets.

### Step 2: Read the architecture document

Read `packages/$1/docs/architecture/architecture.md`.
Note:

- Current health metrics table
- Dependency bag inventory — which are marked done vs. open
- Complexity hotspots
- Churn hotspots

### Step 3: Trace from entry point outward

Read `packages/$1/src/index.ts` and trace its dependency graph:

- For each import, read the target module
- Note size, exports, fan-out, code smells
- Pay special attention to: `as any` casts, adapter closure density, forward references, wide parameter lists, mixed responsibilities, anemic domain objects (data classes that a manager reaches into instead of telling)

### Step 4: Apply the smell taxonomy

For each finding, classify it using the taxonomy from the `improvement-discovery` skill (Category A–E).
Score each on Impact (1–5) and Risk (1–5).
Compute Priority = Impact × (6 − Risk).

### Step 5: Propose the phase plan

Group findings into issue-sized steps (max 9 per phase).
Identify dependency ordering and parallel tracks.

## Output

Write the proposed plan as a new section in `packages/$1/docs/architecture/architecture.md`, replacing the existing "Improvement roadmap" section header with the next phase number.

The section should include:

1. A summary of findings (updated health metrics table).
2. Numbered steps with:
   - Title
   - Target files/functions
   - Smell category addressed
   - Expected measurable outcome
3. Step dependency diagram (Mermaid flowchart).
4. Named parallel tracks.

After writing the plan, present a summary to the user and ask whether to commit.
If confirmed, commit with:

```bash
git add packages/$1/docs/architecture/architecture.md
git commit -m "docs(pi-subagents): propose Phase N improvement roadmap"
```

Then call `set_session_name` with `$1 — Phase N Planning` and stop.
