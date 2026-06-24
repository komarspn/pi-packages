import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { stripJsonComments } from "#src/config/config-loader";
import {
  getGlobalConfigPath,
  getProjectConfigPath,
} from "#src/config/config-paths";
import { unifiedConfigSchema } from "#src/config/config-schema";
import type { SessionApproval } from "./session-approval";

export interface PersistentApprovalRecorderDeps {
  agentDir: string;
  getCwd: () => string | undefined | null;
  logger: {
    warn(message: string): void;
    review(event: string, details?: Record<string, unknown>): void;
  };
}

/** Records the exact proven grants without widening their directions. */
export class PersistentApprovalRecorder {
  constructor(private readonly deps: PersistentApprovalRecorderDeps) {}

  recordApproval(scope: "project" | "global", approval: SessionApproval): void {
    const cwd = this.deps.getCwd();
    const configPath =
      scope === "global"
        ? getGlobalConfigPath(this.deps.agentDir)
        : typeof cwd === "string" && cwd.trim()
          ? getProjectConfigPath(cwd)
          : null;
    if (!approval.isRecordable) return;
    let lockFd: number | undefined;
    const lockPath = `${configPath}.lock`;
    try {
      if (!configPath) throw new Error("missing_project_directory");
      mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
      // ponytail: This lock coordinates recorder writes only, not external editors.
      // A stale lock fails closed. Use a shared locking protocol if recovery is needed.
      lockFd = openSync(lockPath, "wx", 0o600);
      const raw: unknown = existsSync(configPath)
        ? JSON.parse(stripJsonComments(readFileSync(configPath, "utf-8")))
        : {};
      // Reject an invalid file instead of overwriting data or loosening its fail-closed policy.
      const config = unifiedConfigSchema.parse(raw);
      let permission = { ...config.permission };
      for (const { surface, pattern } of approval.grants) {
        const current = permission[surface];
        if (current === "deny") continue;
        const entries = Object.entries(
          typeof current === "string" ? { "*": current } : { ...current },
        );
        const denies = Object.fromEntries(
          entries.filter(
            ([, value]) => value === "deny" || typeof value === "object",
          ),
        );
        // Last-match-wins: consent renews approvals, but never overrides explicit denies.
        const next = Object.fromEntries(
          entries.filter(
            ([key]) => key !== pattern && !Object.hasOwn(denies, key),
          ),
        );
        permission = {
          ...permission,
          [surface]: {
            ...next,
            ...(Object.hasOwn(denies, pattern)
              ? {}
              : { [pattern]: "allow" as const }),
            ...denies,
          },
        };
      }
      writeConfigAtomic(configPath, { ...config, permission });
      this.deps.logger.review(
        "permission_request.persistent_approval_recorded",
        {
          scope,
          configPath,
          grants: approval.grants,
        },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.deps.logger.warn(
        `Failed to persist ${scope} permission approval: ${reason}`,
      );
      this.deps.logger.review("permission_request.persistent_approval_failed", {
        scope,
        configPath,
        grants: approval.grants,
        reason,
      });
    } finally {
      if (lockFd !== undefined) {
        try {
          try {
            closeSync(lockFd);
          } finally {
            unlinkSync(lockPath);
          }
        } catch (error) {
          this.deps.logger.warn(
            `Failed to release permission config lock: ${String(error)}`,
          );
        }
      }
    }
  }
}

function writeConfigAtomic(path: string, config: unknown): void {
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
      flag: "wx",
    });
    renameSync(tmpPath, path);
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  }
}
