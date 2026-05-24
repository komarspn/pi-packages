/**
 * message-formatters.ts — Pure formatting functions for each session message type.
 *
 * Each function converts a single message or content block into display lines.
 * Returns null for empty/skippable content (caller skips the separator).
 */

import { extractText } from "#src/session/context";
import type { Theme } from "#src/ui/display";

// ── Types ────────────────────────────────────────────────────────────────────

/** Narrow context shared by all message formatters. */
export interface FormatterContext {
  theme: Theme;
  wrapText: (text: string, width: number) => string[];
}

// ── formatUserMessage ─────────────────────────────────────────────────────────

/**
 * Format a user message into display lines.
 * Returns null when the message text is empty (caller should skip separator).
 */
export function formatUserMessage(
  content: string | unknown[],
  width: number,
  ctx: FormatterContext,
): string[] | null {
  const { theme, wrapText } = ctx;
  const text = typeof content === "string" ? content : extractText(content);
  if (!text.trim()) return null;
  return [
    theme.fg("accent", "[User]"),
    ...wrapText(text.trim(), width),
  ];
}
