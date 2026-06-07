import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  getActiveAgentName,
  getActiveAgentNameFromSystemPrompt,
} from "./active-agent";
import type { AgentPrepSession } from "./agent-prep-session";
import type { SessionConfigStore } from "./config-store";
import type { PermissionSystemExtensionConfig } from "./extension-config";
import type { ExtensionPaths } from "./extension-paths";
import type { ForwardingController } from "./forwarding-manager";
import type { GateHandlerSession } from "./gate-handler-session";
import type { GatePrompter } from "./gate-prompter";
import type { PermissionPromptDecision } from "./permission-dialog";
import type { ScopedPermissionManager } from "./permission-manager";
import type {
  PermissionPrompterApi,
  PromptPermissionDetails,
} from "./permission-prompter";
import type { PermissionResolver } from "./permission-resolver";
import type { Rule } from "./rule";
import type { SessionApproval } from "./session-approval";
import type { SessionApprovalRecorder } from "./session-approval-recorder";
import type { SessionLifecycleSession } from "./session-lifecycle-session";
import type { SessionLogger } from "./session-logger";
import type { SessionRules } from "./session-rules";
import type { SkillPromptEntry } from "./skill-prompt-sanitizer";
import {
  resolveToolPreviewLimits,
  type ToolPreviewFormatterOptions,
} from "./tool-preview-formatter";
import type { PermissionCheckResult, PermissionState } from "./types";

/**
 * Runtime operations that `PermissionSession` delegates to but does not own.
 *
 * Injected at construction time from the composition root (`index.ts`).
 */
export interface PermissionSessionRuntimeDeps {
  /** Whether the current context can show an interactive permission prompt. */
  canRequestPermissionConfirmation(ctx: ExtensionContext): boolean;
  /** Resolves the permission decision via the shared PermissionPrompter. */
  prompter: PermissionPrompterApi;
}

/**
 * Encapsulates all mutable session state and exposes operations instead of
 * fields.
 *
 * Replaces the `SessionState` interface + scattered handler field mutations
 * with a single class that owns the `PermissionManager`, `SessionRules`,
 * cache keys, skill entries, and runtime context.
 *
 * Constructor deps:
 * - `ExtensionPaths` — immutable path constants
 * - `SessionLogger` — debug + review + warn
 * - `ForwardingController` — polling lifecycle
 * - `SessionConfigStore` — owns extension config; provides refresh, log, read
 * - `PermissionSessionRuntimeDeps` — prompting + permission-confirmation bridge
 */
