import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PersistentApprovalRecorder } from "#src/persistent-approval-recorder";
import { SessionApproval } from "#src/session-approval";
import type { SessionLogger } from "#src/session-logger";

function makeLogger(): SessionLogger {
  return {
    debug: vi.fn(),
    review: vi.fn(),
    warn: vi.fn(),
  };
}

describe("PersistentApprovalRecorder", () => {
  it("writes project allow rule to project config", () => {
    const root = mkdtempSync(join(tmpdir(), "pi-permission-project-"));
    const agentDir = join(root, "agent");
    const cwd = join(root, "project");
    const logger = makeLogger();
    const recorder = new PersistentApprovalRecorder({
      agentDir,
      getCwd: () => cwd,
      logger,
    });

    recorder.recordApproval(
      "project",
      SessionApproval.single("bash", "git status"),
    );

    const config = JSON.parse(
      readFileSync(
        join(cwd, ".pi", "extensions", "pi-permission-system", "config.json"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    expect(config).toEqual({
      permission: {
        bash: {
          "git status": "allow",
        },
      },
    });
  });

  it("writes global allow rule to global config", () => {
    const root = mkdtempSync(join(tmpdir(), "pi-permission-global-"));
    const agentDir = join(root, "agent");
    const logger = makeLogger();
    const recorder = new PersistentApprovalRecorder({
      agentDir,
      getCwd: () => null,
      logger,
    });

    recorder.recordApproval(
      "global",
      SessionApproval.single("mcp", "github:create_issue"),
    );

    const config = JSON.parse(
      readFileSync(
        join(agentDir, "extensions", "pi-permission-system", "config.json"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    expect(config).toEqual({
      permission: {
        mcp: {
          "github:create_issue": "allow",
        },
      },
    });
  });

  it("preserves existing permission entries while adding allow patterns", () => {
    const root = mkdtempSync(join(tmpdir(), "pi-permission-merge-"));
    const agentDir = join(root, "agent");
    const configPath = join(
      agentDir,
      "extensions",
      "pi-permission-system",
      "config.json",
    );
    mkdirSync(join(agentDir, "extensions", "pi-permission-system"), {
      recursive: true,
    });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          debugLog: true,
          permission: {
            bash: {
              "rm *": "deny",
            },
          },
        },
        null,
        2,
      ),
    );
    const logger = makeLogger();
    const recorder = new PersistentApprovalRecorder({
      agentDir,
      getCwd: () => null,
      logger,
    });

    recorder.recordApproval(
      "global",
      SessionApproval.multiple("bash", ["git status", "git log"]),
    );

    const config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
      string,
      unknown
    >;
    expect(config).toEqual({
      debugLog: true,
      permission: {
        bash: {
          "rm *": "deny",
          "git status": "allow",
          "git log": "allow",
        },
      },
    });
  });
});
