import type { GraderResult, GraderCheck } from '../types.js';
import type { RubricEvaluation } from '../llm.js';
import { evaluateWithRubric } from '../llm.js';

const INTEGRATION_RUBRIC = `
Evaluate how well the CURRENT version of this page integrates new information compared to the PREVIOUS version.

You will receive both versions. If a TALK PAGE is provided, use it to check whether contradictions and editorial changes were documented there.

1. STRUCTURAL_INTEGRATION (deduction: -0.15 each)
   - New facts placed in appropriate existing sections, not dumped in "Additional information"
   - Infobox fields updated with newly available information
   - Earlier hedging/unknown markers removed now that data is available

2. NARRATIVE_COHERENCE (deduction: -0.15 each)
   - Page reads as one unified article after revision, not as layers
   - No sudden style shifts between original and new content
   - Chronological/thematic flow maintained

3. CONTRADICTION_HANDLING (deduction: -0.2 each)
   - When new data conflicts with existing content, discrepancy should be noted on the Talk page
   - If a Talk page is provided and the discrepancy IS documented there, do NOT deduct
   - Only deduct when a substantive change is made with no acknowledgment anywhere
   - Minor wording tweaks (e.g. tightening prose) are not contradictions
`;

const CAPS: Record<string, number> = {
  structural_integration: 0.6,
  narrative_coherence: 0.4,
};

const INTEGRATION_PASSES = 2;

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

export async function gradeIntegration(
  previousWikitext: string,
  currentWikitext: string,
  talkWikitext?: string,
): Promise<GraderResult> {
  let combinedInput = `=== PREVIOUS VERSION ===\n${previousWikitext}\n\n=== CURRENT VERSION ===\n${currentWikitext}`;
  if (talkWikitext) {
    combinedInput += `\n\n=== TALK PAGE ===\n${talkWikitext}`;
  }

  const results: { score: number; details: GraderCheck[] }[] = [];

  for (let i = 0; i < INTEGRATION_PASSES; i++) {
    const evaluation = await evaluateWithRubric(combinedInput, INTEGRATION_RUBRIC);
    results.push(scoreEvaluation(evaluation));
  }

  results.sort((a, b) => a.score - b.score);
  const median = results[Math.floor(results.length / 2)];

  return {
    grader: 'integration',
    score: median.score,
    details: median.details,
  };
}
