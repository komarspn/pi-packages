import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLayeredSettings } from "#src/layered-settings";

interface TestConfig {
  name?: string;
  count?: number;
}

function sanitize(raw: unknown): Partial<TestConfig> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<TestConfig> = {};
  if (typeof r.name === "string") out.name = r.name;
  if (typeof r.count === "number") out.count = r.count;
  return out;
}

describe("loadLayeredSettings", () => {
  let agentDir: string;
  let cwd: string;

  const FILENAME = "test-settings.json";

  const globalFile = () => join(agentDir, FILENAME);
  const projectFile = () => join(cwd, ".pi", FILENAME);

  beforeEach(() => {
    agentDir = mkdtempSync(join(tmpdir(), "pi-layered-global-"));
    cwd = mkdtempSync(join(tmpdir(), "pi-layered-project-"));
  });

  afterEach(() => {
    rmSync(agentDir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  function writeGlobal(obj: unknown) {
    writeFileSync(globalFile(), JSON.stringify(obj));
  }

  function writeProject(obj: unknown) {
    mkdirSync(join(cwd, ".pi"), { recursive: true });
    writeFileSync(projectFile(), JSON.stringify(obj));
  }

  function load() {
    return loadLayeredSettings<TestConfig>({ agentDir, cwd, filename: FILENAME, sanitize, warnLabel: "test-pkg" });
  }

  describe("missing files", () => {
    it("returns {} when both files are absent", () => {
      expect(load()).toEqual({});
    });

    it("does not warn when files are simply missing", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        load();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("single-layer loading", () => {
    it("loads from global when no project file", () => {
      writeGlobal({ name: "global", count: 10 });
      expect(load()).toEqual({ name: "global", count: 10 });
    });

    it("loads from project when no global file", () => {
      writeProject({ name: "project" });
      expect(load()).toEqual({ name: "project" });
    });
  });

  describe("project overrides global", () => {
    it("merges global + project with project winning on conflicts", () => {
      writeGlobal({ name: "global", count: 10 });
      writeProject({ name: "project", count: 20 });
      expect(load()).toEqual({ name: "project", count: 20 });
    });

    it("keeps global keys not overridden by project", () => {
      writeGlobal({ name: "global", count: 10 });
      writeProject({ count: 99 });
      expect(load()).toEqual({ name: "global", count: 99 });
    });
  });

  describe("sanitize applied to parsed JSON", () => {
    it("passes parsed JSON through sanitize", () => {
      writeGlobal({ name: "valid", extraField: "ignored" });
      expect(load()).toEqual({ name: "valid" });
    });

    it("returns {} when global file contains valid JSON but fails sanitize", () => {
      writeGlobal({ unrecognised: true });
      expect(load()).toEqual({});
    });
  });

  describe("custom filename", () => {
    it("resolves global file as <agentDir>/<filename>", () => {
      // Only the global file exists — proves path is <agentDir>/test-settings.json
      writeGlobal({ count: 7 });
      expect(load()).toEqual({ count: 7 });
    });

    it("resolves project file as <cwd>/.pi/<filename>", () => {
      // Only the project file exists — proves path is <cwd>/.pi/test-settings.json
      writeProject({ count: 42 });
      expect(load()).toEqual({ count: 42 });
    });
  });

  describe("malformed files", () => {
    it("returns {} and warns when global file is malformed JSON", () => {
      writeFileSync(globalFile(), "not valid {{{{");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(load()).toEqual({});
        expect(spy).toHaveBeenCalledTimes(1);
        expect(String(spy.mock.calls[0][0])).toMatch(/\[test-pkg\]/);
        expect(String(spy.mock.calls[0][0])).toMatch(/Ignoring malformed settings/);
      } finally {
        spy.mockRestore();
      }
    });

    it("returns {} and warns when project file is malformed JSON", () => {
      mkdirSync(join(cwd, ".pi"), { recursive: true });
      writeFileSync(projectFile(), "also invalid {{{");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(load()).toEqual({});
        expect(spy).toHaveBeenCalledTimes(1);
        expect(String(spy.mock.calls[0][0])).toMatch(/\[test-pkg\]/);
        expect(String(spy.mock.calls[0][0])).toMatch(/Ignoring malformed settings/);
      } finally {
        spy.mockRestore();
      }
    });

    it("warns once per bad file (two malformed files → two warnings)", () => {
      writeFileSync(globalFile(), "bad1");
      mkdirSync(join(cwd, ".pi"), { recursive: true });
      writeFileSync(projectFile(), "bad2");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(load()).toEqual({});
        expect(spy).toHaveBeenCalledTimes(2);
      } finally {
        spy.mockRestore();
      }
    });

    it("uses global when project file is malformed (global is valid)", () => {
      writeGlobal({ name: "global" });
      mkdirSync(join(cwd, ".pi"), { recursive: true });
      writeFileSync(projectFile(), "invalid");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(load()).toEqual({ name: "global" });
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("warnLabel used in warning message", () => {
    it("includes warnLabel in the warning prefix", () => {
      writeFileSync(globalFile(), "bad");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        loadLayeredSettings<TestConfig>({
          agentDir,
          cwd,
          filename: FILENAME,
          sanitize,
          warnLabel: "my-custom-pkg",
        });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(String(spy.mock.calls[0][0])).toMatch(/\[my-custom-pkg\]/);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
