import { join } from "node:path";
import {
  type ExtensionContext,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

import { DEBUG_LOG_FILENAME, REVIEW_LOG_FILENAME } from "./config-paths";
import { ConfigStore, type RuntimeContextRef } from "./config-store";
import { ensurePermissionSystemLogsDirectory } from "./extension-config";
import { computeExtensionPaths, type ExtensionPaths } from "./extension-paths";

export type { ExtensionPaths } from "./extension-paths";

import { createPermissionSystemLogger } from "./logging";
import { PermissionManager } from "./permission-manager";
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

  // ── Logging (backed by logger created at construction) ─────────────────
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
    permissionManager,
    activeSkillEntries: [],
    lastKnownActiveAgentName: null,
    lastActiveToolsCacheKey: null,
    lastPromptStateCacheKey: null,
    sessionRules: new SessionRules(),
    // Logging methods are replaced below after the logger is constructed.
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

  const configStore = new ConfigStore({
    agentDir,
    context: contextRef,
    policyPaths: permissionManager,
    logger: {
      // Deferred-binding: `runtime.writeDebugLog` is replaced below after
      // the logger is constructed — same deferred pattern as before Step 2.
      writeDebugLog: (e, d) => runtime.writeDebugLog(e, d),
      writeReviewLog: (e, d) => runtime.writeReviewLog(e, d),
    },
  });
  runtime.configStore = configStore;

  const reportedLoggingWarnings = new Set<string>();
  const logger = createPermissionSystemLogger({
    getConfig: () => configStore.current(),
    debugLogPath: join(paths.globalLogsDir, DEBUG_LOG_FILENAME),
    reviewLogPath: join(paths.globalLogsDir, REVIEW_LOG_FILENAME),
    ensureLogsDirectory: () =>
      ensurePermissionSystemLogsDirectory(paths.globalLogsDir),
  });

  const reportLoggingWarning = (message: string): void => {
    if (reportedLoggingWarnings.has(message)) {
      return;
    }
    reportedLoggingWarnings.add(message);
    runtime.runtimeContext?.ui.notify(message, "warning");
  };

  runtime.writeDebugLog = (
    event: string,
    details: Record<string, unknown> = {},
  ): void => {
    const warning = logger.debug(event, details);
    if (warning) {
      reportLoggingWarning(warning);
    }
  };

  runtime.writeReviewLog = (
    event: string,
    details: Record<string, unknown> = {},
  ): void => {
    const warning = logger.review(event, details);
    if (warning) {
      reportLoggingWarning(warning);
    }
  };

  return runtime;
}
