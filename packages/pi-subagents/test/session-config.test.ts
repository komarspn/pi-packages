import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PreloadedSkill } from "../src/skill-loader.js";
import type { AgentConfig } from "../src/types.js";

const {
  mockResolveAgentConfig,
  mockGetToolNamesForType,
  mockGetMemoryToolNames,
  mockGetReadOnlyMemoryToolNames,
  mockBuildAgentPrompt,
  mockBuildMemoryBlock,
  mockBuildReadOnlyMemoryBlock,
  mockPreloadSkills,
} = vi.hoisted(() => ({
  mockResolveAgentConfig: vi.fn((): AgentConfig => ({
    name: "Explore",
    description: "Fast codebase exploration agent",
    builtinToolNames: ["read"],
    extensions: false,
    skills: false,
    systemPrompt: "You are Explore.",
    promptMode: "replace",
  })),
  mockGetToolNamesForType: vi.fn((): string[] => ["read"]),
  mockGetMemoryToolNames: vi.fn((): string[] => []),
  mockGetReadOnlyMemoryToolNames: vi.fn((): string[] => []),
  mockBuildAgentPrompt: vi.fn(() => "assembled system prompt"),
  mockBuildMemoryBlock: vi.fn(() => "memory block"),
  mockBuildReadOnlyMemoryBlock: vi.fn(() => "read-only memory block"),
  mockPreloadSkills: vi.fn((): PreloadedSkill[] => []),
}));

vi.mock("../src/agent-types.js", () => ({
  resolveAgentConfig: mockResolveAgentConfig,
  getToolNamesForType: mockGetToolNamesForType,
  getMemoryToolNames: mockGetMemoryToolNames,
  getReadOnlyMemoryToolNames: mockGetReadOnlyMemoryToolNames,
}));

vi.mock("../src/prompts.js", () => ({
  buildAgentPrompt: mockBuildAgentPrompt,
}));

vi.mock("../src/memory.js", () => ({
  buildMemoryBlock: mockBuildMemoryBlock,
  buildReadOnlyMemoryBlock: mockBuildReadOnlyMemoryBlock,
}));

vi.mock("../src/skill-loader.js", () => ({
  preloadSkills: mockPreloadSkills,
}));

import { assembleSessionConfig } from "../src/session-config.js";

const mockEnv = { isGitRepo: false, branch: "", platform: "linux" };

const mockRegistry = {
  find: vi.fn((): unknown => undefined),
  getAvailable: vi.fn((): Array<{ provider: string; id: string }> => []),
};

const ctx = {
  cwd: "/tmp",
  parentSystemPrompt: "parent prompt",
  modelRegistry: mockRegistry,
};

beforeEach(() => {
  mockResolveAgentConfig.mockClear();
  mockGetToolNamesForType.mockClear();
  mockGetMemoryToolNames.mockClear();
  mockGetReadOnlyMemoryToolNames.mockClear();
  mockBuildAgentPrompt.mockClear();
  mockBuildMemoryBlock.mockClear();
  mockBuildReadOnlyMemoryBlock.mockClear();
  mockPreloadSkills.mockClear();
  mockRegistry.find.mockReset();
  mockRegistry.getAvailable.mockClear();
});

