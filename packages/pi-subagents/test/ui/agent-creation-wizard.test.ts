import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTypeRegistry } from "../../src/agent-types.js";
import { createAgentCreationWizard } from "../../src/ui/agent-creation-wizard.js";
import { createTestRecord } from "../helpers/make-record.js";

const testRegistry = new AgentTypeRegistry(() => new Map());

function makeFileOps() {
  return {
    exists: vi.fn((): boolean => false),
    read: vi.fn((): string | undefined => undefined),
    write: vi.fn(),
    remove: vi.fn(),
    ensureDir: vi.fn(),
    findAgentFile: vi.fn((): string | undefined => undefined),
  };
}

function makeManager() {
  return {
    listAgents: vi.fn().mockReturnValue([]),
    getRecord: vi.fn(),
    spawnAndWait: vi.fn(),
  };
}

function makeDeps() {
  return {
    fileOps: makeFileOps(),
    manager: makeManager(),
    registry: testRegistry,
    personalAgentsDir: "/home/.pi/agents",
    projectAgentsDir: "/project/.pi/agents",
  };
}

function makeCtx(selectResults: (string | undefined)[] = []) {
  let selectIdx = 0;
  return {
    ui: {
      select: vi.fn().mockImplementation(() => selectResults[selectIdx++]),
      input: vi.fn(),
      confirm: vi.fn(),
      editor: vi.fn(),
      notify: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(testRegistry, "reload").mockImplementation(() => {});
});

describe("createAgentCreationWizard", () => {
  describe("showCreateWizard", () => {
    it("returns when user cancels location selection", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([undefined]);
      const wizard = createAgentCreationWizard(deps);

      await wizard.showCreateWizard(ctx as any);

      expect(ctx.ui.select).toHaveBeenCalledTimes(1);
    });

    it("returns when user cancels method selection", async () => {
      const deps = makeDeps();
      const ctx = makeCtx(["Project (.pi/agents/)", undefined]);
      const wizard = createAgentCreationWizard(deps);

      await wizard.showCreateWizard(ctx as any);

      expect(ctx.ui.select).toHaveBeenCalledTimes(2);
    });
  });

  describe("generate wizard", () => {
    it("spawns agent and notifies on success when file is created", async () => {
      const deps = makeDeps();
      deps.fileOps.exists.mockReturnValue(false).mockReturnValueOnce(false);
      deps.manager.spawnAndWait.mockResolvedValue(
        createTestRecord({ status: "completed" }),
      );
      // After spawn, check if file exists → true (file was created by spawned agent)
      deps.fileOps.exists
        .mockReset()
        .mockReturnValueOnce(false) // overwrite check before spawn
        .mockReturnValueOnce(true); // success check after spawn

      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Generate with Claude (recommended)",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("A code reviewer agent") // description
        .mockResolvedValueOnce("code-reviewer"); // name

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.manager.spawnAndWait).toHaveBeenCalledWith(
        ctx,
        "general-purpose",
        expect.stringContaining("code-reviewer"),
        expect.objectContaining({ maxTurns: 5 }),
      );
      expect(deps.fileOps.ensureDir).toHaveBeenCalledWith("/project/.pi/agents");
      expect(ctx.ui.notify).toHaveBeenCalledWith(
        "Created /project/.pi/agents/code-reviewer.md",
        "info",
      );
    });

    it("notifies warning when spawn returns error status", async () => {
      const deps = makeDeps();
      deps.manager.spawnAndWait.mockResolvedValue(
        createTestRecord({ status: "error", error: "spawn failed" }),
      );

      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Generate with Claude (recommended)",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("description")
        .mockResolvedValueOnce("test-agent");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(ctx.ui.notify).toHaveBeenCalledWith(
        "Generation failed: spawn failed",
        "warning",
      );
    });

    it("notifies warning when file is not created after successful spawn", async () => {
      const deps = makeDeps();
      deps.manager.spawnAndWait.mockResolvedValue(
        createTestRecord({ status: "completed" }),
      );
      // File does not exist after spawn
      deps.fileOps.exists.mockReturnValue(false);

      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Generate with Claude (recommended)",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("description")
        .mockResolvedValueOnce("test-agent");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(ctx.ui.notify).toHaveBeenCalledWith(
        "Agent generation completed but file was not created. Check the agent output.",
        "warning",
      );
    });

    it("prompts for overwrite when target file already exists", async () => {
      const deps = makeDeps();
      deps.fileOps.exists.mockReturnValue(true);

      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Generate with Claude (recommended)",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("description")
        .mockResolvedValueOnce("existing-agent");
      ctx.ui.confirm.mockResolvedValue(false);

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(ctx.ui.confirm).toHaveBeenCalledWith(
        "Overwrite",
        expect.stringContaining("already exists"),
      );
      expect(deps.manager.spawnAndWait).not.toHaveBeenCalled();
    });

    it("returns when user cancels description input", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Generate with Claude (recommended)",
      ]);
      ctx.ui.input = vi.fn().mockResolvedValueOnce(undefined);

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.manager.spawnAndWait).not.toHaveBeenCalled();
    });
  });

  describe("manual wizard", () => {
    it("writes agent file with all form inputs", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Manual configuration",
        "all", // tools
        "inherit (parent model)", // model
        "inherit", // thinking
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("my-agent") // name
        .mockResolvedValueOnce("A test agent"); // description
      ctx.ui.editor = vi.fn().mockResolvedValue("You are a test agent.");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/my-agent.md",
        expect.stringContaining("description: A test agent"),
      );
      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/my-agent.md",
        expect.stringContaining("You are a test agent."),
      );
      expect(testRegistry.reload).toHaveBeenCalled();
    });

    it("includes model line when a specific model is selected", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Manual configuration",
        "all",
        "haiku",
        "inherit",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("fast-agent")
        .mockResolvedValueOnce("Fast agent");
      ctx.ui.editor = vi.fn().mockResolvedValue("prompt");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/fast-agent.md",
        expect.stringContaining("model: anthropic/claude-haiku-4-5-20251001"),
      );
    });

    it("includes thinking line when a non-inherit level is selected", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Manual configuration",
        "all",
        "inherit (parent model)",
        "high",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("thinker")
        .mockResolvedValueOnce("Deep thinker");
      ctx.ui.editor = vi.fn().mockResolvedValue("prompt");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/thinker.md",
        expect.stringContaining("thinking: high"),
      );
    });

    it("uses read-only tools when read-only is selected", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Manual configuration",
        "read-only (read, bash, grep, find, ls)",
        "inherit (parent model)",
        "inherit",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("reader")
        .mockResolvedValueOnce("Read-only agent");
      ctx.ui.editor = vi.fn().mockResolvedValue("prompt");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/project/.pi/agents/reader.md",
        expect.stringContaining("tools: read, bash, grep, find, ls"),
      );
    });

    it("prompts for overwrite when target file already exists", async () => {
      const deps = makeDeps();
      deps.fileOps.exists.mockReturnValue(true);
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Manual configuration",
        "all",
        "inherit (parent model)",
        "inherit",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("existing")
        .mockResolvedValueOnce("desc");
      ctx.ui.editor = vi.fn().mockResolvedValue("prompt");
      ctx.ui.confirm.mockResolvedValue(false);

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(ctx.ui.confirm).toHaveBeenCalledWith(
        "Overwrite",
        expect.stringContaining("already exists"),
      );
      expect(deps.fileOps.write).not.toHaveBeenCalled();
    });

    it("returns when user cancels name input", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Project (.pi/agents/)",
        "Manual configuration",
      ]);
      ctx.ui.input = vi.fn().mockResolvedValueOnce(undefined);

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.fileOps.write).not.toHaveBeenCalled();
    });

    it("writes to personal directory when personal is selected", async () => {
      const deps = makeDeps();
      const ctx = makeCtx([
        "Personal (/home/.pi/agents)",
        "Manual configuration",
        "all",
        "inherit (parent model)",
        "inherit",
      ]);
      ctx.ui.input = vi.fn()
        .mockResolvedValueOnce("personal-agent")
        .mockResolvedValueOnce("Personal agent");
      ctx.ui.editor = vi.fn().mockResolvedValue("prompt");

      const wizard = createAgentCreationWizard(deps);
      await wizard.showCreateWizard(ctx as any);

      expect(deps.fileOps.write).toHaveBeenCalledWith(
        "/home/.pi/agents/personal-agent.md",
        expect.stringContaining("description: Personal agent"),
      );
    });
  });
});
