import type { TestCase, CheckpointSpec } from '../types.js';

export interface HarnessRunOptions {
  phase?: 'source' | 'content';
  /** Incremental checkpoint specification */
  checkpoint?: CheckpointSpec;
  /** Zero-based index of the current checkpoint in the sequence */
  checkpointIndex?: number;
  /** Titles of pages already in the wiki from prior checkpoints */
  priorPages?: string[];
  /** Session ID from a previous run — harness may resume the session instead of starting fresh */
  sessionId?: string;
  /** Working directory from a previous run — reused when resuming a session */
  cwd?: string;
  /** Owner-provided anecdotes/corrections to include in the prompt */
  ownerInput?: unknown[];
  /** Per-checkpoint timeout in milliseconds (default: 30 minutes) */
  timeoutMs?: number;
}

export interface HarnessResult {
  output: string;
  /** Agent session transcript / tool call log */
  log: string;
  /** Actual model used by the harness (resolved from default if not specified) */
  model?: string;
  /** Session ID for resuming this session in a subsequent run */
  sessionId?: string;
  /** Working directory used by this run */
  cwd?: string;
}

export interface Harness {
  name: string;
  run(task: TestCase, env: Record<string, string | undefined>, options?: HarnessRunOptions): Promise<HarnessResult>;
}
