import type { GraderResult } from '../types.js';

/**
 * Grade whether the agent used the wai CLI tools properly.
 *
 * Checks:
 * 1. Used wai CLI at all
 * 2. Used wai snapshot to ingest source data
 * 3. Used wai read to read wiki content
 * 4. Used wai write/edit/create to author pages
 */
export function gradeToolUsage(log: string | undefined): GraderResult {
  if (!log) {
    return {
      grader: 'tool-usage',
      score: 0,
      skipped: true,
      details: [{ check: 'No agent log available', passed: false, penalty: 0 }],
    };
  }

  const checks = [
    {
      name: 'Used wai CLI',
      test: () => /\bwai\s/.test(log),
      weight: 1,
    },
    {
      name: 'Used wai snapshot for source ingestion',
      test: () => /\bwai\s+snapshot\b/.test(log),
      weight: 1,
    },
    {
      name: 'Used wai read to inspect pages',
      test: () => /\bwai\s+read\b/.test(log),
      weight: 1,
    },
    {
      name: 'Used wai write/edit/create to author pages',
      test: () => /\bwai\s+(write|edit|create)\b/.test(log),
      weight: 1,
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  let passedWeight = 0;

  const details = checks.map((check) => {
    const passed = check.test();
    if (passed) passedWeight += check.weight;
    return {
      check: check.name,
      passed,
      penalty: passed ? 0 : check.weight / totalWeight,
    };
  });

  const score = totalWeight > 0 ? passedWeight / totalWeight : 0;

  return {
    grader: 'tool-usage',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}
