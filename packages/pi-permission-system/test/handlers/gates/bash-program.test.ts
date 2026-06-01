import { describe, expect, it } from "vitest";

import { BashProgram } from "#src/handlers/gates/bash-program";

describe("BashProgram", () => {
  describe("pathTokens", () => {
    it("returns dot-files and relative path tokens", async () => {
      const program = await BashProgram.parse("cat .env src/foo.ts");
      expect(program.pathTokens()).toEqual([".env", "src/foo.ts"]);
    });

    it("returns an empty array when there are no path tokens", async () => {
      const program = await BashProgram.parse("echo hello");
      expect(program.pathTokens()).toEqual([]);
    });

    it("deduplicates repeated tokens across a command chain", async () => {
      const program = await BashProgram.parse("cat .env && rm .env");
      expect(program.pathTokens()).toEqual([".env"]);
    });
  });

  describe("externalPaths", () => {
    const cwd = "/projects/my-app";

    it("returns absolute paths resolving outside cwd", async () => {
      const program = await BashProgram.parse("cat /etc/hosts");
      // Subset matcher: the path is normalized before comparison.
      expect(program.externalPaths(cwd)).toContain("/etc/hosts");
    });

    it("excludes paths within cwd", async () => {
      const program = await BashProgram.parse("cat src/index.ts");
      expect(program.externalPaths(cwd)).toHaveLength(0);
    });
  });

  it("derives both slices from a single parse", async () => {
    const program = await BashProgram.parse("cat .env /etc/hosts");
    expect(program.pathTokens()).toEqual([".env", "/etc/hosts"]);
    const external = program.externalPaths("/projects/my-app");
    expect(external).toContain("/etc/hosts");
    expect(external).not.toContain(".env");
  });
});
