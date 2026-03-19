import type { GraderResult, TestCase, PageRole } from '../types.js';
import { gradeCompleteness, type CompletenessOptions } from './completeness.js';
import { gradeCitations } from './citations.js';
import { gradeAccuracy, type CitationManifest } from './accuracy.js';
import { gradeEditorial } from './editorial.js';
import { gradeCrossRef } from './cross-ref.js';
import { gradeReference } from './reference.js';
import { gradeToolUsage } from './tool-usage.js';
import { gradeIntegration } from './integration.js';
import { gradeSourceCriticism } from './source-criticism.js';

export interface GraderOptions {
  /** Skip LLM-assisted graders (accuracy, structure, cross-ref) */
  ruleBasedOnly?: boolean;
  /** Page role — controls which checks run */
  role?: PageRole;
  /** Subject name for cross-link checks */
  subject?: string;
  /** Expected episode titles for cross-link checks */
  expectedEpisodes?: string[];
  /** Known-good reference wikitext to compare against */
  referenceWikitext?: string;
  /** Vault path for citation-based accuracy verification */
  vault?: { vaultPath: string };
  /** Agent session transcript for tool-usage grading */
  log?: string;
  /** Agent-produced citation manifest for accuracy grading */
  manifest?: CitationManifest;
  /** Page wikitext before this checkpoint (for integration grading) */
  previousWikitext?: string;
  /** Checkpoint ID for context-aware completeness thresholds */
  checkpointId?: string;
  /** Skip the reference grader for this checkpoint */
  skipReference?: boolean;
  /** Talk page wikitext for integration grading (so the judge can verify discrepancy notes) */
  talkWikitext?: string;
  /** Run only these graders (by name). When set, all others are skipped. */
  graderFilter?: string[];
}

export async function runGraders(
  wikitext: string,
  testCase: TestCase,
  sourceData: string,
  options: GraderOptions = {},
): Promise<GraderResult[]> {
  const results: GraderResult[] = [];
  const role = options.role ?? 'person';
  const filter = options.graderFilter;
  const shouldRun = (name: string) => !filter || filter.includes(name);

  const completenessOpts: CompletenessOptions = {
    role,
    subject: options.subject ?? testCase.subject,
    expectedEpisodes: options.expectedEpisodes ?? testCase.expectedEpisodes,
    checkpointId: options.checkpointId,
  };

  // Completeness always runs (with role-aware checks)
  if (shouldRun('completeness')) {
    results.push(gradeCompleteness(wikitext, completenessOpts));
  }

  // Source pages: completeness + reference + source-criticism
  if (role === 'source') {
    if (shouldRun('reference') && options.referenceWikitext && !options.skipReference) {
      results.push(gradeReference(wikitext, options.referenceWikitext, role));
    }
    if (shouldRun('source-criticism') && !options.ruleBasedOnly) {
      results.push(await gradeSourceCriticism(wikitext));
    }
    return results;
  }

  // Talk pages: completeness + reference + editorial
  if (role === 'talk') {
    if (shouldRun('reference') && options.referenceWikitext && !options.skipReference) {
      results.push(gradeReference(wikitext, options.referenceWikitext, role));
    }
    if (shouldRun('editorial') && !options.ruleBasedOnly) {
      results.push(await gradeEditorial(wikitext, 'talk'));
    }
    return results;
  }

  // Rule-based graders for person/episode
  if (shouldRun('citations')) {
    results.push(gradeCitations(wikitext));
  }

  // Tool-usage grader (rule-based, needs agent log)
  if (shouldRun('tool-usage') && options.log) {
    results.push(gradeToolUsage(options.log));
  }

  // Reference comparison when available (skip when flagged)
  if (shouldRun('reference') && options.referenceWikitext && !options.skipReference) {
    results.push(gradeReference(wikitext, options.referenceWikitext, role));
  }

  if (!options.ruleBasedOnly) {
    // LLM-assisted graders (accuracy only when manifest available — too unreliable without it)
    if (shouldRun('accuracy') && options.manifest) {
      results.push(await gradeAccuracy(wikitext, { vault: options.vault, sourceData, manifest: options.manifest }));
    }
    if (shouldRun('editorial')) {
      results.push(await gradeEditorial(wikitext, role === 'episode' ? 'episode' : role === 'project' ? 'project' : 'person'));
    }
    if (shouldRun('cross-ref')) {
      results.push(await gradeCrossRef(wikitext, testCase));
    }

    // Integration grader: only when previous wikitext available and content changed
    if (shouldRun('integration') && options.previousWikitext && options.previousWikitext !== wikitext) {
      results.push(await gradeIntegration(options.previousWikitext, wikitext, options.talkWikitext));
    }
  }

  return results;
}

/**
 * Grader weight tiers:
 * - Quality (reference, accuracy): 50% — measures actual content quality
 * - Content (completeness, structure): 30% — measures page structure and depth
 * - Mechanics (citations, cross-ref, tool-usage): 20% — measures technical correctness
 *
 * Within each tier, weight is split equally among present graders.
 * If an entire tier is absent, its weight redistributes proportionally.
 */
const GRADER_TIERS: Record<string, 'quality' | 'content' | 'mechanics'> = {
  reference: 'quality',
  accuracy: 'quality',
  completeness: 'content',
  editorial: 'content',
  integration: 'content',
  'source-criticism': 'content',
  citations: 'mechanics',
  'cross-ref': 'mechanics',
  'tool-usage': 'mechanics',
};

const TIER_WEIGHTS: Record<string, number> = {
  quality: 0.5,
  content: 0.3,
  mechanics: 0.2,
};

export function computeComposite(results: GraderResult[]): number {
  const scored = results.filter((r) => !r.skipped);
  if (scored.length === 0) return 0;

  // Group scored graders by tier
  const tiers = new Map<string, GraderResult[]>();
  for (const r of scored) {
    const tier = GRADER_TIERS[r.grader] ?? 'mechanics';
    const group = tiers.get(tier);
    if (group) group.push(r);
    else tiers.set(tier, [r]);
  }

  // Calculate total weight of present tiers for redistribution
  let presentWeight = 0;
  for (const [tier] of tiers) {
    presentWeight += TIER_WEIGHTS[tier] ?? 0;
  }

  if (presentWeight === 0) return 0;

  let composite = 0;
  for (const [tier, graders] of tiers) {
    const tierWeight = (TIER_WEIGHTS[tier] ?? 0) / presentWeight;
    const tierAvg = graders.reduce((sum, r) => sum + r.score, 0) / graders.length;
    composite += tierAvg * tierWeight;
  }

  return Math.round(composite * 1000) / 1000;
}

export { gradeCompleteness } from './completeness.js';
export type { CompletenessOptions } from './completeness.js';
export { gradeCitations, parseCitations, findUncitedClaims } from './citations.js';
export { gradeAccuracy } from './accuracy.js';
export { gradeEditorial } from './editorial.js';
export { gradeCrossRef } from './cross-ref.js';
export { gradeReference } from './reference.js';
export { gradeToolUsage } from './tool-usage.js';
export { gradeIntegration } from './integration.js';
export { gradeSourceCriticism } from './source-criticism.js';
