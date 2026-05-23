import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exec } from "../../src/lib/exec.js";
import { createReindexer } from "../../src/lib/reindex.js";

// ---- shared factory ----

function makeExec(): Mock<Exec> {
  return vi.fn<Exec>();
}

function makeOnStatus(): Mock<(status: string | undefined) => void> {
  return vi.fn<(status: string | undefined) => void>();
}

// ---- Cycle 1: basic reindex execution ----

describe("createReindexer — runNow()", () => {
  let exec: Mock<Exec>;
  let onStatus: Mock<(status: string | undefined) => void>;

  beforeEach(() => {
    exec = makeExec();
    onStatus = makeOnStatus();
  });

  it("calls colgrep init -y . with configured cwd and default timeout", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    expect(exec).toHaveBeenCalledWith("colgrep", ["init", "-y", "."], {
      cwd: "/project",
      timeout: 300_000,
    });
  });

  it("respects a custom timeoutMs", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    const reindexer = createReindexer({
      exec,
      cwd: "/project",
      onStatus,
      timeoutMs: 60_000,
    });
    await reindexer.runNow();
    expect(exec).toHaveBeenCalledWith("colgrep", ["init", "-y", "."], {
      cwd: "/project",
      timeout: 60_000,
    });
  });

  it("calls onStatus with indexing text before exec runs", async () => {
    let statusAtExecTime: string | undefined = "not set";
    exec.mockImplementation(async () => {
      // Capture the most recent onStatus call at the moment exec fires
      statusAtExecTime = onStatus.mock.calls.at(-1)?.[0] as string | undefined;
      return { stdout: "", stderr: "", code: 0 };
    });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    expect(statusAtExecTime).toBe("colgrep: indexing\u2026");
  });

  it("clears status with undefined after successful run", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    expect(onStatus).toHaveBeenLastCalledWith(undefined);
  });

  it("resolves without throwing on success", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "", code: 0 });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await expect(reindexer.runNow()).resolves.toBeUndefined();
  });
});

// ---- Cycle 2: error handling ----

describe("createReindexer — runNow() error handling", () => {
  let exec: Mock<Exec>;
  let onStatus: Mock<(status: string | undefined) => void>;

  beforeEach(() => {
    exec = makeExec();
    onStatus = makeOnStatus();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows indexing-failed status when exec exits non-zero", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "disk full", code: 1 });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    const statusCalls = onStatus.mock.calls.map((c) => c[0]);
    expect(statusCalls).toContain("colgrep: indexing failed");
  });

  it("clears failed status after a brief delay (undefined follows failed)", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "disk full", code: 1 });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    // The last call must clear the status
    expect(onStatus).toHaveBeenLastCalledWith(undefined);
  });

  it("shows indexing-failed status when exec throws", async () => {
    exec.mockRejectedValue(new Error("EPERM"));
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    const statusCalls = onStatus.mock.calls.map((c) => c[0]);
    expect(statusCalls).toContain("colgrep: indexing failed");
  });

  it("resolves without throwing when exec exits non-zero", async () => {
    exec.mockResolvedValue({ stdout: "", stderr: "oops", code: 1 });
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await expect(reindexer.runNow()).resolves.toBeUndefined();
  });

  it("resolves without throwing when exec throws", async () => {
    exec.mockRejectedValue(new Error("EPERM"));
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await expect(reindexer.runNow()).resolves.toBeUndefined();
  });

  it("logs the error to console.error", async () => {
    exec.mockRejectedValue(new Error("EPERM"));
    const reindexer = createReindexer({ exec, cwd: "/project", onStatus });
    await reindexer.runNow();
    expect(console.error).toHaveBeenCalled();
  });
});
