import type { GraderResult, TestCase } from '../types.js';
import { extractCrossRefs } from '../llm.js';

export async function gradeCrossRef(
  wikitext: string,
  testCase: TestCase,
): Promise<GraderResult> {
  const sourceTypes = [...new Set(testCase.sources.map((s) => s.type))];

  if (sourceTypes.length < 2) {
    return {
      grader: 'cross-ref',
      score: 0,
      details: [
        {
          check: 'Fewer than 2 source types available',
          passed: false,
          penalty: 1,
          note: `Only ${sourceTypes.length} source type(s) found`,
        },
      ],
    };
  }

  const extraction = await extractCrossRefs(wikitext, sourceTypes);
  const found = extraction.crossRefs.length;
  const possible = testCase.expectedCrossRefs ?? found;

  const details = extraction.crossRefs.map((ref) => ({
    check: `Cross-ref: ${ref.fact}`,
    passed: true,
    penalty: 0,
    note: `Sources: ${ref.sourceTypes.join(', ')}`,
  }));

  const score = possible > 0 ? Math.min(1, found / possible) : 1.0;

  return {
    grader: 'cross-ref',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}
