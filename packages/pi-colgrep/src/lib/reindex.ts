import type { Exec } from "./exec.js";

export type ReindexStatusCallback = (status: string | undefined) => void;

export interface ReindexerDeps {
  exec: Exec;
  cwd: string;
  onStatus: ReindexStatusCallback;
  /** Debounce quiet period before a scheduled reindex fires. Defaults to 4000 ms. */
  debounceMs?: number;
  /** Exec timeout for the reindex command. Defaults to 300 000 ms (5 min). */
  timeoutMs?: number;
}

export interface Reindexer {
  /** Schedule a debounced reindex. Safe to call repeatedly. */
  schedule(): void;
  /** Run a reindex immediately, bypassing debounce. Resolves when complete. */
  runNow(): Promise<void>;
  /** Cancel pending timers and wait for any in-flight reindex to finish. */
  shutdown(): Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 4_000;
const DEFAULT_TIMEOUT_MS = 300_000;
const INDEXING_STATUS = "colgrep: indexing\u2026";
const INDEXING_FAILED_STATUS = "colgrep: indexing failed";

export function createReindexer(deps: ReindexerDeps): Reindexer {
  const { exec, cwd, onStatus } = deps;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function runReindex(): Promise<void> {
    onStatus(INDEXING_STATUS);
    let failed = false;
    try {
      const result = await exec("colgrep", ["init", "-y", "."], {
        cwd,
        timeout: timeoutMs,
      });
      if (result.code !== 0) {
        failed = true;
        const detail = result.stderr.trim();
        console.error(
          `colgrep reindex failed: ${detail || `exit code ${result.code}`}`,
        );
      }
    } catch (err) {
      failed = true;
      console.error("colgrep reindex failed:", err);
    }
    if (failed) {
      onStatus(INDEXING_FAILED_STATUS);
    }
    onStatus(undefined);
  }

  return {
    async runNow(): Promise<void> {
      await runReindex();
    },
    schedule(): void {
      // Implemented in Cycle 3
    },
    async shutdown(): Promise<void> {
      // Implemented in Cycle 5
    },
  };
}
