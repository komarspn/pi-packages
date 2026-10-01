---
issue: 902
issue_title: "Improvement roadmap: standardize the dependency diagram's dashed-edge vocabulary"
---

# Settle the roadmap diagram's edge vocabulary and check soft dependencies

## Release Recommendation

**Release:** ship independently

This is repo-root tooling (`scripts/roadmap/`, root `test/roadmap/`, `.pi/`), plus one edit to pi-permission-system's `docs/architecture/architecture.md`, which is outside every package's release scope.
No package gains a releasable commit, so nothing will actually release; the issue belongs to no improvement roadmap, so there is no batch to join.

## Problem Statement

[#894]'s validator holds each `**Hard dependency:**` bullet to the diagram's solid edges, but it cannot do the same for `**Soft dependency:**` bullets.
The roadmaps spell a non-hard edge several ways: bare `-.->`, `-.soft.->`, `-.informs.->`, and (in an archived pi-permission-system phase) a pipe-labelled `-.->|"soft ordering — …"|`.
The `improvement-discovery` skill defines none of them, so every spelling conforms, and the validator treats every `-.…->` as soft while silently dropping the pipe-labelled form.
A soft bullet can therefore drift from the diagram with nothing noticing.

## Goals

- Settle the vocabulary in the `improvement-discovery` skill: exactly two edge kinds, solid `-->` (hard) and labelled dashed `-.soft.->` (soft).
  A relation that asserts no order ("A informs B") is not drawn; it goes in prose.
- Make the parser classify each edge as `hard`, `soft`, or `unrecognized`, and keep an unrecognized edge with its spelling rather than dropping it.
- Report an unrecognized edge as an **error** (its input parses strictly, per the validator's severity rule).
- Hold each `**Soft dependency:**` bullet to the diagram's `-.soft.->` edges in **both directions**, at **warning** severity, with the same three messages the hard check uses.
- Respell the one live roadmap's (pi-permission-system Phase 15) 11 dashed edges as `-.soft.->`, and add `**Soft dependency:**` bullets to the five **open** steps an unbacked soft edge points into.

This change is not breaking: it ships no package code.
The validator gets stricter (a bare dashed edge becomes an error), but it is repo-internal tooling with no published contract.

## Non-Goals

- **An `informs` edge kind or an `**Informed by:**` field.**
  Operator decision: a relation with no ordering consequence is not a dependency, and the diagram lays out by dependency.
- **Soft bullets on the five landed (`✅`) steps** ([#863], [#609] ×2, [#957], [#977]).
  The skill leaves a landed step's field block as originally written, so their five warnings stand until Phase 15 archives, where `/finish-phase` runs the check as advisory.
- **Rewriting archived `history/phase-*.md` diagrams.**
  They are records, and the checker reads only the live `## Improvement roadmap` section.
- **The four findings already on Phase 15** ([#945]'s `Priority`, missing score lines on [#977] and [#978], and [#963] absent from `Release batches`).
  They predate this change and belong to the phase's own maintenance; this plan's verification counts around them.
- **Chained links (`A --> B --> C`) and `&` fan-out.**
  Neither regex, old or new, reads them, and no roadmap in the repo uses them (measured below).
- **Soft edges in the acyclicity check.**
  A soft back-edge is a legitimate preference, as [#894] settled.
- **A CI gate.**
  Unchanged from [#894].

## Background

### The live corpus

Only one live roadmap remains. pi-subagents Phase 22 (the source of `-.soft.->` and `-.informs.->`) has been archived to `packages/pi-subagents/docs/architecture/history/phase-22-front-door-delivery.md`.

Measured on pi-permission-system Phase 15 with a spike over `parseRoadmap`:

| Datum                          | Value                                          |
| ------------------------------ | ---------------------------------------------- |
| Steps                          | 13                                             |
| Edges                          | 12: one `-->` ([#880] → [#881]), eleven `-.->` |
| `**Soft dependency:**` bullets | 1: [#882] on [#881], matched by a dashed edge  |
| Dashed edges with no bullet    | 10                                             |
| … into landed steps            | 5: 945→863, 863→609, 859→957, 957→609, 609→977 |
| … into open steps              | 5: 924→963, 963→880, 609→881, 977→979, 979→978 |

Current `./scripts/roadmap-check.mjs` output on it: 3 errors, 1 warning (listed under Non-Goals), exit 1.

### What each spelling meant

Across the archive, `soft` meant "land A first if you can" (Phase 22's `**Soft dependency:** after Step 7 …`).
`informs` meant "A's outcome shapes B's design, neither blocks the other" (Phase 22 Track H prose).
Phase 15's bare form is described below its diagram as "sequencing preferences, not dependencies", which is the `soft` meaning.

### The parser today

`EDGE = /\b(S\w+)(?:\["[^"]*"\])?\s*(-->|-\.[^>]*?->)\s*(S\w+)/g`, and `parseDiagram` maps `-->` to `hard` and everything else to `soft`.
A pipe label between the arrow and the target breaks the `\s*(S\w+)` match, so `-.->|label|` and `-->|label|` edges vanish.
`==>`, `--->`, and `-..->` vanish the same way.

`RoadmapStep.hardDependency` is parsed by `HARD_DEPENDENCY` and `parseStepReferenceRun`; `parseSteps` then resolves ordinal references to issues with a remap written for that one field.
`checkDependencyClaim` hard-codes the relation: the `hard` edge filter, the `hardDependency` field, and three messages.

### Constraints from `AGENTS.md` and the skills

- A parser's testable surface is its input domain: the candidate regex was run over every roadmap diagram in the repo (below), not only the fixtures.
- A mechanism half and a data half get separate steps: the parser changes (steps 3–4) precede the checks that consume them (steps 5–6), and the live-document edit (step 7) and the vocabulary prose (step 8) come after.
- Landed step blocks are left as written (`improvement-discovery`, Output format).

## Design Overview

### The vocabulary

| Kind | Spelling        | Asserts                                              | Backed by                         |
| ---- | --------------- | ---------------------------------------------------- | --------------------------------- |
| hard | `A --> B`       | B cannot land before A                               | B's `**Hard dependency:**` bullet |
| soft | `A -.soft.-> B` | land A first if you can; B does not break without it | B's `**Soft dependency:**` bullet |

The label renders on the edge (measured with `mmdc`: `-.soft.->` produces an `edgeLabel` reading `soft`), so the diagram no longer needs a legend sentence to say what a dashed edge means.
The soft label is compared after trimming, so Mermaid's spaced form `-. soft .->` also reads as soft.
Everything else is `unrecognized`: bare `-.->`, `-.informs.->`, any pipe-labelled link (`-.->|soft|`, `-->|x|`), `==>`, `--->`, `-..->`.

### The model

```javascript
/**
 * @typedef {{ from: number, to: number, kind: "hard" | "soft" }
 *   | { from: number, to: number, kind: "unrecognized", spelling: string }} RoadmapEdge
 *
 * RoadmapStep gains:
 * @property {{ present: true, dependsOn: number[] }|null} softDependency null when the bullet is absent
 */
```

The union keeps every existing `toEqual` on a hard or soft edge valid; only an unrecognized edge carries `spelling` (the operator, plus `|label|` when present), which the error message quotes.

### The edge pattern

```javascript
const EDGE =
  /\b(S\w+)(?:\["[^"]*"\])?\s*(-{2,}>|={2,}>|-\.+(?:[^>|\n]*?\.)?->)(?:\|([^|\n]*)\|)?\s*(S\w+)/g;
// hard: operator "-->" and no pipe label
// soft: operator matches /^-\.\s*soft\s*\.->$/ and no pipe label
// otherwise: unrecognized, spelling = operator + (pipe label ? `|${label}|` : "")
```

Run over every Mermaid block with `S…[` nodes in every `architecture.md` and `history/*.md` in the repo, the candidate captured every edge the old pattern did, plus the one it dropped (pi-permission-system Phase 10's pipe-labelled soft edge: old 1, new 2).
Classified, the live Phase 15 reads `{hard: 1, unrecognized(-.->): 11}`; Phase 22's archive reads `{hard: 13, soft: 2, unrecognized(-.informs.->): 4}`.
A synthetic line per spelling in the table above classified as the table says.

### Checks

`checkDependencyClaim(step, roadmap, relation)` takes a relation descriptor, and `validateRoadmap` calls it once per relation:

```javascript
const HARD = { edgeKind: "hard", claimOf: (step) => step.hardDependency,
  edgeNoun: "solid edge", bullet: "**Hard dependency:**", claimNoun: "hard dependency" };
const SOFT = { edgeKind: "soft", claimOf: (step) => step.softDependency,
  edgeNoun: "soft edge", bullet: "**Soft dependency:**", claimNoun: "soft dependency" };
// in validateRoadmap's per-step list:
...checkDependencyClaim(step, roadmap, HARD),
...checkDependencyClaim(step, roadmap, SOFT),
```

The hard messages stay byte-identical; the soft ones read `#882 declares a soft dependency on #881 with no soft edge in the diagram`, and so on.

A phase-level `checkEdgeSpellings(roadmap)` returns one error per unrecognized edge: ``diagram edge #945 -.-> #863 is neither hard (`-->`) nor soft (`-.soft.->`)``.
It is an error because both sides parse strictly: the edge is either spelled from the vocabulary or it is not.

`checkAcyclic` keeps filtering to hard edges, so neither soft nor unrecognized edges enter the cycle walk.

### Predicted checker output on Phase 15, step by step

Derived from the measured edge list and bullets above; each step's Verify re-measures it.

| After step              | Errors | Warnings | Change                                                                                                                 |
| ----------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| baseline, 1–4           | 3      | 1        | none: steps 1–4 are behavior-preserving at the CLI                                                                     |
| 5 (soft claims)         | 3      | 2        | + `#882 declares a soft dependency on #881 with no soft edge in the diagram` (its edge is still bare, so unrecognized) |
| 6 (edge spellings)      | 14     | 2        | + 11 unrecognized-edge errors                                                                                          |
| 7 (respell + 5 bullets) | 3      | 6        | − 11 errors, − the #882 warning; + 5 soft-edge-without-bullet warnings on [#863], [#609] ×2, [#957], [#977]            |

### The five soft bullets

Each is placed between the step's `**Target:**`/`**Constraint:**` and `**Outcome:**`, after an existing `**Hard dependency:**` where there is one.
Each reason is taken from the roadmap's own prose, never invented; `parseStepReferenceRun` was run on each draft and reads exactly the one issue.

| Step   | Draft bullet                                                                                                                        | Source of the reason                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [#963] | `` - **Soft dependency:** [#924], which opens the `command-effects.ts` sequence this step sits inside. ``                           | diagram prose: "[#924] and [#880] … sequence rather than parallelize"; "[#963] sits between them" |
| [#880] | `- **Soft dependency:** [#963], whose ADR 0013 §11 amendment is the clause this step's "does not lift the floor" constraint cites.` | diagram prose on [#963]                                                                           |
| [#881] | `` - **Soft dependency:** [#609], whose role-carrying `worstEntry` lets the blame read one shape rather than two. ``                | diagram prose on [#881] and [#609]                                                                |
| [#979] | `- **Soft dependency:** [#977], whose parser-boundary correction the likely seam extends.`                                          | [#979]'s own `**Target:**`; disposition "directly after [#977]"                                   |
| [#978] | `- **Soft dependency:** [#979], which lands directly after [#977], the step this one was placed after.`                             | the two sweep dispositions (operator decisions 2026-09-24 and 2026-09-25)                         |

The sentence under the diagram, "the dashed edges here are sequencing preferences, not dependencies", becomes "the `soft` edges here are sequencing preferences rather than hard dependencies".

## Module-Level Changes

### `scripts/roadmap/parse-roadmap.mjs`: changed

- `parseSteps`: the ordinal remap iterates a list of dependency fields (`hardDependency`, then also `softDependency`) instead of hand-writing one.
- `SOFT_DEPENDENCY` regex; `parseStep` fills `softDependency` the same way as `hardDependency`.
- `EDGE` widened as above; `parseDiagram` classifies through a small pure `classifyLink(operator, pipeLabel)` and pushes the union shape.
- `RoadmapStep` and `RoadmapEdge` typedefs; the `parseDiagram` doc comment ("every dashed spelling is soft") is rewritten.

### `scripts/roadmap/validate-roadmap.mjs`: changed

- `checkDependencyClaim` takes a relation descriptor; `HARD` and `SOFT` descriptors; a second call in `validateRoadmap`.
- `checkEdgeSpellings` added and called from `validateRoadmap`'s phase-level list.
- The `checkAcyclic` doc comment names unrecognized edges beside soft ones as excluded.

### `test/roadmap/parse-roadmap.test.mjs`: changed

- The ordinal fixture gains a `**Soft dependency:** after Step 1 (…)` bullet on Step 2; the issue fixture gains a bracketed one.
- The test `classifies every dashed-edge spelling as soft` inverts to assert `hard`, `unrecognized(-.->)`, `unrecognized(-.informs.->)` for the issue fixture's three edges.
- A new `describe("diagram edge spellings")` with one row per spelling in the vocabulary table.

### `test/roadmap/validate-roadmap.test.mjs`: changed

- `makeStep` gains `softDependency: null`.
- A `describe("soft dependency claims against the diagram")` mirroring the hard block, plus a cross-kind case.
- A `describe("edge spellings")`.

### `packages/pi-permission-system/docs/architecture/architecture.md`: changed

The 11 `-.->` edges in the Phase 15 diagram become `-.soft.->`; the sentence under it is reworded; the five bullets above are added.
No heading, node label, `✅` mark, or `[#N]:` definition changes: every issue the bullets cite is already defined in the file.

### `.pi/skills/improvement-discovery/SKILL.md`: changed

- Output format item 3 (the diagram) gains the two-kind vocabulary table's content: `-->` hard, `-.soft.->` soft, what each asserts, the bullet backing each, and that a no-order relation is not drawn.
- Item 6 (the checker) adds that `**Soft dependency:**` bullets are held to `-.soft.->` edges in both directions and that any other edge spelling is an error.

### `.pi/prompts/plan-improvements.md`: changed

- The diagram line in the Output list (currently "Step dependency diagram (Mermaid flowchart), laid out by dependency…") names the two spellings and points to the skill.
- The errors sentence after `./scripts/roadmap-check.mjs $1` adds "an edge spelled outside the two kinds".
- The warnings sentence says "a `**Hard dependency:**` or `**Soft dependency:**` bullet disagreeing with the diagram".

### Predicted unchanged

| File                                                               | Claim it rests on                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/roadmap-check.mjs`, `test/roadmap/roadmap-check.test.mjs` | The CLI reads only `severity`, `stepIssue`, `message`; its fixtures contain no dashed edge (`grep -n -- '-\.' test/roadmap/roadmap-check.test.mjs` is empty). |
| `scripts/roadmap/step-references.mjs`                              | `parseStepReferenceRun` already reads both draft bullet shapes (measured).                                                                                    |
| `.pi/prompts/finish-phase.md`                                      | Its check paragraph describes findings generically and names no edge spelling.                                                                                |
| `.pi/prompts/tdd-plan.md`, `.pi/prompts/build-plan.md`             | Their `✅` gate counts heading and node lines; respelling an edge on a node line changes neither count.                                                       |
| `packages/*/docs/architecture/history/*.md`                        | Archived records; the checker never reads them.                                                                                                               |
| `packages/pi-subagents/docs/plans/0904-*.md`                       | A historical plan quoting `-.informs.->`.                                                                                                                     |

A grep for `roadmap-check`, `solid edge`, and `dashed edge` across `.pi/`, `AGENTS.md`, `README.md`, and `CONTRIBUTING.md` found only the skill and the two prompts above.

## Test Impact Analysis

- **Enabled:** every link spelling is now a table row with an asserted kind, where today only `-->` and three dashed spellings are pinned, and all three assert `soft`.
- **Rewritten:** `classifies every dashed-edge spelling as soft` asserts the old vocabulary and inverts in step 4; the rewritten test must be mutated explicitly, since it never had a red of its own.
- **Kept as-is:** the five hard-claim tests in `dependency claims against the diagram` pin the hard messages byte-for-byte through the descriptor refactor; the acyclicity test `ignores soft edges` keeps pinning that only hard edges enter the walk.
- **Fixture shapes:** the soft-bullet tests use both an ordinal (`after Step 1`) and a bracketed (`[#857]`) reference, since the remap's ordinal arm is what step 1 generalizes.

Baseline: `pnpm run test:scripts` reports 10 files, 221 tests (measured).

## Invariants at risk

| Invariant                                   | Constituency                                     | Pinned by                                                                                                          |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Hard-dependency messages are byte-identical | `/plan-improvements` readers of the warnings     | the four warning tests in `validate-roadmap.test.mjs` `dependency claims against the diagram` (exact `toEqual`)    |
| Only hard edges enter cycle detection       | every roadmap author (a soft back-edge is legal) | `ignores soft edges, which state a preference rather than a constraint`; step 6 adds an unrecognized back-edge row |
| Warnings never change the exit code         | `/finish-phase`'s advisory run                   | `roadmap-check.test.mjs` warning-only fixture                                                                      |
| `✅` step-mark gate reads 2 per landed step | `/tdd-plan`, `/build-plan`                       | step 7 re-runs `grep -cE '✅.*#<N>\b'` for 945, 863, 859, 957, 609, 977 before and after                           |
| Every `[#N]` resolves (MD053)               | `pnpm run lint`                                  | step 7 runs `pnpm exec rumdl check` on the edited file                                                             |
| Landed step blocks are not revised          | the roadmap as a planning record                 | step 7's diff touches no block under a `#### ✅` heading (`git diff` review)                                       |

## TDD Order

Each step runs `pnpm run test:scripts` and `pnpm run lint` before committing.
No `Co-authored-by:` trailer applies: the issue and the design are the operator's own.

1. **Tidy: one ordinal remap for every dependency field.**
   Friction prepared: step 3 needs the same ordinal → issue resolution for `softDependency`, which today is hand-written for `hardDependency` only.
   Generalize `parseSteps`' final map to iterate a field list containing `hardDependency` alone.
   No new test; `resolves an ordinal dependency claim to the issue it names` pins it.
   Killing mutation: return `step` unmapped from the remap, so that test reads ordinal `1` instead of issue `724` and goes red.
   Commit: `refactor: resolve dependency-bullet ordinals through one field-driven remap`.
2. **Tidy: the dependency-claim check takes a relation.**
   Friction prepared: step 5 would otherwise copy `checkDependencyClaim`'s 35 lines to change a filter, a field, and three nouns.
   Introduce the `HARD` descriptor and pass it from `validateRoadmap`; `hardEdges` stays for `checkAcyclic`.
   No new test; the four hard warning tests pin the messages.
   Killing mutation: set `HARD.edgeNoun` to `"hard edge"`, so the three tests asserting "solid edge" go red.
   Commit: `refactor: parameterize the roadmap dependency-claim check by relation`.
3. **Parse the soft bullet.**
   Add `SOFT_DEPENDENCY`, the `softDependency` field, and the second remap entry; add `softDependency: null` to `makeStep`.
   Tests: the ordinal fixture's `after Step 1 (…)` resolves to `[724]`; the issue fixture's bracketed bullet reads `[857]`; a step with no bullet reads `null`.
   Killing mutations: drop `softDependency` from the remap list (the ordinal test reads `[1]`, red); set `softDependency` to `null` unconditionally (the bracketed test goes red).
   Commit: `refactor: read an improvement-roadmap step's Soft dependency bullet`.
4. **Classify edges.**
   Widen `EDGE`, add `classifyLink`, and adopt the `RoadmapEdge` union; rewrite `parseDiagram`'s doc comment.
   Tests: invert the issue fixture's edge assertion; add the `diagram edge spellings` table (`-->` hard; `-.soft.->` and `-. soft .->` soft; `-.->`, `-.informs.->`, `-.->|soft|`, `-->|x|`, `==>`, `--->`, `-..->` unrecognized with their spellings).
   Killing mutations, one per class: classify every `-.…->` as soft (the bare and `informs` rows go red); remove the `|label|` group from `EDGE` (the pipe rows lose their edge and go red); ignore the pipe label in `classifyLink` (`-->|x|` reads hard, red); compare the soft label without trimming (`-. soft .->` reads unrecognized, red).
   Verify: `./scripts/roadmap-check.mjs pi-permission-system` output is unchanged from baseline (3 errors, 1 warning).
   Commit: `refactor: classify roadmap diagram edges as hard, soft, or unrecognized`.
5. **Hold soft bullets to soft edges.**
   Add the `SOFT` descriptor and its call.
   Tests, in a `soft dependency claims against the diagram` block: a matching claim is clean; an edge the bullet omits, a claim with no edge, and an edge into a step with no bullet each produce their soft message; a soft bullet on #X with only a **hard** edge from #X yields the soft "no soft edge" warning and the hard "no **Hard dependency:** bullet" warning.
   Killing mutations: delete the `SOFT` call (every soft test goes red); set `SOFT.edgeKind` to `"hard"` (the cross-kind test goes red).
   Verify: Phase 15 reads 3 errors, 2 warnings, the new one on #882.
   Commit: `feat: warn when a roadmap's Soft dependency bullets disagree with its soft edges`.
6. **Reject an edge outside the vocabulary.**
   Add `checkEdgeSpellings`.
   Tests: a bare `-.->` and an `==>` edge each produce their error naming the spelling; hard and soft edges produce none; an unrecognized back-edge adds no cycle error.
   Killing mutations: return `[]` from `checkEdgeSpellings` (both error tests red); report only spellings starting with `-.` (the `==>` test red).
   Verify: Phase 15 reads 14 errors, 2 warnings.
   Commit: `feat: report a roadmap diagram edge spelled outside the hard and soft vocabulary`.
7. **Respell Phase 15.**
   Respell the 11 edges, reword the sentence under the diagram, and add the five bullets from Design Overview.
   Verify: Phase 15 reads 3 errors and 6 warnings (the five soft ones on landed steps, plus [#963]'s existing batch warning); the `✅` gate reads 2 for each landed step; `pnpm exec rumdl check` on the file is clean; the diagram renders through `mmdc` (the `mermaid` skill's extraction, narrowed to the roadmap section).
   Killing mutation: none, this step adds no code; its falsification is the 14 → 3 error drop.
   Commit: `docs(pi-permission-system): spell Phase 15's dashed edges as soft dependencies`.
8. **Write the vocabulary down.**
   Edit the skill's Output format items 3 and 6 and the three `plan-improvements.md` sentences.
   Verify: `grep -c -- '-.soft.->'` is at least 1 in each file; `pnpm exec rumdl check` on both.
   Commit: `docs: settle the roadmap dependency diagram's edge vocabulary`.

### Tidy First

The `tidy-first-assessor` recommended the two preparatory refactors that became steps 1 and 2.
It listed `classifyLink` as optional; the plan keeps it inside step 4, because the three-way classification is new logic with no existing shape to extract from.
It rejected three items as scope creep (the node-label map, renaming `HARD_DEPENDENCY`, and a comment-only `checkAcyclic` touch), none of which the change needs.
Its claim that nothing outside the two modules and their tests reads `edge.kind` or constructs a step was re-checked with `grep -rn 'kind\b\|hardDependency\|\.edges' scripts test`.

## Risks and Mitigations

- **Merge conflicts on the live roadmap.**
  Phase 15 is in flight with seven open steps, and peer worktrees edit this file.
  Mitigation: step 7 is last among the code-adjacent steps and touches only diagram lines, one sentence, and five inserted bullets; `/sync-worktree` before it.
- **The next roadmap is written with bare dashes by habit.**
  Mitigation: step 8 puts the spelling where `/plan-improvements` reads it, and the error names both accepted spellings.
- **Five standing warnings read as noise until Phase 15 archives.**
  Mitigation: warnings do not change the exit status; `/finish-phase` treats its run as advisory and asks the closer to note what is left.
- **`-.soft.->` renders differently on GitHub than in `mmdc`.**
  The archived Phase 20–22 docs already use it on GitHub, and `mmdc` renders its label (measured); step 7 re-runs `mmdc`.
- **A widened `EDGE` captures something that is not an edge.**
  Mitigation: the corpus run above matched exactly the old pattern's edges plus the one dropped pipe edge, across every roadmap diagram in the repo.

## Open Questions

None blocking.

[#609]: https://github.com/gotgenes/pi-packages/issues/609
[#863]: https://github.com/gotgenes/pi-packages/issues/863
[#880]: https://github.com/gotgenes/pi-packages/issues/880
[#881]: https://github.com/gotgenes/pi-packages/issues/881
[#882]: https://github.com/gotgenes/pi-packages/issues/882
[#894]: https://github.com/gotgenes/pi-packages/issues/894
[#924]: https://github.com/gotgenes/pi-packages/issues/924
[#945]: https://github.com/gotgenes/pi-packages/issues/945
[#957]: https://github.com/gotgenes/pi-packages/issues/957
[#963]: https://github.com/gotgenes/pi-packages/issues/963
[#977]: https://github.com/gotgenes/pi-packages/issues/977
[#978]: https://github.com/gotgenes/pi-packages/issues/978
[#979]: https://github.com/gotgenes/pi-packages/issues/979