describe("assembleSessionConfig — default agent shape", () => {
  it("returns correct shape for Explore agent with defaults", () => {
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.effectiveCwd).toBe("/tmp");
    expect(result.systemPrompt).toBe("assembled system prompt");
    expect(result.toolNames).toEqual(["read"]);
    expect(result.extensions).toBe(false);
    expect(result.noSkills).toBe(true);
    expect(result.disallowedSet).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.thinkingLevel).toBeUndefined();
    expect(result.extras).toEqual({});
  });

  it("uses options.cwd as effectiveCwd when provided", () => {
    const result = assembleSessionConfig("Explore", ctx, { cwd: "/tmp/worktree" }, mockEnv);

    expect(result.effectiveCwd).toBe("/tmp/worktree");
  });

  it("falls back to ctx.cwd when options.cwd is not set", () => {
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.effectiveCwd).toBe("/tmp");
  });

  it("builds disallowedSet from agentConfig.disallowedTools", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      builtinToolNames: ["read"],
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      disallowedTools: ["write", "bash"],
    });

    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.disallowedSet).toEqual(new Set(["write", "bash"]));
  });

  it("calls buildAgentPrompt with env, cwd, parentSystemPrompt, and extras", () => {
    assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Explore" }),
      "/tmp",
      mockEnv,
      "parent prompt",
      {},
    );
  });

  it("uses effectiveCwd (options.cwd) when calling buildAgentPrompt", () => {
    assembleSessionConfig("Explore", ctx, { cwd: "/tmp/worktree" }, mockEnv);

    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.any(Object),
      "/tmp/worktree",
      expect.any(Object),
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe("assembleSessionConfig — model resolution", () => {
  it("returns undefined model when no option, no config model, no parent", () => {
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.model).toBeUndefined();
  });

  it("options.model wins over config model and parent model", () => {
    const explicitModel = { provider: "anthropic", id: "claude-opus-4" };
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      model: "anthropic/claude-haiku-4",
    });

    const result = assembleSessionConfig(
      "Explore",
      { ...ctx, parentModel: { provider: "anthropic", id: "claude-haiku-4" } },
      { model: explicitModel },
      mockEnv,
    );

    expect(result.model).toBe(explicitModel);
  });

  it("config model string resolves via registry when available", () => {
    const resolvedModel = { provider: "anthropic", id: "claude-opus-4" };
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      model: "anthropic/claude-opus-4",
    });
    mockRegistry.find.mockReturnValueOnce(resolvedModel);
    mockRegistry.getAvailable.mockReturnValueOnce([
      { provider: "anthropic", id: "claude-opus-4" },
    ]);

    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(mockRegistry.find).toHaveBeenCalledWith("anthropic", "claude-opus-4");
    expect(result.model).toBe(resolvedModel);
  });

  it("falls back to parentModel when config model string is not in registry", () => {
    const parentModel = { provider: "anthropic", id: "claude-haiku-4" };
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      model: "anthropic/unknown-model",
    });
    mockRegistry.find.mockReturnValueOnce(undefined);
    mockRegistry.getAvailable.mockReturnValueOnce([]);

    const result = assembleSessionConfig(
      "Explore",
      { ...ctx, parentModel },
      {},
      mockEnv,
    );

    expect(result.model).toBe(parentModel);
  });

  it("falls back to parentModel when config model is not available (not in getAvailable)", () => {
    const parentModel = { provider: "anthropic", id: "claude-haiku-4" };
    const foundModel = { provider: "anthropic", id: "claude-opus-4" };
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      model: "anthropic/claude-opus-4",
    });
    // Model exists in registry but NOT in available set
    mockRegistry.find.mockReturnValueOnce(foundModel);
    mockRegistry.getAvailable.mockReturnValueOnce([]);

    const result = assembleSessionConfig(
      "Explore",
      { ...ctx, parentModel },
      {},
      mockEnv,
    );

    expect(result.model).toBe(parentModel);
  });

  it("falls back to parentModel when config model has no slash", () => {
    const parentModel = { provider: "anthropic", id: "claude-haiku-4" };
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      model: "claude-opus-4",   // no provider/ prefix
    });

    const result = assembleSessionConfig(
      "Explore",
      { ...ctx, parentModel },
      {},
      mockEnv,
    );

    expect(result.model).toBe(parentModel);
  });

  it("returns parentModel when no config model and no option model", () => {
    const parentModel = { provider: "anthropic", id: "claude-haiku-4" };

    const result = assembleSessionConfig(
      "Explore",
      { ...ctx, parentModel },
      {},
      mockEnv,
    );

    expect(result.model).toBe(parentModel);
  });
});