export class PermissionSession
  implements
    PermissionResolver,
    SessionApprovalRecorder,
    GatePrompter,
    GateHandlerSession,
    AgentPrepSession,
    SessionLifecycleSession
{
  private context: ExtensionContext | null = null;
  private skillEntries: SkillPromptEntry[] = [];
  private knownAgentName: string | null = null;
  private toolsCacheKey: string | null = null;
  private promptCacheKey: string | null = null;

  constructor(
    private readonly paths: ExtensionPaths,
    readonly logger: SessionLogger,
    private readonly forwarding: ForwardingController,
    private readonly permissionManager: ScopedPermissionManager,
    private readonly sessionRules: SessionRules,
    private readonly configStore: SessionConfigStore,
    private readonly runtimeDeps: PermissionSessionRuntimeDeps,
  ) {}

  // ── Context lifecycle ──────────────────────────────────────────────────

  /** Store the current extension context and start forwarding. */
  activate(ctx: ExtensionContext): void {
    this.context = ctx;
    this.forwarding.start(ctx);
  }

  /** Clear the context and stop forwarding. */
  deactivate(): void {
    this.context = null;
    this.forwarding.stop();
  }

  /** Return the current runtime context, or null if not activated. */
  getRuntimeContext(): ExtensionContext | null {
    return this.context;
  }

  // ── Permission checking (delegates to PermissionManager) ───────────────

  checkPermission(
    surface: string,
    input: unknown,
    agentName?: string,
    sessionRules?: Rule[],
  ): PermissionCheckResult {
    return this.permissionManager.checkPermission(
      surface,
      input,
      agentName,
      sessionRules,
    );
  }

  /**
   * Resolve the effective permission for a surface/input, applying the current
   * session rules. Composes `checkPermission` with `getSessionRuleset` so
   * callers never thread the ruleset by hand.
   */
  resolve(
    surface: string,
    input: unknown,
    agentName?: string,
  ): PermissionCheckResult {
    return this.checkPermission(
      surface,
      input,
      agentName,
      this.getSessionRuleset(),
    );
  }

  getToolPermission(toolName: string, agentName?: string): PermissionState {
    return this.permissionManager.getToolPermission(toolName, agentName);
  }

  getConfigIssues(agentName?: string): string[] {
    return this.permissionManager.getConfigIssues(agentName);
  }

  getPolicyCacheStamp(agentName?: string): string {
    return this.permissionManager.getPolicyCacheStamp(agentName);
  }

  // ── Session rules (delegates to SessionRules) ──────────────────────────

  getSessionRuleset(): Rule[] {
    return this.sessionRules.getRuleset();
  }

  recordSessionApproval(approval: SessionApproval): void {
    this.sessionRules.record(approval);
  }

  // ── Session lifecycle ────────────────────────────────────────────────────

  /**
   * Reset all mutable state for a new session.
   *
   * Configures the injected PermissionManager for `ctx.cwd`, clears caches,
   * skill entries, and activates the new context.
   */
  resetForNewSession(ctx: ExtensionContext): void {
    this.permissionManager.configureForCwd(ctx.cwd);
    this.skillEntries = [];
    this.toolsCacheKey = null;
    this.promptCacheKey = null;
    this.activate(ctx);
  }

  /**
   * Shut down the session: clear rules, caches, skill entries, and
   * deactivate context + forwarding.
   */
  shutdown(): void {
    this.sessionRules.clear();
    this.skillEntries = [];
    this.toolsCacheKey = null;
    this.promptCacheKey = null;
    this.deactivate();
  }

  /**
   * Reload permission manager and clear caches for the current context.
   * Used on config reload (e.g. `resources_discover` with reason "reload").
   */
  reload(): void {
    this.permissionManager.configureForCwd(this.context?.cwd);
    this.skillEntries = [];
    this.toolsCacheKey = null;
    this.promptCacheKey = null;
  }

  // ── Agent-start caching ────────────────────────────────────────────────

  shouldUpdateActiveTools(cacheKey: string): boolean {
    return this.toolsCacheKey !== cacheKey;
  }

  commitActiveToolsCacheKey(cacheKey: string): void {
    this.toolsCacheKey = cacheKey;
  }

  shouldUpdatePromptState(cacheKey: string): boolean {
    return this.promptCacheKey !== cacheKey;
  }

  commitPromptStateCacheKey(cacheKey: string): void {
    this.promptCacheKey = cacheKey;
  }

  // ── Skill entries ──────────────────────────────────────────────────────

  getActiveSkillEntries(): SkillPromptEntry[] {
    return this.skillEntries;
  }

  setActiveSkillEntries(entries: SkillPromptEntry[]): void {
    this.skillEntries = entries;
  }

  // ── Agent name ─────────────────────────────────────────────────────────

  /**
   * Resolve the active agent name from the session context, system prompt,
   * or last known name. Updates lastKnownActiveAgentName as a side effect.
   */
  resolveAgentName(
    ctx: ExtensionContext,
    systemPrompt?: string,
  ): string | null {
    const fromSession = getActiveAgentName(ctx);
    if (fromSession) {
      this.knownAgentName = fromSession;
      return fromSession;
    }
    const fromSystemPrompt = getActiveAgentNameFromSystemPrompt(systemPrompt);
    if (fromSystemPrompt) {
      this.knownAgentName = fromSystemPrompt;
      return fromSystemPrompt;
    }
    return this.knownAgentName;
  }

  get lastKnownActiveAgentName(): string | null {
    return this.knownAgentName;
  }

  // ── Config ─────────────────────────────────────────────────────────────

  /** Reload merged config from disk; optionally update the stored runtime context. */
  refreshConfig(ctx?: ExtensionContext): void {
    this.configStore.refresh(ctx);
  }

  /** Write the resolved config path set to the review and debug logs. */
  logResolvedConfigPaths(): void {
    this.configStore.logResolvedPaths(this.context?.cwd);
  }

  /** Read current extension config. */
  get config(): PermissionSystemExtensionConfig {
    return this.configStore.current();
  }

  // ── Infrastructure paths ───────────────────────────────────────────────

  /**
   * Combined infrastructure read directories: static paths from
   * `ExtensionPaths` plus config-derived paths.
   */
  getInfrastructureReadDirs(): string[] {
    return [
      ...this.paths.piInfrastructureDirs,
      ...(this.config.piInfrastructureReadPaths ?? []),
    ];
  }

  /**
   * Resolved tool-preview formatter options from the current config.
   *
   * Replaces the handler's `resolveToolPreviewLimits(session.config)` reach
   * so the pipeline reads a clean value rather than pulling raw config.
   */
  getToolPreviewLimits(): ToolPreviewFormatterOptions {
    return resolveToolPreviewLimits(this.config);
  }

  // ── Prompting ──────────────────────────────────────────────────────────

  /** Whether the current context can show an interactive permission prompt. */
  canPrompt(ctx: ExtensionContext): boolean {
    return this.runtimeDeps.canRequestPermissionConfirmation(ctx);
  }

  /** Prompt the user for a permission decision, log the outcome, and return it. */
  prompt(
    ctx: ExtensionContext,
    details: PromptPermissionDetails,
  ): Promise<PermissionPromptDecision> {
    return this.runtimeDeps.prompter.prompt(ctx, details);
  }

  /**
   * Whether an interactive confirmation is possible using the stored context.
   * Returns `false` when no context is active (before `activate` is called).
   * Implements {@link GatePrompter}.
   */
  canConfirm(): boolean {
    return this.context !== null && this.canPrompt(this.context);
  }

  /**
   * Prompt the user for a permission decision using the stored context.
   * Throws if no context is active — `canConfirm()` guards this in normal use.
   * Implements {@link GatePrompter}.
   */
  promptPermission(
    details: PromptPermissionDetails,
  ): Promise<PermissionPromptDecision> {
    if (this.context === null) {
      return Promise.reject(
        new Error("promptPermission called before the session was activated"),
      );
    }
    return this.prompt(this.context, details);
  }
}
