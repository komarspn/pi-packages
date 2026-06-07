import { getNonEmptyString, toRecord } from "#src/common";
import type { ScopedPermissionResolver } from "#src/permission-resolver";
import type { SkillPromptEntry } from "#src/skill-prompt-sanitizer";
import type { ToolInputFormatterLookup } from "#src/tool-input-formatter-registry";
import {
  ToolPreviewFormatter,
  type ToolPreviewFormatterOptions,
} from "#src/tool-preview-formatter";
import { resolveBashCommandCheck } from "./bash-command";
import { describeBashExternalDirectoryGate } from "./bash-external-directory";
import { describeBashPathGate } from "./bash-path";
import { BashProgram } from "./bash-program";
import type { GateResult } from "./descriptor";
import { describeExternalDirectoryGate } from "./external-directory";
import { describePathGate } from "./path";
import type { GateRunner } from "./runner";
import { describeSkillReadGate } from "./skill-read";
import { describeToolGate } from "./tool";
import type { GateOutcome, ToolCallContext } from "./types";

/**
 * Narrow interface the pipeline needs from its session-side dependency.
 *
 * Extends `ScopedPermissionResolver` (the `resolve` method gate factories use)
 * with the three query methods needed to assemble gate inputs.
 *
 * `PermissionSession` satisfies this structurally at the construction call
 * site; no `implements` clause is needed and would create a layer-inversion
 * import from the domain module into the handler layer.
 */
export interface ToolCallGateInputs extends ScopedPermissionResolver {
  /** Active skill prompt entries for the skill-read gate. */
  getActiveSkillEntries(): SkillPromptEntry[];
  /** Combined infrastructure read directories (static + config-derived). */
  getInfrastructureReadDirs(): string[];
  /** Resolved tool-preview formatter options from the current config. */
  getToolPreviewLimits(): ToolPreviewFormatterOptions;
}

/**
 * Owns the ordered tool-call gate-producer assembly and the run loop.
 *
 * Constructed once in the composition root and injected into
 * `PermissionGateHandler`. `evaluate(tcc, runner)` encapsulates:
 * - bash-command extraction and single `BashProgram.parse` (#308)
 * - `ToolPreviewFormatter` construction from `getToolPreviewLimits()`
 * - infrastructure-dir list from `getInfrastructureReadDirs()`
 * - all six gate producers in their prescribed order
 * - the run loop that returns the first block outcome, or allow
 */
export class ToolCallGatePipeline {
  constructor(
    private readonly inputs: ToolCallGateInputs,
    private readonly customFormatters?: ToolInputFormatterLookup,
  ) {}

  async evaluate(
    tcc: ToolCallContext,
    runner: GateRunner,
  ): Promise<GateOutcome> {
    // Parse the bash command exactly once per evaluate; the three bash gates
    // share this single BashProgram instead of each re-parsing (#308).
    const command = getNonEmptyString(toRecord(tcc.input).command);
    const bashProgram =
      tcc.toolName === "bash" && command
        ? await BashProgram.parse(command)
        : null;

    const formatter = new ToolPreviewFormatter(
      this.inputs.getToolPreviewLimits(),
      this.customFormatters,
    );

    const infraDirs = this.inputs.getInfrastructureReadDirs();

    const gateProducers: Array<() => GateResult | Promise<GateResult>> = [
      () =>
        describeSkillReadGate(tcc, () => this.inputs.getActiveSkillEntries()),
      () => describePathGate(tcc, this.inputs),
      () => describeExternalDirectoryGate(tcc, infraDirs),
      () => describeBashExternalDirectoryGate(tcc, bashProgram, this.inputs),
      () => describeBashPathGate(tcc, bashProgram, this.inputs),
      () => {
        // Bash commands may chain several sub-commands (`a && b`, `a | b`, …);
        // evaluate each unit from the shared parse on the bash surface and
        // select the most restrictive, rather than matching the whole program
        // string (#301). Other tools evaluate their single input directly.
        const toolCheck =
          tcc.toolName === "bash" && bashProgram
            ? resolveBashCommandCheck(
                command ?? "",
                bashProgram.commands(),
                tcc.agentName ?? undefined,
                this.inputs,
              )
            : this.inputs.resolve(
                tcc.toolName,
                tcc.input,
                tcc.agentName ?? undefined,
              );
        const toolDescriptor = describeToolGate(tcc, toolCheck, formatter);
        toolDescriptor.preCheck = toolCheck;
        return toolDescriptor;
      },
    ];

    for (const produce of gateProducers) {
      const outcome = await runner.run(
        await produce(),
        tcc.agentName,
        tcc.toolCallId,
      );
      if (outcome.action === "block") {
        return outcome;
      }
    }

    return { action: "allow" };
  }
}
