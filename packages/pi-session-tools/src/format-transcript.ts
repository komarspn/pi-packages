/**
 * format-transcript.ts — Formats Pi session entries as a human-readable transcript.
 *
 * Preserves conversation flow (user/assistant turns, tool calls, metadata events)
 * while dropping noise (thinking content, image data, token usage, tool result bodies).
 */

/** Minimal entry type — accepts both SessionEntry[] and ParsedEntry[]. */
export interface TranscriptEntry {
  type: string;
  [key: string]: unknown;
}

/**
 * Extract plain text from user message content.
 * Handles both string content and TextContent[] arrays (skipping images).
 */
function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (c): c is { type: "text"; text: string } =>
          typeof c === "object" &&
          c !== null &&
          (c as { type: string }).type === "text" &&
          typeof (c as { text: string }).text === "string",
      )
      .map((c) => c.text)
      .join("");
  }
  return "";
}

function formatUserMessage(
  message: Record<string, unknown>,
  num: number,
): string {
  const text = extractTextContent(message.content);
  return `${num}. user\n${text}`;
}

function formatAssistantMessage(
  message: Record<string, unknown>,
  num: number,
): string {
  const provider =
    typeof message.provider === "string" ? message.provider : "unknown";
  const model = typeof message.model === "string" ? message.model : "unknown";
  const header = `${num}. assistant [${provider}/${model}]`;

  const content = message.content;
  if (!Array.isArray(content)) return header;

  const lines: string[] = [header];
  for (const part of content) {
    if (typeof part !== "object" || part === null) continue;
    const p = part as Record<string, unknown>;
    if (p.type === "text" && typeof p.text === "string") {
      lines.push(p.text);
    }
    // ToolCall parts handled in formatAssistantWithToolResults (Step 2)
  }
  return lines.join("\n");
}

/**
 * Format a session entry array as a human-readable transcript.
 *
 * Sequential numbering counts only user and assistant conversation turns.
 * Metadata entries (compaction, model change, etc.) and omitted entry types
 * do not increment the turn counter.
 * Entries are separated by `---` dividers.
 */
export function formatTranscript(entries: TranscriptEntry[]): string {
  const parts: string[] = [];
  let turnNum = 0;

  for (const entry of entries) {
    if (entry.type !== "message") {
      // metadata entries (compaction, model_change, etc.) — handled in Step 3
      continue;
    }

    const message = entry.message as Record<string, unknown> | undefined;
    if (!message || typeof message !== "object") continue;

    const role = message.role;

    if (role === "user") {
      turnNum++;
      parts.push(formatUserMessage(message, turnNum));
    } else if (role === "assistant") {
      turnNum++;
      parts.push(formatAssistantMessage(message, turnNum));
    }
    // toolResult, bashExecution, custom, compactionSummary, branchSummary: Step 2/3
  }

  return parts.join("\n\n---\n\n");
}
