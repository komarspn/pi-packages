/**
 * agent-record.ts — AgentRecord class with encapsulated status-transition logic.
 *
 * Status transitions (status, result, error, startedAt, completedAt) are owned
 * by the class and exposed via transition methods. External code reads these
 * fields through public properties but cannot write them directly.
 *
 * Non-transition state (session, toolUses, lifetimeUsage, etc.) remains public.
 */

import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentInvocation, SubagentType } from "./types.js";
import type { LifetimeUsage } from "./usage.js";

export type AgentRecordStatus =
	| "queued"
	| "running"
	| "completed"
	| "steered"
	| "aborted"
	| "stopped"
	| "error";

export interface AgentRecordInit {
	id: string;
	type: SubagentType;
	description: string;
	status?: AgentRecordStatus;
	startedAt?: number;
	completedAt?: number;
	result?: string;
	error?: string;
	toolUses?: number;
	lifetimeUsage?: LifetimeUsage;
	compactionCount?: number;
	abortController?: AbortController;
	invocation?: AgentInvocation;
	session?: AgentSession;
	promise?: Promise<string>;
	resultConsumed?: boolean;
	pendingSteers?: string[];
	worktree?: { path: string; branch: string };
	worktreeResult?: { hasChanges: boolean; branch?: string };
	toolCallId?: string;
	outputFile?: string;
}

export class AgentRecord {
	// Identity — set once at construction
	readonly id: string;
	readonly type: SubagentType;
	readonly description: string;
	readonly invocation?: AgentInvocation;

	// Transition state — public for now (encapsulated in cycle 6)
	status: AgentRecordStatus;
	result?: string;
	error?: string;
	startedAt: number;
	completedAt?: number;

	// Non-transition mutable state
	toolUses: number;
	lifetimeUsage: LifetimeUsage;
	compactionCount: number;
	session?: AgentSession;
	abortController?: AbortController;
	promise?: Promise<string>;
	resultConsumed?: boolean;
	pendingSteers?: string[];
	worktree?: { path: string; branch: string };
	worktreeResult?: { hasChanges: boolean; branch?: string };
	toolCallId?: string;
	outputFile?: string;

	constructor(init: AgentRecordInit) {
		this.id = init.id;
		this.type = init.type;
		this.description = init.description;
		this.invocation = init.invocation;

		this.status = init.status ?? "queued";
		this.result = init.result;
		this.error = init.error;
		this.startedAt = init.startedAt ?? Date.now();
		this.completedAt = init.completedAt;

		this.toolUses = init.toolUses ?? 0;
		this.lifetimeUsage = init.lifetimeUsage ?? { input: 0, output: 0, cacheWrite: 0 };
		this.compactionCount = init.compactionCount ?? 0;
		this.abortController = init.abortController;
		this.session = init.session;
		this.promise = init.promise;
		this.resultConsumed = init.resultConsumed;
		this.pendingSteers = init.pendingSteers;
		this.worktree = init.worktree;
		this.worktreeResult = init.worktreeResult;
		this.toolCallId = init.toolCallId;
		this.outputFile = init.outputFile;
	}

	/** Transition to running state. Sets status and startedAt. */
	markRunning(startedAt: number): void {
		this.status = "running";
		this.startedAt = startedAt;
	}

	/**
	 * Transition to completed state.
	 * Always sets result and completedAt (??=). Only changes status if not stopped.
	 */
	markCompleted(result: string, completedAt?: number): void {
		this.result = result;
		this.completedAt ??= completedAt ?? Date.now();
		if (this.status !== "stopped") {
			this.status = "completed";
		}
	}

	/**
	 * Transition to aborted state.
	 * Always sets result and completedAt (??=). Only changes status if not stopped.
	 */
	markAborted(result: string, completedAt?: number): void {
		this.result = result;
		this.completedAt ??= completedAt ?? Date.now();
		if (this.status !== "stopped") {
			this.status = "aborted";
		}
	}

	/**
	 * Transition to steered state.
	 * Always sets result and completedAt (??=). Only changes status if not stopped.
	 */
	markSteered(result: string, completedAt?: number): void {
		this.result = result;
		this.completedAt ??= completedAt ?? Date.now();
		if (this.status !== "stopped") {
			this.status = "steered";
		}
	}

	/**
	 * Transition to error state.
	 * Always sets error (formatted) and completedAt (??=). Only changes status if not stopped.
	 */
	markError(error: unknown, completedAt?: number): void {
		this.error = error instanceof Error ? error.message : String(error);
		this.completedAt ??= completedAt ?? Date.now();
		if (this.status !== "stopped") {
			this.status = "error";
		}
	}

	/** Transition to stopped state. Always valid — no guard. */
	markStopped(completedAt?: number): void {
		this.status = "stopped";
		this.completedAt = completedAt ?? Date.now();
	}

	/** Reset for resume: running status, new startedAt, clear completedAt/result/error. */
	resetForResume(startedAt: number): void {
		this.status = "running";
		this.startedAt = startedAt;
		this.completedAt = undefined;
		this.result = undefined;
		this.error = undefined;
	}
}
