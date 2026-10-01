import { describe, expect, it } from "vitest";

import { alwaysLoadedWords } from "../../scripts/agent-docs/always-loaded.mjs";

describe("alwaysLoadedWords", () => {
  it("sums AGENTS.md, every skill description, and every agent description, reporting each part", () => {
    expect(
      alwaysLoadedWords({
        agentsMd: "one two three",
        skillDescriptions: ["four five", "six", ""],
        agentDescriptions: ["seven eight nine ten"],
      }),
    ).toEqual({
      agentsMd: 3,
      descriptions: 3,
      agentDescriptions: 4,
      total: 10,
    });
  });

  it("counts agent descriptions when they are the only non-empty part", () => {
    expect(
      alwaysLoadedWords({
        agentsMd: "",
        skillDescriptions: [],
        agentDescriptions: ["reviewer runs checks", "assessor"],
      }),
    ).toEqual({ agentsMd: 0, descriptions: 0, agentDescriptions: 4, total: 4 });
  });

  it("reports zeros for an empty corpus", () => {
    expect(
      alwaysLoadedWords({
        agentsMd: "",
        skillDescriptions: [],
        agentDescriptions: [],
      }),
    ).toEqual({ agentsMd: 0, descriptions: 0, agentDescriptions: 0, total: 0 });
  });
});
