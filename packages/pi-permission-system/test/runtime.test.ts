import { beforeEach, describe, expect, it, vi } from "vitest";

// ── logger stub ────────────────────────────────────────────────────────────
const {
  mockLoggerDebug,
  mockLoggerReview,
  mockLoggerWarn,
  mockCreateLogger,
  mockDiscoverGlobalNodeModulesRoot,
} = vi.hoisted(() => ({
  mockLoggerDebug:
    vi.fn<(event: string, details?: Record<string, unknown>) => void>(),
  mockLoggerReview:
    vi.fn<(event: string, details?: Record<string, unknown>) => void>(),
  mockLoggerWarn: vi.fn<(message: string) => void>(),
  mockCreateLogger: vi.fn(),
  mockDiscoverGlobalNodeModulesRoot: vi.fn<() => string | null>(),
}));

vi.mock("../src/session-logger", () => ({
  createSessionLogger: mockCreateLogger,
}));

vi.mock("../src/permission-manager", () => ({
  PermissionManager: vi.fn(),
}));

vi.mock("../src/subagent-context", () => ({
  isSubagentExecutionContext: vi.fn().mockReturnValue(false),
}));

vi.mock("../src/node-modules-discovery", () => ({
  discoverGlobalNodeModulesRoot: mockDiscoverGlobalNodeModulesRoot,
}));

vi.mock("../src/session-rules", () => ({
  SessionRules: vi.fn(),
  deriveApprovalPattern: vi.fn(),
}));

import { getGlobalLogsDir } from "#src/config-paths";
import { DEFAULT_EXTENSION_CONFIG } from "#src/extension-config";
import { createExtensionRuntime } from "#src/runtime";

// ── test suite ─────────────────────────────────────────────────────────────

