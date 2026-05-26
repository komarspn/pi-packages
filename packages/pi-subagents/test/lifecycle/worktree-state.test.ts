import { describe, expect, it, vi } from "vitest";
import type { WorktreeCleanupResult, WorktreeManager } from "#src/lifecycle/worktree";
import { WorktreeState } from "#src/lifecycle/worktree-state";

describe("WorktreeState — constructor", () => {
	it("stores path and branch from WorktreeInfo", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		expect(state.path).toBe("/tmp/agent-1");
		expect(state.branch).toBe("pi-agent-1");
	});

	it("cleanupResult is undefined before recordCleanup", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		expect(state.cleanupResult).toBeUndefined();
	});
});

describe("WorktreeState — recordCleanup", () => {
	it("stores the cleanup result", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		state.recordCleanup({ hasChanges: true, branch: "pi-agent-1" });
		expect(state.cleanupResult).toEqual({ hasChanges: true, branch: "pi-agent-1" });
	});

	it("stores no-changes cleanup result", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		state.recordCleanup({ hasChanges: false });
		expect(state.cleanupResult).toEqual({ hasChanges: false });
	});

	it("path and branch remain unchanged after recordCleanup", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		state.recordCleanup({ hasChanges: true, branch: "pi-agent-1" });
		expect(state.path).toBe("/tmp/agent-1");
		expect(state.branch).toBe("pi-agent-1");
	});
});

describe("WorktreeState — performCleanup", () => {
	function makeWorktrees(result: WorktreeCleanupResult = { hasChanges: false }): WorktreeManager {
		return {
			create: vi.fn(),
			cleanup: vi.fn(() => result),
			prune: vi.fn(),
		};
	}

	it("calls worktrees.cleanup with self and description", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		const worktrees = makeWorktrees();
		state.performCleanup(worktrees, "my task");
		expect(worktrees.cleanup).toHaveBeenCalledOnce();
		expect(worktrees.cleanup).toHaveBeenCalledWith(state, "my task");
	});

	it("records the cleanup result", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		const worktrees = makeWorktrees({ hasChanges: true, branch: "pi-agent-1" });
		state.performCleanup(worktrees, "my task");
		expect(state.cleanupResult).toEqual({ hasChanges: true, branch: "pi-agent-1" });
	});

	it("returns the cleanup result", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		const worktrees = makeWorktrees({ hasChanges: false });
		const result = state.performCleanup(worktrees, "my task");
		expect(result).toEqual({ hasChanges: false });
	});

	it("cleanupResult is undefined before performCleanup", () => {
		const state = new WorktreeState({ path: "/tmp/agent-1", branch: "pi-agent-1" });
		expect(state.cleanupResult).toBeUndefined();
	});
});