describe("assembleSessionConfig — skill preloading", () => {
  it("skips preloading when skills is false", () => {
    // default mock has skills: false
    assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(mockPreloadSkills).not.toHaveBeenCalled();
    expect(assembleSessionConfig("Explore", ctx, {}, mockEnv).extras).toEqual({});
  });

  it("skips preloading when skills is true (resource loader handles it)", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "general-purpose",
      description: "General",
      extensions: true as const,
      skills: true as const,
      systemPrompt: "",
      promptMode: "append" as const,
    });

    const result = assembleSessionConfig("general-purpose", ctx, {}, mockEnv);

    expect(mockPreloadSkills).not.toHaveBeenCalled();
    expect(result.noSkills).toBe(false);
    expect(result.extras.skillBlocks).toBeUndefined();
  });

  it("preloads listed skills and sets extras.skillBlocks", () => {
    const skillList = ["code-style", "testing"];
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      builtinToolNames: ["read"],
      extensions: false as const,
      skills: skillList,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
    });
    mockPreloadSkills.mockReturnValueOnce([
      { name: "code-style", content: "# Code Style" },
      { name: "testing", content: "# Testing" },
    ]);

    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(mockPreloadSkills).toHaveBeenCalledWith(skillList, "/tmp");
    expect(result.extras.skillBlocks).toEqual([
      { name: "code-style", content: "# Code Style" },
      { name: "testing", content: "# Testing" },
    ]);
    expect(result.noSkills).toBe(true);
  });

  it("sets noSkills:true but leaves extras.skillBlocks undefined when preloadSkills returns empty", () => {
    const skillList = ["nonexistent-skill"];
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      builtinToolNames: ["read"],
      extensions: false as const,
      skills: skillList,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
    });
    mockPreloadSkills.mockReturnValueOnce([]);

    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.noSkills).toBe(true);
    expect(result.extras.skillBlocks).toBeUndefined();
  });

  it("isolated:true suppresses skill preloading even when config has skills", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      builtinToolNames: ["read"],
      extensions: false as const,
      skills: ["code-style"],
      systemPrompt: "prompt",
      promptMode: "replace" as const,
    });

    const result = assembleSessionConfig("Explore", ctx, { isolated: true }, mockEnv);

    expect(mockPreloadSkills).not.toHaveBeenCalled();
    expect(result.noSkills).toBe(true);
  });
});

describe("assembleSessionConfig — memory block selection", () => {
  function agentWithMemory(toolNames: string[], disallowedTools?: string[]): AgentConfig {
    return {
      name: "Writer",
      description: "test",
      builtinToolNames: toolNames,
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      memory: "project" as const,
      ...(disallowedTools ? { disallowedTools } : {}),
    };
  }

  it("no memory config → no memory block in extras", () => {
    // default mock has no memory field
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.extras.memoryBlock).toBeUndefined();
    expect(mockBuildMemoryBlock).not.toHaveBeenCalled();
    expect(mockBuildReadOnlyMemoryBlock).not.toHaveBeenCalled();
  });

  it("agent with memory + write tool → read-write block", () => {
    mockResolveAgentConfig.mockReturnValueOnce(agentWithMemory(["read", "write", "bash"]));
    mockGetToolNamesForType.mockReturnValueOnce(["read", "write", "bash"]);
    mockGetMemoryToolNames.mockReturnValueOnce([]);

    const result = assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(mockBuildMemoryBlock).toHaveBeenCalledWith("Writer", "project", "/tmp");
    expect(mockBuildReadOnlyMemoryBlock).not.toHaveBeenCalled();
    expect(result.extras.memoryBlock).toBe("memory block");
  });

  it("agent with memory + edit tool (but no write) → read-write block", () => {
    mockResolveAgentConfig.mockReturnValueOnce(agentWithMemory(["read", "edit"]));
    mockGetToolNamesForType.mockReturnValueOnce(["read", "edit"]);
    mockGetMemoryToolNames.mockReturnValueOnce([]);

    assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(mockBuildMemoryBlock).toHaveBeenCalledTimes(1);
    expect(mockBuildReadOnlyMemoryBlock).not.toHaveBeenCalled();
  });

  it("agent with memory + read-only tools → read-only block", () => {
    mockResolveAgentConfig.mockReturnValueOnce(agentWithMemory(["read", "bash", "grep"]));
    mockGetToolNamesForType.mockReturnValueOnce(["read", "bash", "grep"]);
    mockGetReadOnlyMemoryToolNames.mockReturnValueOnce([]);

    const result = assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(mockBuildReadOnlyMemoryBlock).toHaveBeenCalledWith("Writer", "project", "/tmp");
    expect(mockBuildMemoryBlock).not.toHaveBeenCalled();
    expect(result.extras.memoryBlock).toBe("read-only memory block");
  });

  it("denied write tool → read-only block (denylist applied before capability check)", () => {
    mockResolveAgentConfig.mockReturnValueOnce(
      agentWithMemory(["read", "write", "bash"], ["write"]),
    );
    mockGetToolNamesForType.mockReturnValueOnce(["read", "write", "bash"]);
    mockGetReadOnlyMemoryToolNames.mockReturnValueOnce([]);

    assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(mockBuildReadOnlyMemoryBlock).toHaveBeenCalledTimes(1);
    expect(mockBuildMemoryBlock).not.toHaveBeenCalled();
  });

  it("denied edit tool → read-only block when edit was the only write capability", () => {
    mockResolveAgentConfig.mockReturnValueOnce(
      agentWithMemory(["read", "edit"], ["edit"]),
    );
    mockGetToolNamesForType.mockReturnValueOnce(["read", "edit"]);
    mockGetReadOnlyMemoryToolNames.mockReturnValueOnce([]);

    assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(mockBuildReadOnlyMemoryBlock).toHaveBeenCalledTimes(1);
    expect(mockBuildMemoryBlock).not.toHaveBeenCalled();
  });

  it("adds missing memory tool names from getMemoryToolNames to toolNames", () => {
    mockResolveAgentConfig.mockReturnValueOnce(agentWithMemory(["read", "write"]));
    mockGetToolNamesForType.mockReturnValueOnce(["read", "write"]);
    // getMemoryToolNames returns tools not already present (e.g. edit)
    mockGetMemoryToolNames.mockReturnValueOnce(["edit"]);

    const result = assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(result.toolNames).toContain("edit");
    expect(mockGetMemoryToolNames).toHaveBeenCalledWith(new Set(["read", "write"]));
  });

  it("adds read tool name from getReadOnlyMemoryToolNames when not already present", () => {
    mockResolveAgentConfig.mockReturnValueOnce(agentWithMemory(["bash", "grep"]));
    mockGetToolNamesForType.mockReturnValueOnce(["bash", "grep"]);
    mockGetReadOnlyMemoryToolNames.mockReturnValueOnce(["read"]);

    const result = assembleSessionConfig("Writer", ctx, {}, mockEnv);

    expect(result.toolNames).toContain("read");
  });
});

