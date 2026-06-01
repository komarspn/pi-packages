/**
 * subagent-registry.ts — In-process subagent session registry.
 *
 * In-process subagent extensions (e.g. `@gotgenes/pi-subagents`) register
 * each child session here before calling `bindExtensions()` so that
 * `isSubagentExecutionContext()` and permission-forwarding target resolution
 * can detect them without relying on environment variables or filesystem
 * heuristics.
 *
 * The registry is keyed by session directory path, which is unique per
 * session and available to both producer and consumer via
 * `ctx.sessionManager.getSessionDir()`.
 *
 * The single registry instance is stored on `globalThis` (via `Symbol.for()`)
 * so that the parent's permission-system instance (which registers children
 * on the parent's event bus) and each child's separate jiti instance (which
 * reads the registry to detect itself and resolve its forwarding target) share
 * one store across per-session event buses. See `getSubagentSessionRegistry()`.
 */

/** Process-global key for the shared registry slot. */
const SUBAGENT_SESSION_REGISTRY_KEY = Symbol.for(
  "@gotgenes/pi-permission-system:subagent-registry",
);

/**
 * Return the process-global SubagentSessionRegistry, creating it on first call.
 *
 * Backed by `globalThis` + `Symbol.for()` so the parent's permission-system
 * instance (which registers children on the parent event bus) and each child's
 * separate jiti instance (which reads the registry to detect itself and resolve
 * its forwarding target) share one store across per-session event buses.
 *
 * Intentionally has no shutdown/unpublish hook — a child's `session_shutdown`
 * must not be able to wipe the parent's registrations. Entries are added and
 * removed exclusively by the parent's `subagents:child:session-created` /
 * `subagents:child:disposed` subscription.
 */
export function getSubagentSessionRegistry(): SubagentSessionRegistry {
  const store = globalThis as Record<symbol, unknown>;
  const existing = store[SUBAGENT_SESSION_REGISTRY_KEY] as
    | SubagentSessionRegistry
    | undefined;
  if (existing) {
    return existing;
  }
  const registry = new SubagentSessionRegistry();
  store[SUBAGENT_SESSION_REGISTRY_KEY] = registry;
  return registry;
}

/** Signal stored per registered in-process subagent session. */
export interface SubagentSessionInfo {
  /** Parent session ID for permission forwarding. Omit when unknown. */
  parentSessionId?: string;
  /** Agent name for per-agent policy resolution. */
  agentName: string;
}

/**
 * Registry of active in-process subagent sessions.
 *
 * A process-global singleton — obtain it via `getSubagentSessionRegistry()`,
 * never `new` (see that accessor for why). Written exclusively by
 * `subscribeSubagentLifecycle` via the `subagents:child:session-created` /
 * `subagents:child:disposed` event subscription (ADR 0002 — the core
 * publishes, consumers observe).
 *
 * Keyed by session directory path. Note: concurrent sibling children of one
 * parent currently share a key (`<parent>/<basename>/tasks`); keying by child
 * session id is tracked in #298.
 */
export class SubagentSessionRegistry {
  private readonly sessions = new Map<string, SubagentSessionInfo>();

  /**
   * Register an in-process subagent session.
   *
   * If a previous entry exists for `sessionKey`, it is overwritten
   * (last-write-wins; single-writer expected per key).
   */
  register(sessionKey: string, info: SubagentSessionInfo): void {
    this.sessions.set(sessionKey, info);
  }

  /** Remove a previously registered session. No-op if the key is absent. */
  unregister(sessionKey: string): void {
    this.sessions.delete(sessionKey);
  }

  /** Return the registered info for `sessionKey`, or `undefined` if absent. */
  get(sessionKey: string): SubagentSessionInfo | undefined {
    return this.sessions.get(sessionKey);
  }

  /** Return `true` when `sessionKey` has a registered entry. */
  has(sessionKey: string): boolean {
    return this.sessions.has(sessionKey);
  }
}