describe("createExtensionRuntime", () => {
  beforeEach(() => {
    mockLoggerDebug.mockReset();
    mockLoggerReview.mockReset();
    mockLoggerWarn.mockReset();
    mockCreateLogger.mockReset();
    mockCreateLogger.mockReturnValue({
      debug: mockLoggerDebug,
      review: mockLoggerReview,
      warn: mockLoggerWarn,
    });
    mockDiscoverGlobalNodeModulesRoot.mockReset();
    mockDiscoverGlobalNodeModulesRoot.mockReturnValue(
      "/mock/global/node_modules",
    );
  });

  // ── Path derivation ──────────────────────────────────────────────────────

  it("sets agentDir from provided option", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.agentDir).toBe("/test/agent");
  });

  it("derives sessionsDir from agentDir", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.sessionsDir).toBe("/test/agent/sessions");
  });

  it("derives subagentSessionsDir from agentDir", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.subagentSessionsDir).toBe("/test/agent/subagent-sessions");
  });

  it("derives forwardingDir as sessions/permission-forwarding", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.forwardingDir).toBe(
      "/test/agent/sessions/permission-forwarding",
    );
  });

  it("derives globalLogsDir via getGlobalLogsDir", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.globalLogsDir).toBe(getGlobalLogsDir("/test/agent"));
  });

  // ── piInfrastructureDirs ─────────────────────────────────────────────────

  it("includes agentDir in piInfrastructureDirs", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.piInfrastructureDirs).toContain("/test/agent");
  });

  it("includes agentDir/git in piInfrastructureDirs", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.piInfrastructureDirs).toContain("/test/agent/git");
  });

  it("includes discovered global node_modules root in piInfrastructureDirs", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.piInfrastructureDirs).toContain("/mock/global/node_modules");
  });

  it("excludes null when discoverGlobalNodeModulesRoot returns null", () => {
    mockDiscoverGlobalNodeModulesRoot.mockReturnValue(null);
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    for (const dir of runtime.piInfrastructureDirs) {
      expect(dir).not.toBeNull();
      expect(typeof dir).toBe("string");
    }
  });

  it("omits global node_modules from piInfrastructureDirs when discovery returns null", () => {
    mockDiscoverGlobalNodeModulesRoot.mockReturnValue(null);
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    // Only agentDir and agentDir/git should be present.
    expect(runtime.piInfrastructureDirs).toHaveLength(2);
    expect(runtime.piInfrastructureDirs).toContain("/test/agent");
    expect(runtime.piInfrastructureDirs).toContain("/test/agent/git");
  });

  // ── Default mutable state ────────────────────────────────────────────────

  it("initializes configStore.current() to DEFAULT_EXTENSION_CONFIG", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.configStore.current()).toEqual(DEFAULT_EXTENSION_CONFIG);
  });

  it("initializes runtimeContext to null", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.runtimeContext).toBeNull();
  });

  it("initializes activeSkillEntries to empty array", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.activeSkillEntries).toEqual([]);
  });

  it("initializes lastKnownActiveAgentName to null", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.lastKnownActiveAgentName).toBeNull();
  });

  it("initializes lastActiveToolsCacheKey to null", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.lastActiveToolsCacheKey).toBeNull();
  });

  it("initializes lastPromptStateCacheKey to null", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.lastPromptStateCacheKey).toBeNull();
  });

  it("creates a sessionRules instance", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.sessionRules).toBeDefined();
  });

  // ── Mutable state is writable ──────────────────────────────────────────

  it("allows runtimeContext to be updated", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    const mockCtx = { hasUI: false } as never;
    runtime.runtimeContext = mockCtx;
    expect(runtime.runtimeContext).toBe(mockCtx);
  });

  // ── Logger construction ───────────────────────────────────────────────────

  it("creates the logger with globalLogsDir derived from agentDir", () => {
    const agentDir = "/test/agent";
    const expectedLogsDir = getGlobalLogsDir(agentDir);
    createExtensionRuntime({ agentDir });
    expect(mockCreateLogger).toHaveBeenCalledOnce();
    const opts = mockCreateLogger.mock.calls[0][0] as { globalLogsDir: string };
    expect(opts.globalLogsDir).toBe(expectedLogsDir);
  });

  it("passes getConfig that reads from configStore.current()", () => {
    createExtensionRuntime({ agentDir: "/test/agent" });
    const opts = mockCreateLogger.mock.calls[0][0] as {
      getConfig: () => typeof DEFAULT_EXTENSION_CONFIG;
    };
    // getConfig() reads from configStore.current() — DEFAULT_EXTENSION_CONFIG at startup
    expect(opts.getConfig()).toEqual(DEFAULT_EXTENSION_CONFIG);
  });

  it("exposes the SessionLogger as runtime.logger", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    expect(runtime.logger.debug).toBe(mockLoggerDebug);
    expect(runtime.logger.review).toBe(mockLoggerReview);
  });

  // ── writeDebugLog / writeReviewLog delegate to logger ────────────────────

  it("writeDebugLog delegates to logger.debug with event and details", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    runtime.writeDebugLog("test.event", { key: "value" });
    expect(mockLoggerDebug).toHaveBeenCalledWith("test.event", {
      key: "value",
    });
  });

  it("writeDebugLog passes undefined details when none provided", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    runtime.writeDebugLog("test.event");
    expect(mockLoggerDebug).toHaveBeenCalledWith("test.event", undefined);
  });

  it("writeReviewLog delegates to logger.review with event and details", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    runtime.writeReviewLog("test.event", { key: "value" });
    expect(mockLoggerReview).toHaveBeenCalledWith("test.event", {
      key: "value",
    });
  });

  it("writeReviewLog passes undefined details when none provided", () => {
    const runtime = createExtensionRuntime({ agentDir: "/test/agent" });
    runtime.writeReviewLog("test.event");
    expect(mockLoggerReview).toHaveBeenCalledWith("test.event", undefined);
  });

  // ── Multiple independent runtimes ─────────────────────────────────────────

  it("two runtimes have independent state", () => {
    const rt1 = createExtensionRuntime({ agentDir: "/agent/a" });
    const rt2 = createExtensionRuntime({ agentDir: "/agent/b" });
    rt1.lastKnownActiveAgentName = "agent-a";
    expect(rt2.lastKnownActiveAgentName).toBeNull();
  });
});

// refreshExtensionConfig / saveExtensionConfig / logResolvedConfigPaths are
// thin delegators to runtime.configStore — behavior covered in config-store.test.ts.

// resolveAgentName was moved to PermissionSession (#129)
// Tests live in test/permission-session.test.ts
