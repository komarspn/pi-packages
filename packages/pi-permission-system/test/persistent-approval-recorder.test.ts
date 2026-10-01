import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionLogger } from "#src/logging/session-logger";
import { PersistentApprovalRecorder } from "#src/session/persistent-approval-recorder";
import { SessionApproval } from "#src/session/session-approval";

function makeLogger() {
  return {
    debug: vi.fn(),
    review: vi.fn(),
    warn: vi.fn(),
  } satisfies SessionLogger;
}

describe("PersistentApprovalRecorder", () => {
  describe("persistent safety", () => {
    let root: string;
    let configPath: string;
    let logger: ReturnType<typeof makeLogger>;
    let recorder: PersistentApprovalRecorder;

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), "pi-permission-safety-"));
      configPath = join(root, "extensions/pi-permission-system/config.json");
      mkdirSync(join(root, "extensions/pi-permission-system"), {
        recursive: true,
      });
      logger = makeLogger();
      recorder = new PersistentApprovalRecorder({
        agentDir: root,
        getCwd: () => null,
        logger,
      });
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it.each(["deny", { action: "deny", reason: "private" }] as const)(
      "keeps deny exceptions last without losing their value: %j",
      (deny) => {
        writeFileSync(
          configPath,
          JSON.stringify({
            permission: {
              external_directory_read: {
                "*": "ask",
                "/outside/*": "ask",
                "/outside/secret": deny,
                "/other/*": "allow",
              },
            },
          }),
        );

        recorder.recordApproval(
          "global",
          SessionApproval.single("external_directory_read", "/outside/*"),
        );
        const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
          permission: { external_directory_read: Record<string, unknown> };
        };
        expect(
          Object.entries(config.permission.external_directory_read),
        ).toEqual([
          ["*", "ask"],
          ["/other/*", "allow"],
          ["/outside/*", "allow"],
          ["/outside/secret", deny],
        ]);
        expect(logger.warn).not.toHaveBeenCalled();
      },
    );

    it.each(["deny", { action: "deny", reason: "private" }] as const)(
      "never replaces the exact deny pattern: %j",
      (deny) => {
        const config = { permission: { bash: { "*": "ask", "rm *": deny } } };
        writeFileSync(configPath, JSON.stringify(config));
        recorder.recordApproval(
          "global",
          SessionApproval.single("bash", "rm *"),
        );
        expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(config);
      },
    );

    it("keeps a scalar surface deny", () => {
      const config = { permission: { bash: "deny" } };
      writeFileSync(configPath, JSON.stringify(config));
      recorder.recordApproval(
        "global",
        SessionApproval.single("bash", "git status"),
      );
      expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(config);
    });

    it("leaves a held lock and config unchanged, then records after release", () => {
      const raw = JSON.stringify({ permission: { bash: { "*": "ask" } } });
      writeFileSync(configPath, raw);
      writeFileSync(`${configPath}.lock`, "other recorder", {
        flag: "wx",
        mode: 0o600,
      });
      recorder.recordApproval(
        "global",
        SessionApproval.single("bash", "git status"),
      );
      expect(readFileSync(configPath, "utf-8")).toBe(raw);
      expect(readFileSync(`${configPath}.lock`, "utf-8")).toBe(
        "other recorder",
      );
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining("EEXIST"),
      );
      unlinkSync(`${configPath}.lock`);

      recorder.recordApproval(
        "global",
        SessionApproval.single("bash", "git status"),
      );
      expect(existsSync(`${configPath}.lock`)).toBe(false);
      expect(statSync(configPath).mode & 0o777).toBe(0o600);
      recorder.recordApproval(
        "global",
        SessionApproval.single("bash", "git log"),
      );
      expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual({
        permission: {
          bash: { "*": "ask", "git status": "allow", "git log": "allow" },
        },
      });
      expect(existsSync(`${configPath}.lock`)).toBe(false);
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it.each(["{", "[]", '{"permission":{"bash":7}}'])(
      "does not overwrite invalid config and releases the lock: %s",
      (raw) => {
        writeFileSync(configPath, raw);
        recorder.recordApproval(
          "global",
          SessionApproval.single("bash", "git status"),
        );
        expect(readFileSync(configPath, "utf-8")).toBe(raw);
        expect(existsSync(`${configPath}.lock`)).toBe(false);
        expect(logger.warn).toHaveBeenCalledOnce();
        writeFileSync(configPath, "{}");
        recorder.recordApproval(
          "global",
          SessionApproval.single("bash", "git status"),
        );
        expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual({
          permission: { bash: { "git status": "allow" } },
        });
        expect(existsSync(`${configPath}.lock`)).toBe(false);
        expect(logger.warn).toHaveBeenCalledOnce();
      },
    );
  });

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
      SessionApproval.forGrants([
        { surface: "bash", pattern: "git status" },
        { surface: "bash", pattern: "git log" },
      ]),
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
