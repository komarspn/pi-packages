import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ForegroundParams, runForeground } from "../../src/tools/foreground-runner.js";
import { createToolDeps } from "../helpers/make-deps.js";
import { createTestRecord } from "../helpers/make-record.js";

function makeCtx() {
  return {
    sessionManager: {
      getSessionFile: vi.fn().mockReturnValue("/sessions/parent.jsonl"),
      getSessionId: vi.fn().mockReturnValue("session-1"),
    },
  };
}

function makeParams(overrides: Partial<ForegroundParams> = {}): ForegroundParams {
  return {
    ctx: makeCtx(),
    subagentType: "general-purpose",
    prompt: "do the task",
    description: "fg task",
    detailBase: {
      displayName: "General-purpose",
      description: "fg task",
      subagentType: "general-purpose",
      modelName: undefined,
      tags: undefined,
    },
    rawType: "general-purpose",
    fellBack: false,
    model: undefined,
    effectiveMaxTurns: undefined,
    isolated: undefined,
    inheritContext: undefined,
    thinking: undefined,
    isolation: undefined,
    agentInvocation: {
      modelName: undefined,
      thinking: undefined,
      maxTurns: undefined,
      isolated: undefined,
      inheritContext: undefined,
      runInBackground: false,
      isolation: undefined,
    },
    ...overrides,
  };
}

describe("runForeground", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns completion message with tool use count on success", async () => {
    const deps = createToolDeps();
    const result = await runForeground(deps, makeParams(), undefined, undefined);
    expect(result.content[0].text).toContain("Agent completed");
    expect(result.content[0].text).toContain("3 tool uses");
    expect(result.content[0].text).toContain("All done.");
  });

  it("returns error message when agent record status is error", async () => {
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawnAndWait: vi.fn().mockResolvedValue(
          createTestRecord({ status: "error", error: "Context window exceeded" }),
        ),
      },
    });
    const result = await runForeground(deps, makeParams(), undefined, undefined);
    expect(result.content[0].text).toContain("Agent failed");
    expect(result.content[0].text).toContain("Context window exceeded");
  });

  it("returns error text when spawnAndWait throws", async () => {
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawnAndWait: vi.fn().mockRejectedValue(new Error("runner crashed")),
      },
    });
    const result = await runForeground(deps, makeParams(), undefined, undefined);
    expect(result.content[0].text).toContain("runner crashed");
  });

  it("includes fallback note when fellBack is true", async () => {
    const deps = createToolDeps();
    const result = await runForeground(
      deps,
      makeParams({ fellBack: true, rawType: "unknown-type" }),
      undefined,
      undefined,
    );
    expect(result.content[0].text).toContain('Unknown agent type "unknown-type"');
  });

  it("calls widget.ensureTimer and widget.markFinished after completion", async () => {
    // spawnAndWait invokes onSessionCreated to register the agent in activity map
    const mockSess = { subscribe: vi.fn().mockReturnValue(() => {}) };
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawnAndWait: vi.fn().mockImplementation(
          async (_ctx: any, _type: any, _prompt: any, opts: any) => {
            const record = createTestRecord({ result: "done" });
            opts.onSessionCreated?.(mockSess, record);
            return record;
          },
        ),
      },
    });
    const signal = new AbortController().signal;
    await runForeground(deps, makeParams(), signal, undefined);
    expect(deps.widget.ensureTimer).toHaveBeenCalled();
    expect(deps.widget.markFinished).toHaveBeenCalled();
  });

  it("registers activity tracker in agentActivity on session creation", async () => {
    const mockSess = { subscribe: vi.fn().mockReturnValue(() => {}) };
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawnAndWait: vi.fn().mockImplementation(
          async (_ctx: any, _type: any, _prompt: any, opts: any) => {
            const record = createTestRecord({ result: "done" });
            record.execution = { session: {} as any, outputFile: undefined };
            opts.onSessionCreated?.(mockSess, record);
            return record;
          },
        ),
      },
    });
    await runForeground(deps, makeParams(), undefined, undefined);
    // Activity is registered during onSessionCreated and removed on cleanup —
    // markFinished is the evidence that the id was tracked and cleaned up.
    expect(deps.widget.markFinished).toHaveBeenCalledOnce();
  });

  it("calls onUpdate with streaming details while running", async () => {
    let resolve!: (r: any) => void;
    const promise = new Promise<any>((res) => { resolve = res; });
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawnAndWait: vi.fn().mockReturnValue(promise),
      },
    });
    const onUpdate = vi.fn();
    const runPromise = runForeground(deps, makeParams(), undefined, onUpdate);

    // Advance timer to trigger a spinner tick
    await vi.advanceTimersByTimeAsync(100);
    expect(onUpdate).toHaveBeenCalled();

    resolve(createTestRecord({ result: "done" }));
    await runPromise;
  });

  it("clears spinner interval on error and does not leave it running", async () => {
    const deps = createToolDeps({
      manager: {
        ...createToolDeps().manager,
        spawnAndWait: vi.fn().mockRejectedValue(new Error("fail")),
      },
    });
    const onUpdate = vi.fn();
    await runForeground(deps, makeParams(), undefined, onUpdate);

    onUpdate.mockClear();
    await vi.advanceTimersByTimeAsync(200);
    // Interval must have been cleared — no further onUpdate calls
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
