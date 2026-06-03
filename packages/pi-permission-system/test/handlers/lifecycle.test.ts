import { describe, expect, it, vi } from "vitest";

import { SessionLifecycleHandler } from "#src/handlers/lifecycle";
import type { ServiceLifecycle } from "#src/service-lifecycle";
import type { SessionLifecycleSession } from "#src/session-lifecycle-session";

import { makeCtx } from "#test/helpers/handler-fixtures";

// ── status stub ────────────────────────────────────────────────────────────
vi.mock("../../src/status", () => ({
  PERMISSION_SYSTEM_STATUS_KEY: "permission-system",
  syncPermissionSystemStatus: vi.fn(),
  getPermissionSystemStatus: vi.fn(),
}));

// ── helpers ────────────────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<SessionLifecycleSession> = {},
): SessionLifecycleSession {
  return {
    logger: overrides.logger ?? {
      debug: vi.fn<SessionLifecycleSession["logger"]["debug"]>(),
      review: vi.fn<SessionLifecycleSession["logger"]["review"]>(),
      warn: vi.fn<SessionLifecycleSession["logger"]["warn"]>(),
    },
    refreshConfig:
      overrides.refreshConfig ??
      vi.fn<SessionLifecycleSession["refreshConfig"]>(),
    resetForNewSession:
      overrides.resetForNewSession ??
      vi.fn<SessionLifecycleSession["resetForNewSession"]>(),
    logResolvedConfigPaths:
      overrides.logResolvedConfigPaths ??
      vi.fn<SessionLifecycleSession["logResolvedConfigPaths"]>(),
    resolveAgentName:
      overrides.resolveAgentName ??
      vi
        .fn<SessionLifecycleSession["resolveAgentName"]>()
        .mockReturnValue(null),
    getConfigIssues:
      overrides.getConfigIssues ??
      vi.fn<SessionLifecycleSession["getConfigIssues"]>().mockReturnValue([]),
    reload: overrides.reload ?? vi.fn<SessionLifecycleSession["reload"]>(),
    getRuntimeContext:
      overrides.getRuntimeContext ??
      vi
        .fn<SessionLifecycleSession["getRuntimeContext"]>()
        .mockReturnValue(null),
    shutdown:
      overrides.shutdown ?? vi.fn<SessionLifecycleSession["shutdown"]>(),
  };
}

function makeHandler(overrides?: Partial<SessionLifecycleSession>): {
  handler: SessionLifecycleHandler;
  session: SessionLifecycleSession;
  serviceLifecycle: ServiceLifecycle;
} {
  const session = makeSession(overrides);
  const serviceLifecycle: ServiceLifecycle = {
    activate: vi.fn<ServiceLifecycle["activate"]>(),
    teardown: vi.fn<ServiceLifecycle["teardown"]>(),
  };
  const handler = new SessionLifecycleHandler(session, serviceLifecycle);
  return { handler, session, serviceLifecycle };
}

// ── handleSessionStart ─────────────────────────────────────────────────────

