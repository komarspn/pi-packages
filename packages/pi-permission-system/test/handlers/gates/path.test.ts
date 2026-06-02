import { describe, expect, it } from "vitest";

import type { GateDescriptor } from "#src/handlers/gates/descriptor";
import { isGateDescriptor } from "#src/handlers/gates/descriptor";
import { describePathGate } from "#src/handlers/gates/path";
import type { ToolCallContext } from "#src/handlers/gates/types";

import {
  makeGateCheckResult as makeCheckResult,
  makeResolver,
} from "#test/helpers/gate-fixtures";

// ── helpers ────────────────────────────────────────────────────────────────

// path.test.ts uses read-tool defaults; the shared makeTcc uses bash defaults.
function makeTcc(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    toolName: "read",
    agentName: null,
    input: { path: ".env" },
    toolCallId: "tc-1",
    cwd: "/test/project",
    ...overrides,
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("describePathGate", () => {
  it("returns null for non-path-bearing tools", () => {
    const resolver = makeResolver();
    const result = describePathGate(
      makeTcc({ toolName: "bash", input: { command: "ls" } }),
      resolver,
    );
    expect(result).toBeNull();
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it("returns null when tool has no extractable path", () => {
    const resolver = makeResolver();
    const result = describePathGate(
      makeTcc({ toolName: "read", input: {} }),
      resolver,
    );
    expect(result).toBeNull();
  });

  it("returns null when path check result is allow", () => {
    const resolver = makeResolver(makeCheckResult({ state: "allow" }));
    const result = describePathGate(makeTcc(), resolver);
    expect(result).toBeNull();
  });

  it("returns null when matchedPattern is undefined (universal default)", () => {
    const resolver = makeResolver(
      makeCheckResult({
        state: "ask",
        matchedPattern: undefined,
        source: "special",
        origin: "builtin",
      }),
    );
    const result = describePathGate(makeTcc(), resolver);
    expect(result).toBeNull();
  });

  it("returns GateDescriptor when matchedPattern is defined (explicit path rule)", () => {
    const resolver = makeResolver(
      makeCheckResult({
        state: "ask",
        matchedPattern: "*.env",
        source: "special",
        origin: "global",
      }),
    );
    const result = describePathGate(makeTcc(), resolver);
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
  });

  it("returns GateDescriptor when path check result is deny", () => {
    const resolver = makeResolver(
      makeCheckResult({ state: "deny", matchedPattern: "*.env" }),
    );
    const result = describePathGate(makeTcc(), resolver);
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    const desc = result as GateDescriptor;
    expect(desc.surface).toBe("path");
    expect(desc.preCheck?.state).toBe("deny");
  });

  it("returns GateDescriptor when path check result is ask", () => {
    const resolver = makeResolver(
      makeCheckResult({ state: "ask", matchedPattern: "*.env" }),
    );
    const result = describePathGate(makeTcc(), resolver);
    expect(result).not.toBeNull();
    expect(isGateDescriptor(result)).toBe(true);
    const desc = result as GateDescriptor;
    expect(desc.surface).toBe("path");
    expect(desc.preCheck?.state).toBe("ask");
  });

  it("descriptor has correct session approval surface and pattern", () => {
    const resolver = makeResolver(
      makeCheckResult({ state: "ask", matchedPattern: "*" }),
    );
    const result = describePathGate(
      makeTcc({ input: { path: "/test/project/src/.env" } }),
      resolver,
    ) as GateDescriptor;
    expect(result.sessionApproval).toBeDefined();
    expect(result.sessionApproval?.surface).toBe("path");
    expect(result.sessionApproval?.representativePattern).toBeDefined();
  });

  it("descriptor denialContext references the file path and tool name", () => {
    const resolver = makeResolver(
      makeCheckResult({ state: "deny", matchedPattern: "*.env" }),
    );
    const result = describePathGate(makeTcc(), resolver) as GateDescriptor;
    expect(result.denialContext).toEqual({
      kind: "path",
      toolName: "read",
      pathValue: ".env",
      agentName: undefined,
    });
  });

  it("descriptor decision uses surface 'path' and the file path as value", () => {
    const resolver = makeResolver(
      makeCheckResult({ state: "deny", matchedPattern: "*.env" }),
    );
    const result = describePathGate(makeTcc(), resolver) as GateDescriptor;
    expect(result.decision.surface).toBe("path");
    expect(result.decision.value).toBe(".env");
  });

  it("resolves the path surface with the file path and agent name", () => {
    const resolver = makeResolver(makeCheckResult({ state: "allow" }));
    describePathGate(makeTcc({ agentName: "my-agent" }), resolver);
    expect(resolver.resolve).toHaveBeenCalledWith(
      "path",
      { path: ".env" },
      "my-agent",
    );
  });
});
