import { describe, expect, it } from "vitest";

import {
  frontmatterDescription,
  markdownBody,
} from "../../scripts/agent-docs/frontmatter.mjs";

function skill(frontmatter) {
  return `---\n${frontmatter}\n---\n\n# Body\n\nThe body is loaded on demand and must not count.\n`;
}

describe("frontmatterDescription", () => {
  it("returns every line of a literal (|) block until the next top-level key", () => {
    const md = skill(
      "name: testing\ndescription: |\n  Vitest mock patterns, TDD planning rules,\n  and general test strategy.\nother: value",
    );
    expect(frontmatterDescription(md)).toBe(
      "Vitest mock patterns, TDD planning rules,\nand general test strategy.",
    );
  });

  it("returns every line of a folded (>-) block until the closing fence", () => {
    const md = skill(
      "name: lifecycle\ndescription: >-\n  Reference for the turn model.\n  Use when designing timing.",
    );
    expect(frontmatterDescription(md)).toBe(
      "Reference for the turn model.\nUse when designing timing.",
    );
  });

  it("returns a single-line description", () => {
    const md = skill("name: x\ndescription: One line, no block.");
    expect(frontmatterDescription(md)).toBe("One line, no block.");
  });

  it("returns an empty string when there is no description key", () => {
    expect(frontmatterDescription(skill("name: x"))).toBe("");
  });

  it("returns an empty string when there is no frontmatter at all", () => {
    expect(frontmatterDescription("# Just a body\n\nwords words\n")).toBe("");
  });
});

describe("markdownBody", () => {
  it("returns the text after the closing fence, without the frontmatter", () => {
    const md =
      "---\ndescription: Not sent to the model\nmodel: x\n---\n\n# Heading\n\nBody words.\n";
    expect(markdownBody(md)).toBe("\n# Heading\n\nBody words.\n");
  });

  it("returns the whole text when there is no frontmatter", () => {
    expect(markdownBody("# Heading\n\nBody words.\n")).toBe(
      "# Heading\n\nBody words.\n",
    );
  });

  it("returns an empty body when the fence never closes", () => {
    expect(markdownBody("---\ndescription: x\n")).toBe("");
  });
});
