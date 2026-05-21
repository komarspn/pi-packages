/**
 * parent-snapshot.ts — Capture parent session state as a plain data snapshot.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildParentContext } from "./context.js";
import type { ParentSnapshot } from "./types.js";

/**
 * Build an immutable snapshot of the parent session state.
 *
 * Called once at spawn time so queued agents capture state as it existed
 * when the user requested the agent, not when a queue slot opens.
 */
export function buildParentSnapshot(
  ctx: ExtensionContext,
  inheritContext?: boolean,
): ParentSnapshot {
  const parentContext = inheritContext ? buildParentContext(ctx) : undefined;
  return {
    cwd: ctx.cwd,
    systemPrompt: ctx.getSystemPrompt(),
    model: ctx.model,
    modelRegistry: ctx.modelRegistry,
    parentContext: parentContext || undefined,
  };
}