describe("handleSessionStart", () => {
  it("refreshes config with ctx", async () => {
    const ctx = makeCtx();
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, ctx);
    expect(session.refreshConfig).toHaveBeenCalledWith(ctx);
  });

  it("calls resetForNewSession with ctx", async () => {
    const ctx = makeCtx();
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, ctx);
    expect(session.resetForNewSession).toHaveBeenCalledWith(ctx);
  });

  it("logs resolved config paths", async () => {
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, makeCtx());
    expect(session.logResolvedConfigPaths).toHaveBeenCalledOnce();
  });

  it("resolves agent name from ctx", async () => {
    const ctx = makeCtx();
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, ctx);
    expect(session.resolveAgentName).toHaveBeenCalledWith(ctx);
  });

  it("notifies each policy issue", async () => {
    const { handler, session } = makeHandler({
      getConfigIssues: vi.fn().mockReturnValue(["issue A", "issue B"]),
    });
    await handler.handleSessionStart({ reason: "startup" }, makeCtx());
    expect(session.logger.warn).toHaveBeenCalledWith("issue A");
    expect(session.logger.warn).toHaveBeenCalledWith("issue B");
  });

  it("does not warn when there are no policy issues", async () => {
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, makeCtx());
    expect(session.logger.warn).not.toHaveBeenCalled();
  });

  it("writes lifecycle.reload debug log when reason is reload", async () => {
    const ctx = makeCtx({ cwd: "/proj" });
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "reload" }, ctx);
    expect(session.logger.debug).toHaveBeenCalledWith("lifecycle.reload", {
      triggeredBy: "session_start",
      reason: "reload",
      cwd: "/proj",
    });
  });

  it("does not write lifecycle.reload debug log for non-reload reasons", async () => {
    const { handler, session } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, makeCtx());
    expect(session.logger.debug).not.toHaveBeenCalled();
  });

  it("activates the service for the session with ctx", async () => {
    const ctx = makeCtx();
    const { handler, serviceLifecycle } = makeHandler();
    await handler.handleSessionStart({ reason: "startup" }, ctx);
    expect(serviceLifecycle.activate).toHaveBeenCalledWith(ctx);
  });

  it("calls refreshConfig before resetForNewSession", async () => {
    const callOrder: string[] = [];
    const { handler } = makeHandler({
      refreshConfig: vi.fn(() => callOrder.push("refreshConfig")),
      resetForNewSession: vi.fn(() => callOrder.push("resetForNewSession")),
    });
    await handler.handleSessionStart({ reason: "startup" }, makeCtx());
    expect(callOrder).toEqual(["refreshConfig", "resetForNewSession"]);
  });
});

// ── handleResourcesDiscover ────────────────────────────────────────────────

describe("handleResourcesDiscover", () => {
  it("does nothing when reason is not reload", async () => {
    const { handler, session } = makeHandler();
    await handler.handleResourcesDiscover({ reason: "startup" });
    expect(session.reload).not.toHaveBeenCalled();
  });

  it("calls reload on the session on reload", async () => {
    const { handler, session } = makeHandler();
    await handler.handleResourcesDiscover({ reason: "reload" });
    expect(session.reload).toHaveBeenCalledOnce();
  });

  it("writes lifecycle.reload debug log on reload", async () => {
    const ctx = makeCtx({ cwd: "/proj" });
    const { handler, session } = makeHandler({
      getRuntimeContext: vi.fn().mockReturnValue(ctx),
    });
    await handler.handleResourcesDiscover({ reason: "reload" });
    expect(session.logger.debug).toHaveBeenCalledWith("lifecycle.reload", {
      triggeredBy: "resources_discover",
      reason: "reload",
      cwd: "/proj",
    });
  });

  it("logs cwd as null when runtimeContext is null on reload", async () => {
    const { handler, session } = makeHandler();
    await handler.handleResourcesDiscover({ reason: "reload" });
    expect(session.logger.debug).toHaveBeenCalledWith("lifecycle.reload", {
      triggeredBy: "resources_discover",
      reason: "reload",
      cwd: null,
    });
  });
});

// ── handleSessionShutdown ──────────────────────────────────────────────────

describe("handleSessionShutdown", () => {
  it("clears UI status when runtime context is present", async () => {
    const ctx = makeCtx();
    const { handler } = makeHandler({
      getRuntimeContext: vi.fn().mockReturnValue(ctx),
    });
    await handler.handleSessionShutdown();
    expect(ctx.ui.setStatus).toHaveBeenCalledWith(
      "permission-system",
      undefined,
    );
  });

  it("does not throw when runtime context is null", async () => {
    const { handler } = makeHandler();
    await expect(handler.handleSessionShutdown()).resolves.not.toThrow();
  });

  it("calls shutdown on the session", async () => {
    const { handler, session } = makeHandler();
    await handler.handleSessionShutdown();
    expect(session.shutdown).toHaveBeenCalledOnce();
  });

  it("calls serviceLifecycle.teardown", async () => {
    const { handler, serviceLifecycle } = makeHandler();
    await handler.handleSessionShutdown();
    expect(serviceLifecycle.teardown).toHaveBeenCalledOnce();
  });
});
