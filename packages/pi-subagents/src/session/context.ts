/**
 * context.ts — Extract parent conversation context for subagent inheritance.
 */

import type { TextContent } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Type predicate: narrow an unknown content block to TextContent. */
function isTextContent(c: unknown): c is TextContent {
  return typeof c === "object" && c !== null && (c as { type: string }).type === "text";
}

/** Extract text from a message content block array. */
export function extractText(content: unknown[]): string {
  return content
    .filter(isTextContent)
    .map((c) => c.text)
    .join("\n");
}

/**
 * Build a text representation of the parent conversation context.
 * Used when inherit_context is true to give the subagent visibility
 * into what has been discussed/done so far.
 */
export function buildParentContext(ctx: ExtensionContext): string {
  const entries = ctx.sessionManager.getBranch();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getBranch() may return undefined at runtime despite its type
  if (!entries || entries.length === 0) return "";

  const parts: string[] = [];

  for (const entry of entries) {
    if (entry.type === "message") {
      const msg = entry.message;
      if (msg.role === "user") {
        const text = typeof msg.content === "string"
          ? msg.content
          : extractText(msg.content);
        if (text.trim()) parts.push(`[User]: ${text.trim()}`);
      } else if (msg.role === "assistant") {
        const text = extractText(msg.content);
        if (text.trim()) parts.push(`[Assistant]: ${text.trim()}`);
      }
      // Skip toolResult messages — too verbose for context
    } else if (entry.type === "compaction") {
      // Include compaction summaries — they're already condensed
      if (entry.summary) {
        parts.push(`[Summary]: ${entry.summary}`);
      }
    }
  }

  if (parts.length === 0) return "";

  return `# Parent Conversation Context
The following is the conversation history from the parent session that spawned you.
Use this context to understand what has been discussed and decided so far.

${parts.join("\n\n")}

---
# Your Task (below)
`;
}
