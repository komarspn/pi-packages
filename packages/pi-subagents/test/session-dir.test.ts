import { describe, expect, it } from "vitest";
import { deriveSubagentSessionDir } from "../src/session-dir.js";

describe("deriveSubagentSessionDir", () => {
  it("returns a tasks/ subdirectory nested under the parent session basename", () => {
    const result = deriveSubagentSessionDir(
      "/home/user/.pi/agent/sessions/--project--/2026-05-20T12-00-00Z_.jsonl",
      "/home/user/project",
    );
    expect(result).toBe(
      "/home/user/.pi/agent/sessions/--project--/2026-05-20T12-00-00Z_/tasks",
    );
  });

  it("strips the .jsonl extension from the parent session basename", () => {
    const result = deriveSubagentSessionDir(
      "/sessions/abc123.jsonl",
      "/tmp",
    );
    expect(result).toBe("/sessions/abc123/tasks");
  });

  it("handles parent session files without a .jsonl extension", () => {
    const result = deriveSubagentSessionDir(
      "/sessions/abc123",
      "/tmp",
    );
    // basename is "abc123" (no extension to strip)
    expect(result).toBe("/sessions/abc123/tasks");
  });

  it("returns a temp directory when parentSessionFile is undefined", () => {
    const result = deriveSubagentSessionDir(undefined, "/home/user/project");
    // Should start with the OS temp directory prefix and contain "pi-subagents"
    expect(result).toMatch(/pi-subagents/);
    expect(result).toMatch(/tasks$/);
  });
});
