import {
  type ExtensionContext,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

import { ConfigStore, type RuntimeContextRef } from "./config-store";
import { computeExtensionPaths, type ExtensionPaths } from "./extension-paths";

export type { ExtensionPaths } from "./extension-paths";

import { PermissionManager } from "./permission-manager";
import { createSessionLogger, type SessionLogger } from "./session-logger";
import { SessionRules } from "./session-rules";
import type { SkillPromptEntry } from "./skill-prompt-sanitizer";

/**
 * Mutable session state — the subset of ExtensionRuntime that holds
 * per-session fields. `PermissionSession` now owns these for handler
 * use; this interface remains so `ExtensionRuntime` can still serve
 * as the internal composition root (config-modal, RPC handlers).
 */
interface SessionState {
  runtimeContext: ExtensionContext | null;
  permissionManager: PermissionManager;
  readonly sessionRules: SessionRules;
  activeSkillEntries: SkillPromptEntry[];
  lastKnownActiveAgentName: string | null;
  lastActiveToolsCacheKey: string | null;
  lastPromptStateCacheKey: string | null;
}

/**
 * Runtime context object created once inside `piPermissionSystemExtension()`.
 *
 * Holds all path constants (derived from `getAgentDir()` at construction time),
 * mutable extension state, and the log-writing methods — eliminating the
 * module-scope cached constants and setter-injection pattern that previously
 * lived in `src/index.ts`.
 *
 * Tests construct this via `createExtensionRuntime({ agentDir: tmpDir })`
 * without timing issues around `PI_CODING_AGENT_DIR`.
 */
export interface ExtensionRuntime extends ExtensionPaths, SessionState {
  /** The store that owns extension config. */
  configStore: ConfigStore;

  /** The unified log-write + notification surface. */
  logger: SessionLogger;

  // ── Transitional delegators — removed in Step 2 (#336) ────────────────
  writeDebugLog(event: string, details?: Record<string, unknown>): void;
  writeReviewLog(event: string, details?: Record<string, unknown>): void;
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a fully-initialized `ExtensionRuntime`.
 *
 * Calls `getAgentDir()` at invocation time (never at module scope), so tests
 * may set `PI_CODING_AGENT_DIR` before calling the factory.
 */
export function createExtensionRuntime(options?: {
  agentDir?: string;
}): ExtensionRuntime {
  const agentDir = options?.agentDir ?? getAgentDir();
  const paths = computeExtensionPaths(agentDir);

  const permissionManager = new PermissionManager({ agentDir });

  const runtime: ExtensionRuntime = {
    ...paths,
    runtimeContext: null,
    configStore: null as unknown as ConfigStore,
    logger: null as unknown as SessionLogger,
    permissionManager,
    activeSkillEntries: [],
    lastKnownActiveAgentName: null,
    lastActiveToolsCacheKey: null,
    lastPromptStateCacheKey: null,
    sessionRules: new SessionRules(),
    // Transitional delegators — assigned below after the logger is constructed.
    writeDebugLog: () => {},
    writeReviewLog: () => {},
  };

  // Transitional RuntimeContextRef: reads/writes the still-runtime-owned
  // `runtimeContext` field until Step 4 (#337) unifies context onto
  // PermissionSession.
  const contextRef: RuntimeContextRef = {
    get: () => runtime.runtimeContext,
    set: (ctx) => {
      runtime.runtimeContext = ctx;
    },
  };

  // `configStore` is declared before the logger so the logger's getConfig
  // thunk can close over the variable; it is assigned immediately after.
  // Initialized to a placeholder so `prefer-const` does not misfire (two assignments).
  let configStore = null as unknown as ConfigStore;

  const logger = createSessionLogger({
    globalLogsDir: paths.globalLogsDir,
    getConfig: () => configStore.current(),
    notify: (message) => runtime.runtimeContext?.ui.notify(message, "warning"),
  });

  configStore = new ConfigStore({
    agentDir,
    context: contextRef,
    policyPaths: permissionManager,
    logger: {
      writeDebugLog: (e, d) => logger.debug(e, d),
      writeReviewLog: (e, d) => logger.review(e, d),
    },
  });

  runtime.configStore = configStore;
  runtime.logger = logger;
  runtime.writeDebugLog = (event, details) => logger.debug(event, details);
  runtime.writeReviewLog = (event, details) => logger.review(event, details);

  return runtime;
}
