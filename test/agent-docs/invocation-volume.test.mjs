import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  invocations,
  templateHeading,
  volumeRows,
} from "../../scripts/agent-docs/invocation-volume.mjs";

const PROMPTS_DIR = path.join(
  import.meta.dirname,
  "..",
  "..",
  ".pi",
  "prompts",
);

const WINDOW = { since: "2026-09-01", until: "2026-09-29" };
const INSIDE = "2026-09-15T12:00:00.000Z";

/** A user message as Pi writes it: an expanded template is its text. */
function user(text, timestamp = INSIDE) {
  return JSON.stringify({
    type: "message",
    timestamp,
    message: { role: "user", content: [{ type: "text", text }] },
  });
}

/** An assistant message carrying one tool call. */
function toolCall(name, args, timestamp = INSIDE) {
  return JSON.stringify({
    type: "message",
    timestamp,
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "Dispatching." },
        { type: "toolCall", name, arguments: args },
      ],
    },
  });
}

function collect(lines, window = WINDOW) {
  return [...invocations(lines, window)];
}

describe("invocations", () => {
  describe("templates", () => {
    it("yields the first line of each user message as a template key", () => {
      expect(
        collect([
          user("# Plan a GitHub issue\n\nIssue number: `935`"),
          user("# Ship the implementation\n\nArgument: `935`"),
        ]),
      ).toEqual([
        { kind: "template", key: "# Plan a GitHub issue" },
        { kind: "template", key: "# Ship the implementation" },
      ]);
    });

    it("keys a message that quotes a heading later on by its own first line", () => {
      expect(
        collect([user("Why did step 3 do that?\n\n# Plan a GitHub issue")]),
      ).toEqual([{ kind: "template", key: "Why did step 3 do that?" }]);
    });

    it("reads a user message whose content is a plain string", () => {
      const line = JSON.stringify({
        type: "message",
        timestamp: INSIDE,
        message: { role: "user", content: "# Triage the backlog\n\nbody" },
      });
      expect(collect([line])).toEqual([
        { kind: "template", key: "# Triage the backlog" },
      ]);
    });
  });

  describe("agents", () => {
    it("yields the subagent_type of each subagent dispatch", () => {
      expect(
        collect([
          toolCall("subagent", {
            subagent_type: "pre-completion-reviewer",
            prompt: "Review issue #935.",
          }),
        ]),
      ).toEqual([{ kind: "agent", key: "pre-completion-reviewer" }]);
    });

    it("skips a resumed dispatch, which re-sends no system prompt", () => {
      expect(
        collect([
          toolCall("subagent", {
            subagent_type: "tidy-first-assessor",
            prompt: "Answer.",
            resume: "86055480-b0a7-442",
          }),
        ]),
      ).toEqual([]);
    });

    it("ignores a different tool that happens to carry a subagent_type", () => {
      // The "subagent" value gets the line past the cheap text pre-filter, so
      // the tool-name check is what has to exclude it.
      expect(
        collect([
          toolCall("steer_subagent", {
            subagent_type: "tidy-first-assessor",
            message: "subagent",
          }),
        ]),
      ).toEqual([]);
    });
  });

  describe("window", () => {
    it("skips entries before since", () => {
      expect(
        collect([user("# Plan a GitHub issue", "2026-08-31T23:59:59.000Z")]),
      ).toEqual([]);
    });

    it("includes an entry at the start of the since day", () => {
      expect(
        collect([user("# Plan a GitHub issue", "2026-09-01T00:00:00.000Z")]),
      ).toEqual([{ kind: "template", key: "# Plan a GitHub issue" }]);
    });

    it("skips entries on or after until", () => {
      expect(
        collect([
          user("# Plan a GitHub issue", "2026-09-29T00:00:00.000Z"),
          toolCall(
            "subagent",
            { subagent_type: "pre-completion-reviewer" },
            "2026-10-02T08:00:00.000Z",
          ),
        ]),
      ).toEqual([]);
    });
  });

  describe("other entries", () => {
    it("skips non-message entries, unparseable lines, and assistant text", () => {
      expect(
        collect([
          JSON.stringify({ type: "session_info", name: "#935 TDD — x" }),
          "{not json",
          "",
          JSON.stringify({
            type: "message",
            timestamp: INSIDE,
            message: {
              role: "assistant",
              content: [{ type: "text", text: "# Plan a GitHub issue" }],
            },
          }),
        ]),
      ).toEqual([]);
    });
  });
});

describe("templateHeading", () => {
  it("returns the body's first H1, not one later in a fenced example", () => {
    const md =
      "---\ndescription: x\n---\n\n# Review session\n\n````markdown\n# Retro: #N\n````\n";
    expect(templateHeading(md)).toBe("# Review session");
  });

  it("skips a frontmatter line that looks like a heading", () => {
    expect(templateHeading("---\n# not a heading\n---\n\n# Real\n")).toBe(
      "# Real",
    );
  });

  it("returns an empty string when the body has no H1", () => {
    expect(templateHeading("---\ndescription: x\n---\n\n## Only H2\n")).toBe(
      "",
    );
  });

  it("yields a non-empty heading, unique across the set, for every real template", () => {
    const headings = readdirSync(PROMPTS_DIR)
      .filter((name) => name.endsWith(".md"))
      .map((name) =>
        templateHeading(readFileSync(path.join(PROMPTS_DIR, name), "utf8")),
      );
    expect(headings.length).toBeGreaterThan(0);
    expect(headings.filter((heading) => heading === "")).toEqual([]);
    expect(new Set(headings).size).toBe(headings.length);
    expect(
      templateHeading(readFileSync(path.join(PROMPTS_DIR, "retro.md"), "utf8")),
    ).toBe("# Review session and persist retro notes");
  });
});

describe("volumeRows", () => {
  const files = [
    { kind: "template", file: "plan-issue.md", key: "# Plan", words: 100 },
    { kind: "template", file: "ship.md", key: "# Ship", words: 50 },
    { kind: "agent", file: "reviewer.md", key: "reviewer", words: 30 },
  ];

  it("multiplies body words by invocations and sorts by volume, largest first", () => {
    const events = [
      { kind: "template", key: "# Ship" },
      { kind: "template", key: "# Ship" },
      { kind: "template", key: "# Ship" },
      { kind: "template", key: "# Plan" },
      { kind: "agent", key: "reviewer" },
    ];
    expect(volumeRows(files, events)).toEqual([
      {
        kind: "template",
        file: "ship.md",
        words: 50,
        invocations: 3,
        volume: 150,
      },
      {
        kind: "template",
        file: "plan-issue.md",
        words: 100,
        invocations: 1,
        volume: 100,
      },
      {
        kind: "agent",
        file: "reviewer.md",
        words: 30,
        invocations: 1,
        volume: 30,
      },
    ]);
  });

  it("drops events matching no file and reports never-invoked files at zero", () => {
    const events = [
      { kind: "template", key: "Why did step 3 do that?" },
      { kind: "agent", key: "Explore" },
      { kind: "agent", key: "# Plan" },
    ];
    expect(volumeRows(files, events)).toEqual([
      {
        kind: "template",
        file: "plan-issue.md",
        words: 100,
        invocations: 0,
        volume: 0,
      },
      {
        kind: "template",
        file: "ship.md",
        words: 50,
        invocations: 0,
        volume: 0,
      },
      {
        kind: "agent",
        file: "reviewer.md",
        words: 30,
        invocations: 0,
        volume: 0,
      },
    ]);
  });
});
