import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EXTENSION_ID,
  getGlobalConfigPath,
  getProjectConfigPath,
  loadConfig,
  loadSingleConfig,
  normalizeConfig,
} from "#src/lib/config";

describe("getGlobalConfigPath", () => {
  it("constructs the expected path", () => {
    expect(getGlobalConfigPath("/home/user/.pi")).toBe(
      `/home/user/.pi/extensions/${EXTENSION_ID}/config.json`,
    );
  });
});

describe("getProjectConfigPath", () => {
  it("constructs the expected path", () => {
    expect(getProjectConfigPath("/my/project")).toBe(
      `/my/project/.pi/extensions/${EXTENSION_ID}/config.json`,
    );
  });
});

describe("normalizeConfig", () => {
  it("returns empty config for non-object input", () => {
    expect(normalizeConfig(null)).toEqual({});
    expect(normalizeConfig("string")).toEqual({});
    expect(normalizeConfig(42)).toEqual({});
    expect(normalizeConfig([])).toEqual({});
  });

  it("returns empty config when defaultMergeMethod is absent", () => {
    expect(normalizeConfig({})).toEqual({});
  });

  it.each([
    "rebase",
    "squash",
    "merge",
  ] as const)('accepts "%s" as a valid defaultMergeMethod', (method) => {
    expect(normalizeConfig({ defaultMergeMethod: method })).toEqual({
      defaultMergeMethod: method,
    });
  });

  it("ignores invalid defaultMergeMethod values", () => {
    expect(normalizeConfig({ defaultMergeMethod: "fast-forward" })).toEqual({});
    expect(normalizeConfig({ defaultMergeMethod: 42 })).toEqual({});
  });

  it("ignores unknown keys", () => {
    expect(
      normalizeConfig({ defaultMergeMethod: "squash", unknown: true }),
    ).toEqual({ defaultMergeMethod: "squash" });
  });
});

describe("loadSingleConfig", () => {
  const tmpFiles: string[] = [];

  function writeTmp(content: string): string {
    const path = join(
      tmpdir(),
      `pi-github-tools-test-${Date.now()}-${Math.random()}.json`,
    );
    writeFileSync(path, content);
    tmpFiles.push(path);
    return path;
  }

  afterEach(() => {
    for (const f of tmpFiles) {
      try {
        unlinkSync(f);
      } catch {}
    }
    tmpFiles.length = 0;
  });

  it("returns empty config when file does not exist", () => {
    expect(loadSingleConfig("/nonexistent/path/config.json")).toEqual({});
  });

  it("loads a valid config from file", () => {
    const path = writeTmp(JSON.stringify({ defaultMergeMethod: "squash" }));
    expect(loadSingleConfig(path)).toEqual({ defaultMergeMethod: "squash" });
  });

  it("returns empty config when file contains invalid JSON", () => {
    const path = writeTmp("not valid json {{{");
    expect(loadSingleConfig(path)).toEqual({});
  });

  it("returns empty config when file contains an invalid value", () => {
    const path = writeTmp(JSON.stringify({ defaultMergeMethod: "invalid" }));
    expect(loadSingleConfig(path)).toEqual({});
  });
});

describe("loadConfig", () => {
  const tmpFiles: string[] = [];

  function writeTmp(content: object): string {
    const path = join(
      tmpdir(),
      `pi-github-tools-test-${Date.now()}-${Math.random()}.json`,
    );
    writeFileSync(path, JSON.stringify(content));
    tmpFiles.push(path);
    return path;
  }

  afterEach(() => {
    for (const f of tmpFiles) {
      try {
        unlinkSync(f);
      } catch {}
    }
    tmpFiles.length = 0;
  });

  it("returns empty config when both files are missing", () => {
    expect(
      loadConfig({
        globalConfigPath: "/nonexistent",
        projectConfigPath: "/nonexistent",
      }),
    ).toEqual({});
  });

  it("loads from global config when project config is missing", () => {
    const global = writeTmp({ defaultMergeMethod: "squash" });
    expect(
      loadConfig({
        globalConfigPath: global,
        projectConfigPath: "/nonexistent",
      }),
    ).toEqual({ defaultMergeMethod: "squash" });
  });

  it("loads from project config when global config is missing", () => {
    const project = writeTmp({ defaultMergeMethod: "squash" });
    expect(
      loadConfig({
        globalConfigPath: "/nonexistent",
        projectConfigPath: project,
      }),
    ).toEqual({ defaultMergeMethod: "squash" });
  });

  it("project config overrides global config", () => {
    const global = writeTmp({ defaultMergeMethod: "squash" });
    const project = writeTmp({ defaultMergeMethod: "merge" });
    expect(
      loadConfig({ globalConfigPath: global, projectConfigPath: project }),
    ).toEqual({ defaultMergeMethod: "merge" });
  });
});
