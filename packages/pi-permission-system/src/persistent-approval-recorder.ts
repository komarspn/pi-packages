import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { stripJsonComments } from "./config-loader";
import { getGlobalConfigPath, getProjectConfigPath } from "./config-paths";
import type { SessionApproval } from "./session-approval";
import type { SessionLogger } from "./session-logger";

type PersistentApprovalScope = "project" | "global";

export interface PersistentApprovalRecorderDeps {
  agentDir: string;
  getCwd: () => string | undefined | null;
  logger: SessionLogger;
}

/** Records user-approved allow rules into project/global permission config. */
export class PersistentApprovalRecorder {
  constructor(private readonly deps: PersistentApprovalRecorderDeps) {}

  recordApproval(scope: PersistentApprovalScope, approval: SessionApproval): void {
    const configPath = this.getConfigPath(scope);
    if (!configPath) {
      this.deps.logger.warn(
        "Cannot persist project permission approval because current project directory is unknown.",
      );
      this.deps.logger.review("permission_request.persistent_approval_failed", {
        scope,
        surface: approval.surface,
        patterns: approval.patterns,
        reason: "missing_project_directory",
      });
      return;
    }

    try {
      const config = readConfigObject(configPath);
      addAllowPatterns(config, approval.surface, approval.patterns);
      writeConfigAtomic(configPath, config);
      this.deps.logger.review("permission_request.persistent_approval_recorded", {
        scope,
        configPath,
        surface: approval.surface,
        patterns: approval.patterns,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.logger.warn(
        `Failed to persist ${scope} permission approval at '${configPath}': ${message}`,
      );
      this.deps.logger.review("permission_request.persistent_approval_failed", {
        scope,
        configPath,
        surface: approval.surface,
        patterns: approval.patterns,
        reason: message,
      });
    }
  }

  private getConfigPath(scope: PersistentApprovalScope): string | null {
    if (scope === "global") {
      return getGlobalConfigPath(this.deps.agentDir);
    }

    const cwd = this.deps.getCwd();
    return typeof cwd === "string" && cwd.trim().length > 0
      ? getProjectConfigPath(cwd)
      : null;
  }
}

function readConfigObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }

  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(stripJsonComments(raw)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, unknown>;
}

function addAllowPatterns(
  config: Record<string, unknown>,
  surface: string,
  patterns: readonly string[],
): void {
  const permission =
    config.permission &&
    typeof config.permission === "object" &&
    !Array.isArray(config.permission)
      ? (config.permission as Record<string, unknown>)
      : {};

  const currentSurface = permission[surface];
  const nextSurface: Record<string, unknown> =
    currentSurface &&
    typeof currentSurface === "object" &&
    !Array.isArray(currentSurface)
      ? { ...(currentSurface as Record<string, unknown>) }
      : typeof currentSurface === "string"
        ? { "*": currentSurface }
        : {};

  for (const pattern of patterns) {
    nextSurface[pattern] = "allow";
  }

  permission[surface] = nextSurface;
  config.permission = permission;
}

function writeConfigAtomic(path: string, config: Record<string, unknown>): void {
  const tmpPath = `${path}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
    renameSync(tmpPath, path);
  } catch (error) {
    try {
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup failures.
    }
    throw error;
  }
}
