export interface TestCase {
  id: string;
  suite: 'incremental';
  description: string;
  pageType: 'Person' | 'Episode' | 'Project';
  sources: SourceRef[];
  reference?: string;
  turns?: FeedbackTurn[];
  expectedCrossRefs?: number;
  /** Expected primary page title */
  subject?: string;
  /** Episode page titles the reference solution includes */
  expectedEpisodes?: string[];
  /** Map of page title (or glob like Source:whatsapp/*) to reference wikitext file path relative to fixture dir */
  references?: Record<string, string>;
  /** Minimum checkpoint 1 composite to proceed to checkpoint 2 (default 0.7) */
  checkpointThreshold?: number;
  /** Incremental checkpoint specifications (used by suite: 'incremental') */
  checkpoints?: CheckpointSpec[];
  /** Content page weights for composite scoring. Source pages always use a separate 20/80 split. */
  weights?: ContentWeights;
}

export interface ContentWeights {
  /** Weight for the primary content page (person or episode). Default: 0.85 (no episodes) or 0.5 (with episodes). */
  primary: number;
  /** Weight for episode pages. Default: 0 (no episodes) or 0.4 (with episodes). */
  episodes: number;
  /** Weight for the talk page. Default: 0.15 (no episodes) or 0.1 (with episodes). */
  talk: number;
  /** Fraction of overall composite from source pages (rest goes to content). Default: 0.2. */
  source?: number;
}

export interface GradeTarget {
  /** Page title pattern, e.g. "Source:Instagram/*", "Alex Chen", "Talk:Alex Chen" */
  pattern: string;
  /** Determines which graders run against matched pages */
  role: PageRole;
}

export interface CheckpointSpec {
  /** Checkpoint identifier, e.g. "inventory", "survey", "skeleton" */
  id: string;
  /** Task description given to the agent for this checkpoint */
  description: string;
  /** New sources to introduce at this checkpoint */
  sources?: SourceRef[];
  /** Pages to grade after this checkpoint completes */
  grade: GradeTarget[];
  /** Optional gate score — stop the run if the checkpoint composite is below this */
  threshold?: number;
  /** If true, look for a citation manifest uploaded by the agent and use it for accuracy grading */
  produceManifest?: boolean;
  /** Path to owner anecdotes JSON file (relative to fixture dir) */
  ownerInput?: string;
  /** Skip the reference grader for this checkpoint (unfair when not all sources available) */
  skipReference?: boolean;
}

export type PageRole = 'person' | 'episode' | 'project' | 'talk' | 'source';

export interface PageResult {
  title: string;
  role: PageRole;
  wikitext: string;
  scores: GraderResult[];
  composite: number;
}

export interface SourceRef {
  path: string;
  type: string;
  snapshotId: string;
}

export interface FeedbackTurn {
  feedback: string;
}

export interface GraderResult {
  grader: string;
  score: number;
  skipped?: boolean;
  details: GraderCheck[];
}

export interface GraderCheck {
  check: string;
  passed: boolean;
  penalty: number;
  note?: string;
}

export interface CheckpointResult {
  checkpoint: number;
  stage: string;
  pages: PageResult[];
  composite: number;
  passed: boolean;
  threshold: number;
  /** Wall-clock duration of this checkpoint in milliseconds */
  durationMs?: number;
}

export interface EvalResult {
  caseId: string;
  suite: string;
  harness: string;
  model: string;
  /** Primary page wikitext (backward compat) */
  output: string;
  /** Primary page scores (backward compat) */
  scores: GraderResult[];
  composite: number;
  timestamp: string;
  /** Per-page breakdown when multi-page grading is used */
  pages?: PageResult[];
  /** Checkpoint results when checkpoint grading is used */
  checkpoints?: CheckpointResult[];
  /** Wall-clock duration of the full eval run in milliseconds */
  durationMs?: number;
  /** Agent session transcript / tool call log */
  log?: string;
}