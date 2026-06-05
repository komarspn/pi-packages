import { join } from "node:path";
import {
  type ExtensionCommandContext,
  type ExtensionContext,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

import { DEBUG_LOG_FILENAME, REVIEW_LOG_FILENAME } from "./config-paths";
import { ConfigStore, type RuntimeContextRef } from "./config-store";
import {
  ensurePermissionSystemLogsDirectory,
  type PermissionSystemExtensionConfig,
} from "./extension-config";
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
  // ── Config (owned by ConfigStore) ─────────────────────────────────────────
  /** The store that owns extension config. Step 2 (#335). */
  configStore: ConfigStore;
  /**
   * Temporary read-only bridge to `configStore.current()`.
   * Consumers migrate to `configStore.current()` in Steps 3-5; removed in Step 6 (#335).
   */
  readonly config: PermissionSystemExtensionConfig;

  // ── Logging (backed by logger created at construction) ─────────────────
  writeDebugLog(event: string, details?: Record<string, unknown>): void;
  writeReviewLog(event: string, details?: Record<string, unknown>): void;
}

/**
 * Reload merged config from disk into the runtime.
 * If `ctx` is provided, updates `runtime.runtimeContext` first.
 *
 * Thin delegator to `runtime.configStore.refresh(ctx?)` — removed once all
 * consumers migrate in Step 6 of #335.
 */
export function refreshExtensionConfig(
  runtime: ExtensionRuntime,
  ctx?: ExtensionContext,
): void {
  runtime.configStore.refresh(ctx);
}

/**
 * Save updated runtime knobs (debugLog, permissionReviewLog, yoloMode) to the
 * global config file, then update the config and sync UI status.
 *
 * Thin delegator to `runtime.configStore.save(next, ctx)` — removed once all
 * consumers migrate in Step 6 of #335.
 */
export function saveExtensionConfig(
  runtime: ExtensionRuntime,
  next: PermissionSystemExtensionConfig,
  ctx: ExtensionCommandContext,
): void {
  runtime.configStore.save(next, ctx);
}

/**
 * Write the resolved config path set (global, project, legacy) to the review
 * and debug logs.
 *
 * Thin delegator to `runtime.configStore.logResolvedPaths()` — removed once all
 * consumers migrate in Step 6 of #335.
 */
export function logResolvedConfigPaths(runtime: ExtensionRuntime): void {
  runtime.configStore.logResolvedPaths();
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

  // Build the base object without `config` — the getter is added below.
  const runtimeBase = {
    ...paths,
    runtimeContext: null as ExtensionContext | null,
    configStore: null as unknown as ConfigStore,
    permissionManager,
    activeSkillEntries: [] as SkillPromptEntry[],
    lastKnownActiveAgentName: null as string | null,
    lastActiveToolsCacheKey: null as string | null,
    lastPromptStateCacheKey: null as string | null,
    sessionRules: new SessionRules(),
    // Logging methods are replaced below after the logger is constructed.
    writeDebugLog: (
      _event: string,
      _details: Record<string, unknown> = {},
    ) => {},
    writeReviewLog: (
      _event: string,
      _details: Record<string, unknown> = {},
    ) => {},
  };

  // Transitional RuntimeContextRef: reads/writes the still-runtime-owned
  // `runtimeContext` field until Step 4 (#337) unifies context onto
  // PermissionSession.
  const contextRef: RuntimeContextRef = {
    get: () => runtimeBase.runtimeContext,
    set: (ctx) => {
      runtimeBase.runtimeContext = ctx;
    },
  };

  const configStore = new ConfigStore({
    agentDir,
    context: contextRef,
    policyPaths: permissionManager,
    logger: {
      // Deferred-binding: `runtimeBase.writeDebugLog` is replaced below
      // after the logger is constructed — same pattern as before this step.
      writeDebugLog: (e, d) => runtimeBase.writeDebugLog(e, d),
      writeReviewLog: (e, d) => runtimeBase.writeReviewLog(e, d),
    },
  });
  runtimeBase.configStore = configStore;

  // Add `config` as a getter bridge so index.ts consumers (`() => runtime.config`)
  // transparently read from the store until they migrate in Steps 3-5.
  const runtime = Object.defineProperty(runtimeBase, "config", {
    get: () => configStore.current(),
    enumerable: true,
    configurable: true,
  }) as ExtensionRuntime;

  const reportedLoggingWarnings = new Set<string>();
  const logger = createPermissionSystemLogger({
    // Reads from ConfigStore at call time — always current.
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
    // Reads runtime.runtimeContext at call time — always current.
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
