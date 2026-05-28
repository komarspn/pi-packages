import { describe, expect, it } from "vitest";
import { formatTranscript } from "#src/format-transcript";

function makeUserEntry(content: unknown, id = "1"): Record<string, unknown> {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    message: {
      role: "user",
      content,
      timestamp: 1000,
    },
  };
}

function makeAssistantEntry(
  textParts: string | string[],
  provider = "anthropic",
  model = "claude-sonnet-4-20250514",
  id = "2",
): Record<string, unknown> {
  const contentArr = (Array.isArray(textParts) ? textParts : [textParts]).map(
    (t) => ({ type: "text", text: t }),
  );
  return {
    type: "message",
    id,
    parentId: "1",
    timestamp: "2026-01-01T00:00:01Z",
    message: {
      role: "assistant",
      content: contentArr,
      provider,
      model,
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 2000,
    },
  };
}

describe("formatTranscript — basic message formatting", () => {
  it("returns empty string for empty entries", () => {
    expect(formatTranscript([])).toBe("");
  });

  it("formats a user message with string content", () => {
    const entries = [makeUserEntry("How do I fix the login bug?")];
    expect(formatTranscript(entries)).toBe(
      "1. user\nHow do I fix the login bug?",
    );
  });

  it("formats a user message with TextContent array, joining text parts", () => {
    const entries = [
      makeUserEntry([
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
      ]),
    ];
    expect(formatTranscript(entries)).toBe("1. user\nHello world");
  });

  it("skips non-text content (images) in user message array", () => {
    const entries = [
      makeUserEntry([
        { type: "text", text: "What is in this image?" },
        { type: "image", data: "base64data", mimeType: "image/png" },
      ]),
    ];
    expect(formatTranscript(entries)).toBe("1. user\nWhat is in this image?");
  });

  it("formats an assistant message with model attribution", () => {
    const entries = [
      makeAssistantEntry(
        "Let me help you.",
        "anthropic",
        "claude-opus-4-20250514",
      ),
    ];
    expect(formatTranscript(entries)).toBe(
      "1. assistant [anthropic/claude-opus-4-20250514]\nLet me help you.",
    );
  });

  it("uses [unknown/unknown] when provider/model fields are absent", () => {
    const entry = {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "t",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hi" }],
      },
    };
    expect(formatTranscript([entry])).toBe(
      "1. assistant [unknown/unknown]\nHi",
    );
  });

  it("assigns sequential turn numbers across user and assistant messages", () => {
    const entries = [
      makeUserEntry("First", "1"),
      makeAssistantEntry(
        "Second",
        "anthropic",
        "claude-sonnet-4-20250514",
        "2",
      ),
      makeUserEntry("Third", "3"),
    ];
    const result = formatTranscript(entries);
    expect(result).toContain("1. user\nFirst");
    expect(result).toContain(
      "2. assistant [anthropic/claude-sonnet-4-20250514]\nSecond",
    );
    expect(result).toContain("3. user\nThird");
  });

  it("joins entries with --- separator", () => {
    const entries = [
      makeUserEntry("Hello", "1"),
      makeAssistantEntry(
        "Hi there",
        "anthropic",
        "claude-sonnet-4-20250514",
        "2",
      ),
    ];
    expect(formatTranscript(entries)).toBe(
      "1. user\nHello\n\n---\n\n2. assistant [anthropic/claude-sonnet-4-20250514]\nHi there",
    );
  });

  it("omits thinking content from assistant message", () => {
    const entry = {
      type: "message",
      id: "1",
      parentId: null,
      timestamp: "t",
      message: {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "Let me reason...",
            thinkingSignature: "sig",
          },
          { type: "text", text: "The answer is 42." },
        ],
        provider: "anthropic",
        model: "claude-opus-4-20250514",
      },
    };
    expect(formatTranscript([entry])).toBe(
      "1. assistant [anthropic/claude-opus-4-20250514]\nThe answer is 42.",
    );
  });

  it("concatenates multiple text blocks in assistant message", () => {
    const entries = [makeAssistantEntry(["First block.", "Second block."])];
    expect(formatTranscript(entries)).toBe(
      "1. assistant [anthropic/claude-sonnet-4-20250514]\nFirst block.\nSecond block.",
    );
  });
});