describe("assembleSessionConfig — isolated mode", () => {
  it("isolated:true forces extensions to false regardless of config", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "general-purpose",
      description: "General",
      extensions: true as const,
      skills: true as const,
      systemPrompt: "",
      promptMode: "append" as const,
    });

    const result = assembleSessionConfig("general-purpose", ctx, { isolated: true }, mockEnv);

    expect(result.extensions).toBe(false);
    expect(result.noSkills).toBe(true);
  });

  it("isolated:false (default) preserves config extensions setting", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "general-purpose",
      description: "General",
      extensions: true as const,
      skills: true as const,
      systemPrompt: "",
      promptMode: "append" as const,
    });

    const result = assembleSessionConfig("general-purpose", ctx, {}, mockEnv);

    expect(result.extensions).toBe(true);
  });

  it("isolated:true forces extensions to false even for string[] extension list", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      builtinToolNames: ["read"],
      extensions: ["pi-github-tools"] as string[],
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
    });

    const result = assembleSessionConfig("Explore", ctx, { isolated: true }, mockEnv);

    expect(result.extensions).toBe(false);
  });
});

describe("assembleSessionConfig — unknown type fallback", () => {
  it("passes resolved config directly to buildAgentPrompt", () => {
    // resolveAgentConfig handles the fallback internally —
    // session-config just forwards whatever it returns
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "general-purpose",
      description: "General-purpose",
      extensions: true as const,
      skills: true as const,
      systemPrompt: "",
      promptMode: "append" as const,
    });

    assembleSessionConfig("unknown-custom-agent", ctx, {}, mockEnv);

    expect(mockBuildAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ name: "general-purpose" }),
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe("assembleSessionConfig — thinking level", () => {
  it("returns undefined thinkingLevel when neither option nor config sets it", () => {
    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.thinkingLevel).toBeUndefined();
  });

  it("options.thinkingLevel wins over agentConfig.thinking", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      thinking: "low" as const,
    });

    const result = assembleSessionConfig(
      "Explore",
      ctx,
      { thinkingLevel: "high" },
      mockEnv,
    );

    expect(result.thinkingLevel).toBe("high");
  });

  it("agentConfig.thinking is used when no option is provided", () => {
    mockResolveAgentConfig.mockReturnValueOnce({
      name: "Explore",
      description: "test",
      extensions: false as const,
      skills: false as const,
      systemPrompt: "prompt",
      promptMode: "replace" as const,
      thinking: "medium" as const,
    });

    const result = assembleSessionConfig("Explore", ctx, {}, mockEnv);

    expect(result.thinkingLevel).toBe("medium");
  });
});
