import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { mergeReleasePR } from "../lib/release";
import { err, ok } from "../tool-result";

export function registerReleasePrMerge(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "release_pr_merge",
    label: "Release PR Merge",
    description:
      "Merge a release-please PR after confirming it is clean. " +
      "Checks MERGEABLE + CLEAN status, merges with --rebase, and runs git pull --ff-only. " +
      "Returns merge confirmation with new HEAD SHA, or a structured error if not mergeable.",
    promptSnippet:
      "release_pr_merge: Merge a release-please PR after confirming it's clean.",
    parameters: Type.Object({
      pr_number: Type.Number({
        description: "The PR number to merge.",
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const result = await mergeReleasePR({ prNumber: params.pr_number });
        return result.isError ? err(result.content) : ok(result.content);
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  });
}
