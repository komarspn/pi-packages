import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readForwardedPermissionResponse } from "#src/authority/forwarding-io";
import { requestPermissionDecisionFromUi } from "#src/authority/permission-dialog";
import {
  initialPromptState,
  reducePrompt,
} from "#src/authority/permission-prompt-decision";
import { DEFAULT_DIALOG_KEYS } from "#src/config/dialog-keys";
import { GateRunner } from "#src/handlers/gates/runner";
import { PersistentApprovalRecorder } from "#src/session/persistent-approval-recorder";
import { SessionApproval } from "#src/session/session-approval";
import { DECIDED_BY_HUMAN } from "#test/helpers/decision-fixtures";
import { makeDescriptor, makeResolver } from "#test/helpers/gate-fixtures";
import { makeCheckResult } from "#test/helpers/handler-fixtures";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function rootDir(): string {
  const root = mkdtempSync(join(tmpdir(), "pi-persistent-approval-"));
  roots.push(root);
  return root;
}

describe("persistent approval", () => {
  it.each([
    [
      "project",
      "approved_for_project",
      "approveProject",
      "Yes, always for this project",
    ],
    [
      "global",
      "approved_globally",
      "approveGlobal",
      "Yes, always for all projects",
    ],
  ] as const)(
    "records %s grants without granting the session or widening directions",
    async (scope, state, action, label) => {
      const root = rootDir();
      const configPath =
        scope === "project"
          ? join(root, ".pi/extensions/pi-permission-system/config.json")
          : join(root, "extensions/pi-permission-system/config.json");
      const logger = { warn: vi.fn(), debug: vi.fn(), review: vi.fn() };
      const recorder = new PersistentApprovalRecorder({
        agentDir: root,
        getCwd: () => root,
        logger,
      });
      const sessionRecorder = { recordSessionApproval: vi.fn() };
      const reporter = { emitDecision: vi.fn(), writeReviewLog: vi.fn() };
      const decision = { approved: true, state, decidedBy: DECIDED_BY_HUMAN };
      const runner = new GateRunner(
        makeResolver(makeCheckResult({ state: "ask" })),
        sessionRecorder,
        { escalate: vi.fn().mockResolvedValue(decision) },
        reporter,
        () => false,
        recorder,
      );
      const approval = SessionApproval.forGrants([
        { surface: "external_directory_read", pattern: "/one/*" },
        { surface: "external_directory_write", pattern: "/two/*" },
      ]);
      expect(
        await runner.run(makeDescriptor({ sessionApproval: approval }), null),
      ).toEqual({ action: "allow" });
      expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual({
        permission: {
          external_directory_read: { "/one/*": "allow" },
          external_directory_write: { "/two/*": "allow" },
        },
      });
      expect(sessionRecorder.recordSessionApproval).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(reporter.emitDecision.mock.calls[0][0].resolution).toBe(
        scope === "project"
          ? "user_approved_for_project"
          : "user_approved_globally",
      );
      expect(
        await requestPermissionDecisionFromUi(
          { select: vi.fn().mockResolvedValue(label), input: vi.fn() },
          "Title",
          "Message",
        ),
      ).toEqual({ approved: true, state });
      const config = {
        keys: DEFAULT_DIALOG_KEYS,
        sessionLabel: "Session",
        doublePressToConfirm: true,
      };
      const armed = reducePrompt(config, initialPromptState(config), {
        type: "hotkey",
        action,
      });
      expect(armed.kind).toBe("render");
      if (armed.kind !== "render") throw new Error("expected arming");
      expect(
        reducePrompt(config, armed.state, { type: "hotkey", action }),
      ).toEqual({ kind: "decision", decision: { approved: true, state } });
      const responsePath = join(root, "response.json");
      writeFileSync(
        responsePath,
        JSON.stringify({
          responderSessionId: "parent",
          approved: true,
          state,
          respondedAt: Date.now(),
          decidedBy: DECIDED_BY_HUMAN,
        }),
      );
      expect(readForwardedPermissionResponse(null, responsePath)?.state).toBe(
        state,
      );
    },
  );

  it.each(["{", "[]", '{"permission":{"bash":7}}'])(
    "does not overwrite an invalid config: %s",
    (raw) => {
      const root = rootDir();
      const path = join(root, "extensions/pi-permission-system/config.json");
      mkdirSync(join(root, "extensions/pi-permission-system"), {
        recursive: true,
      });
      writeFileSync(path, raw);
      const logger = { warn: vi.fn(), debug: vi.fn(), review: vi.fn() };
      new PersistentApprovalRecorder({
        agentDir: root,
        getCwd: () => root,
        logger,
      }).recordApproval("global", SessionApproval.single("bash", "git status"));
      expect(readFileSync(path, "utf-8")).toBe(raw);
      expect(logger.warn).toHaveBeenCalledOnce();
    },
  );

  it("rejects unknown forwarded decision states", () => {
    const path = join(rootDir(), "response.json");
    writeFileSync(
      path,
      JSON.stringify({
        responderSessionId: "parent",
        approved: true,
        state: "approve_everything",
        respondedAt: Date.now(),
      }),
    );
    expect(readForwardedPermissionResponse(null, path)).toBeNull();
  });
});
