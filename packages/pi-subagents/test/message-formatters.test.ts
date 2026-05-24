import { describe, expect, it } from "vitest";
import type { Theme } from "#src/ui/display";
import type { FormatterContext } from "#src/ui/message-formatters";
import { formatUserMessage } from "#src/ui/message-formatters";

// ── Theme helpers ────────────────────────────────────────────────────────────

/** Label theme: wraps text in [color:text] / [bold:text] for precise assertions. */
const labelTheme: Theme = {
  fg: (color, text) => `[${color}:${text}]`,
  bold: (text) => `[bold:${text}]`,
};

/** Identity theme: returns text unchanged for structure-only assertions. */
const plainTheme: Theme = {
  fg: (_color, text) => text,
  bold: (text) => text,
};

/** No-op wrapText: returns input as a single line. */
const noWrap = (text: string, _width: number): string[] => [text];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("message-formatters", () => {
  describe("formatUserMessage", () => {
    const ctx: FormatterContext = { theme: labelTheme, wrapText: noWrap };

    it("returns null for empty string content", () => {
      expect(formatUserMessage("", 80, ctx)).toBeNull();
    });

    it("returns null for whitespace-only string content", () => {
      expect(formatUserMessage("   \n  ", 80, ctx)).toBeNull();
    });

    it("returns null for empty content array", () => {
      expect(formatUserMessage([], 80, ctx)).toBeNull();
    });

    it("returns null for content array with no text items", () => {
      const content = [{ type: "toolCall", name: "read" }];
      expect(formatUserMessage(content, 80, ctx)).toBeNull();
    });

    it("formats string content with User header and wrapped text", () => {
      const result = formatUserMessage("hello world", 80, ctx);
      expect(result).toEqual(["[accent:[User]]", "hello world"]);
    });

    it("extracts text from content array", () => {
      const content = [{ type: "text", text: "from array" }];
      const result = formatUserMessage(content, 80, ctx);
      expect(result).toEqual(["[accent:[User]]", "from array"]);
    });

    it("trims content before passing to wrapText", () => {
      const result = formatUserMessage("  trimmed  ", 80, ctx);
      expect(result).toEqual(["[accent:[User]]", "trimmed"]);
    });

    it("passes width to wrapText", () => {
      const capturedWidths: number[] = [];
      const capturingWrap = (text: string, width: number): string[] => {
        capturedWidths.push(width);
        return [text];
      };
      formatUserMessage("text", 42, { theme: plainTheme, wrapText: capturingWrap });
      expect(capturedWidths).toEqual([42]);
    });

    it("returns multiple lines when wrapText splits content", () => {
      const splitWrap = (text: string, _width: number): string[] => text.split(" ");
      const result = formatUserMessage("one two three", 80, { theme: plainTheme, wrapText: splitWrap });
      expect(result).toEqual(["[User]", "one", "two", "three"]);
    });
  });
});
