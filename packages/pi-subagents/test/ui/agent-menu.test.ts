import { describe, expect, it, vi } from "vitest";
import type { AgentRecord } from "../../src/types.js";
import { type AgentMenuDeps, createAgentsMenuHandler } from "../../src/ui/agent-menu.js";

function makeRecord(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: "agent-1",
    type: "general-purpose",
    description: "Test task",
    status: "completed",
    result: "All done.",
    toolUses: 3,
    startedAt: 1000,
    completedAt: 2000,
    lifetimeUsage: { input: 500, output: 500, cacheWrite: 0 },
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AgentMenuDeps> = {}): AgentMenuDeps {
  return {
    manager: {
      listAgents: vi.fn().mockReturnValue([]),
      getRecord: vi.fn(),
      spawnAndWait: vi.fn(),
      getMaxConcurrent: vi.fn().mockReturnValue(4),
      setMaxConcurrent: vi.fn(),
    },
    reloadCustomAgents: vi.fn(),
    agentActivity: new Map(),
    getModelLabel: vi.fn().mockReturnValue("inherit"),
    snapshotSettings: vi.fn().mockReturnValue({
      maxConcurrent: 4,
      defaultMaxTurns: 0,
      graceTurns: 3,
    }),
    saveSettings: vi.fn().mockReturnValue({ message: "Saved", level: "info" }),
    emitEvent: vi.fn(),
    personalAgentsDir: "/home/.pi/agents",
    ...overrides,
  };
}

function makeCtx(selectResults: (string | undefined)[] = []) {
  let selectIdx = 0;
  return {
    ui: {
      select: vi.fn().mockImplementation(() => selectResults[selectIdx++]),
      input: vi.fn(),
      confirm: vi.fn(),
      editor: vi.fn(),
      notify: vi.fn(),
      custom: vi.fn(),
    },
    modelRegistry: {},
  };
}

describe("createAgentsMenuHandler", () => {
  it("returns a handler function", () => {
    const handler = createAgentsMenuHandler(makeDeps());
    expect(typeof handler).toBe("function");
  });

  it("calls reloadCustomAgents on menu open", async () => {
    const deps = makeDeps();
    const ctx = makeCtx([undefined]); // user cancels immediately
    const handler = createAgentsMenuHandler(deps);
    await handler(ctx as any);
    expect(deps.reloadCustomAgents).toHaveBeenCalled();
  });

  it("shows Create new agent option", async () => {
    const deps = makeDeps();
    const ctx = makeCtx([undefined]);
    const handler = createAgentsMenuHandler(deps);
    await handler(ctx as any);
    const selectCall = ctx.ui.select.mock.calls[0];
    expect(selectCall[1]).toContain("Create new agent");
  });

  it("shows Settings option", async () => {
    const deps = makeDeps();
    const ctx = makeCtx([undefined]);
    const handler = createAgentsMenuHandler(deps);
    await handler(ctx as any);
    const selectCall = ctx.ui.select.mock.calls[0];
    expect(selectCall[1]).toContain("Settings");
  });

  it("shows running agents when agents are active", async () => {
    const deps = makeDeps({
      manager: {
        ...makeDeps().manager,
        listAgents: vi.fn().mockReturnValue([
          makeRecord({ status: "running" }),
          makeRecord({ status: "completed", id: "agent-2" }),
        ]),
      },
    });
    const ctx = makeCtx([undefined]);
    const handler = createAgentsMenuHandler(deps);
    await handler(ctx as any);
    const options = ctx.ui.select.mock.calls[0][1] as string[];
    expect(options.some((o: string) => o.startsWith("Running agents ("))).toBe(true);
  });
});

describe("agent menu — settings", () => {
  it("navigates to settings and allows setting max concurrency", async () => {
    const deps = makeDeps();
    const ctx = makeCtx([
      "Settings", // from main menu
      "Max concurrency (current: 4)", // from settings
      undefined, // cancel settings re-show
    ]);
    ctx.ui.input = vi.fn().mockResolvedValue("8");
    const handler = createAgentsMenuHandler(deps);
    await handler(ctx as any);
    expect(deps.manager.setMaxConcurrent).toHaveBeenCalledWith(8);
  });
});
