import type { PermissionCheckResult } from "./types";

/**
 * Resolves the effective permission for a surface/input, applying the current
 * session rules internally.
 *
 * Collapses the `checkPermission` + `getSessionRuleset` relay that every gate
 * previously threaded by hand: the ruleset was only ever fetched to be passed
 * straight back into `checkPermission`, so the two are one operation.
 */
export interface ScopedPermissionResolver {
  resolve(
    surface: string,
    input: unknown,
    agentName?: string,
  ): PermissionCheckResult;
}
