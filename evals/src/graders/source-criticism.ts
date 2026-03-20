import type { GraderResult, GraderCheck } from '../types.js';
import type { RubricEvaluation } from '../llm.js';
import { evaluateWithRubric } from '../llm.js';

const SOURCE_CRITICISM_RUBRIC = `
Evaluate whether this source page includes critical assessment beyond raw statistics.

1. CRITICAL_ASSESSMENT (deduction: -0.15 each, cap -0.5)
   - Notes platform limitations (what this source can/cannot tell us)
   - Identifies gaps in coverage (date ranges, missing threads, deleted messages)
   - Assesses data quality (encrypted content, media not exported)
   - Distinguishes metadata from content

2. DOCUMENTATION_QUALITY (deduction: -0.1 each)
   - Has querying instructions (SQL recipes, key tables)
   - Includes top conversations or content breakdown
   - Notes date range and volume statistics
`;

const CAPS: Record<string, number> = {
  critical_assessment: 0.5,
};

const SOURCE_CRITICISM_PASSES = 2;

function scoreEvaluation(evaluation: RubricEvaluation): { score: number; details: GraderCheck[] } {
  const categoryTotals = new Map<string, number>();
  let score = 1.0;

  const details = evaluation.deductions.map((d) => {
    const cat = d.category.toLowerCase();
    const cap = CAPS[cat];
    let appliedPenalty = Math.max(0, d.penalty);

    if (cap !== undefined) {
      const current = categoryTotals.get(cat) ?? 0;
      const newTotal = current + d.penalty;
      if (newTotal > cap) {
        appliedPenalty = Math.max(0, cap - current);
      }
      categoryTotals.set(cat, current + d.penalty);
    }

    score -= appliedPenalty;

    return {
      check: `${d.category}: ${d.description}`,
      passed: false,
      penalty: appliedPenalty,
    };
  });

  score = Math.max(0, Math.round(score * 1000) / 1000);
  return { score, details };
}

export async function gradeSourceCriticism(
  wikitext: string,
): Promise<GraderResult> {
  const results: { score: number; details: GraderCheck[] }[] = [];

  for (let i = 0; i < SOURCE_CRITICISM_PASSES; i++) {
    const evaluation = await evaluateWithRubric(wikitext, SOURCE_CRITICISM_RUBRIC);
    results.push(scoreEvaluation(evaluation));
  }

  results.sort((a, b) => a.score - b.score);
  const median = results[Math.floor(results.length / 2)];

  return {
    grader: 'source-criticism',
    score: median.score,
    details: median.details,
  };
}
