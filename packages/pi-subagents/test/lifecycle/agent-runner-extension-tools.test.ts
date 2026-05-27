/**
 * Patch 2 (RepOne #443): re-filter active tools after bindExtensions.
 *
 * Extension-registered tools (added during `session.bindExtensions(...)`) are
 * not in the session's active tool set when the initial filter pass runs.
 * Without a post-bind re-filter, `EXCLUDED_TOOL_NAMES` (recursion guard) would
 * not be applied to extension-registered tools.
 *
 * This file simulates that flow by having `getActiveToolNames` return a small
 * built-in set before `bindExtensions` and a larger set including extension
 * tools after, then asserts that the final `setActiveToolsByName` call (the
 * post-bind re-filter) honors the agent's `extensions` config against the
 * post-bind world.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "#src/lifecycle/agent-runner";
import { createRunnerIO } from "#test/helpers/runner-io";
import { STUB_SNAPSHOT } from "#test/helpers/stub-ctx";

const agentConfigMock = {
  current: {
    name: "test-agent",
    description: "Test agent",
    builtinToolNames: ["read"],
    extensions: true,
    skills: false,
    systemPrompt: "You are a test agent.",
    promptMode: "replace",
    inheritContext: false,
    runInBackground: false,
    isolated: false,
  },
};

/** Mock AgentConfigLookup injected via RunOptions.registry. */
const mockAgentLookup = {
  resolveAgentConfig: vi.fn((): import("#src/types").AgentConfig => ({
    ...agentConfigMock.current,
    promptMode: agentConfigMock.current.promptMode as "replace" | "append",
  })),
  getToolNamesForType: vi.fn((): string[] => agentConfigMock.current.builtinToolNames ?? ["read"]), // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- builtinToolNames is always defined in type but may be absent at runtime
};

let io: ReturnType<typeof createRunnerIO>;

/**
 * Build a mock session where `getActiveToolNames` returns one set before
 * `bindExtensions` is called and another set after.
 *
 * @param beforeBind  Tools active before bindExtensions (built-in only).
 * @param afterBind   Tools active after bindExtensions (built-in + extension).
 */
function createSessionWithExtensionToolRegistration(
  beforeBind: string[],
  afterBind: string[],
) {
  let bound = false;
  const session = {
    messages: [] as unknown[],
    subscribe: vi.fn(() => () => {}),
    prompt: vi.fn(async () => {
      session.messages.push({
        role: "assistant",
        content: [{ type: "text", text: "DONE" }],
      });
    }),
    abort: vi.fn(),
    steer: vi.fn(),
    getActiveToolNames: vi.fn(() => (bound ? afterBind : beforeBind)),
    setActiveToolsByName: vi.fn(),
    bindExtensions: vi.fn(async () => {
      bound = true;
    }),
  };
  return session;
}

const exec = vi.fn();

beforeEach(() => {
  io = createRunnerIO();
  // Reset agent config to defaults
  agentConfigMock.current = {
    name: "test-agent",
    description: "Test agent",
    builtinToolNames: ["read"],
    extensions: true,
    skills: false,
    systemPrompt: "You are a test agent.",
    promptMode: "replace",
    inheritContext: false,
    runInBackground: false,
    isolated: false,
  };
});

describe("Patch 2: post-bind active-tool re-filter", () => {
  it("setActiveToolsByName is called both before and after bindExtensions", async () => {
    const session = createSessionWithExtensionToolRegistration(
      ["read"],
      ["read", "extension_tool"],
    );
    io.createSession.mockResolvedValue({ session });

    await runAgent(STUB_SNAPSHOT, "test-agent", "go", { context: { exec, registry: mockAgentLookup } }, io);

    // Should be called twice: once before bind, once after.
    expect(session.setActiveToolsByName).toHaveBeenCalledTimes(2);

    const bindOrder = session.bindExtensions.mock.invocationCallOrder[0];
    const firstSetOrder =
      session.setActiveToolsByName.mock.invocationCallOrder[0];
    const secondSetOrder =
      session.setActiveToolsByName.mock.invocationCallOrder[1];

    // First set is before bind, second is after.
    expect(firstSetOrder).toBeLessThan(bindOrder);
    expect(secondSetOrder).toBeGreaterThan(bindOrder);
  });

  it("post-bind re-filter includes extension tool when extensions: true", async () => {
    agentConfigMock.current.extensions = true;
    const session = createSessionWithExtensionToolRegistration(
      ["read"],
      ["read", "extension_tool"],
    );
    io.createSession.mockResolvedValue({ session });

    await runAgent(STUB_SNAPSHOT, "test-agent", "go", { context: { exec, registry: mockAgentLookup } }, io);

    // Second (post-bind) call is the re-filter; it should include the
    // extension-registered tool since extensions: true allows everything.
    const secondCallArgs = session.setActiveToolsByName.mock.calls[1][0];
    expect(secondCallArgs).toContain("read");
    expect(secondCallArgs).toContain("extension_tool");
  });

  it("post-bind re-filter excludes our own tools (EXCLUDED_TOOL_NAMES) even when extensions: true", async () => {
    agentConfigMock.current.extensions = true;
    const session = createSessionWithExtensionToolRegistration(
      ["read"],
      ["read", "Agent", "get_subagent_result", "steer_subagent", "external"],
    );
    io.createSession.mockResolvedValue({ session });

    await runAgent(STUB_SNAPSHOT, "test-agent", "go", { context: { exec, registry: mockAgentLookup } }, io);

    const postBindArgs = session.setActiveToolsByName.mock.calls[1][0];
    expect(postBindArgs).toContain("read");
    expect(postBindArgs).toContain("external");
    // Our own subagent-dispatch tools must never reach children.
    expect(postBindArgs).not.toContain("Agent");
    expect(postBindArgs).not.toContain("get_subagent_result");
    expect(postBindArgs).not.toContain("steer_subagent");
  });

  it("extensions: false skips the filter entirely (setActiveToolsByName not called)", async () => {
    // When extensions: false, there is no filtering to apply — neither the
    // pre-bind nor post-bind setActiveToolsByName should fire.
    agentConfigMock.current.extensions = false;
    const session = createSessionWithExtensionToolRegistration(
      ["read"],
      ["read"],
    );
    io.createSession.mockResolvedValue({ session });

    await runAgent(STUB_SNAPSHOT, "test-agent", "go", { context: { exec, registry: mockAgentLookup } }, io);

    expect(session.setActiveToolsByName).not.toHaveBeenCalled();
  });
});
