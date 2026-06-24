import { describe, expect, it, vi } from "vitest";
import {
  createDeniedPermissionDecision,
  isPermissionDecisionState,
  normalizePermissionDenialReason,
  type PermissionDecisionUi,
  requestPermissionDecisionFromUi,
} from "#src/permission-dialog";

describe("isPermissionDecisionState", () => {
  it("accepts approved", () => {
    expect(isPermissionDecisionState("approved")).toBe(true);
  });

  it("accepts denied", () => {
    expect(isPermissionDecisionState("denied")).toBe(true);
  });

  it("accepts denied_with_reason", () => {
    expect(isPermissionDecisionState("denied_with_reason")).toBe(true);
  });

  it("accepts approved_for_session", () => {
    expect(isPermissionDecisionState("approved_for_session")).toBe(true);
  });

  it("accepts approved_for_project", () => {
    expect(isPermissionDecisionState("approved_for_project")).toBe(true);
  });

  it("accepts approved_globally", () => {
    expect(isPermissionDecisionState("approved_globally")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isPermissionDecisionState("unknown")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isPermissionDecisionState(42)).toBe(false);
    expect(isPermissionDecisionState(null)).toBe(false);
  });
});

describe("requestPermissionDecisionFromUi", () => {
  it("returns approved when user selects Yes", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("Yes"),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: true, state: "approved" });
  });

  it("returns approved_for_session when user selects session option", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("Yes, for this session"),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: true, state: "approved_for_session" });
  });

  it("returns approved_for_project when user selects project option", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("Yes, always for this project"),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: true, state: "approved_for_project" });
  });

  it("returns approved_globally when user selects all-projects option", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("Yes, always for all projects"),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: true, state: "approved_globally" });
  });

  it("returns denied when user selects No", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("No"),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: false, state: "denied" });
  });

  it("returns denied_with_reason when user provides reason", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("No, provide reason"),
      input: vi.fn().mockResolvedValue("not now"),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({
      approved: false,
      state: "denied_with_reason",
      denialReason: "not now",
    });
  });

  it("returns denied when user selects deny-with-reason but gives empty input", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue("No, provide reason"),
      input: vi.fn().mockResolvedValue(""),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: false, state: "denied" });
  });

  it("returns denied when user dismisses dialog (undefined)", async () => {
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue(undefined),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
    );
    expect(result).toEqual({ approved: false, state: "denied" });
  });

  it("passes six options to ui.select", async () => {
    const selectFn = vi.fn().mockResolvedValue("Yes");
    const ui: PermissionDecisionUi = {
      select: selectFn,
      input: vi.fn(),
    };
    await requestPermissionDecisionFromUi(ui, "Title", "Message");
    const options = selectFn.mock.calls[0][1] as string[];
    expect(options).toEqual([
      "Yes",
      "Yes, for this session",
      "Yes, always for this project",
      "Yes, always for all projects",
      "No",
      "No, provide reason",
    ]);
  });

  it("uses custom sessionLabel when provided", async () => {
    const selectFn = vi.fn().mockResolvedValue("Yes");
    const ui: PermissionDecisionUi = {
      select: selectFn,
      input: vi.fn(),
    };
    await requestPermissionDecisionFromUi(ui, "Title", "Message", {
      sessionLabel: 'Yes, allow "git *" for this session',
    });
    const options = selectFn.mock.calls[0][1] as string[];
    expect(options[1]).toBe('Yes, allow "git *" for this session');
  });

  it("still returns approved_for_session when user selects the custom session label", async () => {
    const customLabel = 'Yes, allow "git *" for this session';
    const ui: PermissionDecisionUi = {
      select: vi.fn().mockResolvedValue(customLabel),
      input: vi.fn(),
    };
    const result = await requestPermissionDecisionFromUi(
      ui,
      "Title",
      "Message",
      { sessionLabel: customLabel },
    );
    expect(result).toEqual({ approved: true, state: "approved_for_session" });
  });

  it("falls back to default session label when no options provided", async () => {
    const selectFn = vi.fn().mockResolvedValue("Yes");
    const ui: PermissionDecisionUi = {
      select: selectFn,
      input: vi.fn(),
    };
    await requestPermissionDecisionFromUi(ui, "Title", "Message");
    const options = selectFn.mock.calls[0][1] as string[];
    expect(options[1]).toBe("Yes, for this session");
  });
});

describe("normalizePermissionDenialReason", () => {
  it("returns trimmed string for non-empty input", () => {
    expect(normalizePermissionDenialReason("  reason  ")).toBe("reason");
  });

  it("returns undefined for empty string", () => {
    expect(normalizePermissionDenialReason("")).toBeUndefined();
  });

  it("returns undefined for non-string", () => {
    expect(normalizePermissionDenialReason(42)).toBeUndefined();
  });
});

describe("createDeniedPermissionDecision", () => {
  it("returns denied_with_reason when reason provided", () => {
    expect(createDeniedPermissionDecision("nope")).toEqual({
      approved: false,
      state: "denied_with_reason",
      denialReason: "nope",
    });
  });

  it("returns denied when no reason", () => {
    expect(createDeniedPermissionDecision()).toEqual({
      approved: false,
      state: "denied",
    });
  });
});
