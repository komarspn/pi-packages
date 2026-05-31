/**
 * Filesystem-backed PermissionManager harness for integration tests.
 *
 * Writes a real config file and agents directory to a temp directory so
 * PermissionManager can load them without mocking the file system.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PermissionManager } from "#src/permission-manager";
import type { ScopeConfig } from "#src/types";

export type CreateManagerOptions = {
  mcpServerNames?: readonly string[];
};

export function createManager(
  config: ScopeConfig,
  agentFiles: Record<string, string> = {},
  options: CreateManagerOptions = {},
) {
  const baseDir = mkdtempSync(join(tmpdir(), "pi-permission-system-test-"));
  const globalConfigPath = join(baseDir, "pi-permissions.jsonc");
  const agentsDir = join(baseDir, "agents");

  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    globalConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );

  for (const [name, content] of Object.entries(agentFiles)) {
    writeFileSync(join(agentsDir, `${name}.md`), content, "utf8");
  }

  const manager = new PermissionManager({
    globalConfigPath,
    agentsDir,
    mcpServerNames: options.mcpServerNames,
  });

  return {
    manager,
    globalConfigPath,
    cleanup: (): void => {
      rmSync(baseDir, { recursive: true, force: true });
    },
  };
}
