import type { GraderResult, GraderCheck } from '../types.js';
import type { RubricEvaluation } from '../llm.js';
import { evaluateWithRubric } from '../llm.js';

const WORDS_TO_WATCH = [
  'pivotal', 'crucial', 'vital', 'fundamental', 'instrumental', 'transformative',
  'groundbreaking', 'indelible', 'enduring', 'profound', 'testament',
  'vibrant', 'renowned', 'nestled', 'boasts', 'showcases', 'exemplifies',
  'stunning', 'breathtaking', 'remarkable', 'extraordinary', 'spectacular', 'masterful',
  'genuinely', 'truly', 'deeply', 'incredibly', 'remarkably', 'undeniable', 'unmistakable',
  'stands as', 'serves as', 'underscores', 'highlights', 'fosters', 'garners',
  'encompasses', 'cultivates',
  'moreover', 'furthermore', 'notably', 'additionally',
];

const PERSON_EPISODE_RUBRIC = `
Evaluate the wikitext page against these editorial standards:

1. VOICE (deduction: -0.1 each, cap -0.4)
   - Must use third-person voice (no "I", "we", "my", "our" as the subject's voice)
   - No editorializing or opinion
   - No words-to-watch: ${WORDS_TO_WATCH.join(', ')}
   - No significance inflation ("pivotal moment", "transformative experience")
   - No vague attributions ("some say", "it is believed", "according to many")

2. PROSE (deduction: -0.1 each, cap -0.3)
   - No "stands as"/"serves as" constructions
   - Split sentences longer than 40 words
   - No synonym cycling (varying terms for the same concept without reason)
   - No formulaic transitions ("moreover", "furthermore", "notably")
   - No section-end summary sentences that restate what was just said

3. EDITORIAL (deduction: -0.15 each)
   - Biographical structure (chronological/thematic), not analytical essays
   - Concise lead paragraph that summarizes the page
   - Facts presented in narrative prose, not bullet lists
   - Quotes used selectively (not dumped in bulk)
   - Source material synthesized into prose, not transcribed verbatim
   - Chronological or thematic section order

4. SYNTAX (deduction: -0.1 each)
   - Correct wikitext heading syntax (== Level 2 ==, === Level 3 ===)
   - Properly formed [[wikilinks]]
   - Properly formed {{templates}}
   - No broken HTML tags
`;

const TALK_RUBRIC = `
Evaluate this talk page against these editorial standards:

1. CURATION (deduction: -0.2 each, cap -0.6)
   - No bulk data dumps (raw database rows, full JSON exports, unprocessed logs)
   - Raw transcriptions must not exceed 50% of total content
   - Must have a summary or index section organizing the content

2. EDITORIAL_CONTENT (deduction: -0.15 each)
   - Should document editorial decisions made (what was included/excluded and why)
   - Should track gaps (missing information, unverified claims, open questions)
   - Should include research notes or source index (key findings, methodology)

3. STRUCTURE (deduction: -0.1 each)
   - Must have section headings organizing content
   - No lead prose before first heading (talk pages start with headings)
   - Content organized by topic or workflow stage
`;

const CAPS: Record<string, number> = {
  voice: 0.4,
  prose: 0.3,
  curation: 0.6,
};

const EDITORIAL_PASSES = 3;

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

export async function gradeEditorial(
  wikitext: string,
  role: 'person' | 'episode' | 'project' | 'talk',
): Promise<GraderResult> {
  const rubric = role === 'talk' ? TALK_RUBRIC : PERSON_EPISODE_RUBRIC;

  const results: { score: number; details: GraderCheck[] }[] = [];

  for (let i = 0; i < EDITORIAL_PASSES; i++) {
    const evaluation = await evaluateWithRubric(wikitext, rubric);
    results.push(scoreEvaluation(evaluation));
  }

  results.sort((a, b) => a.score - b.score);
  const median = results[Math.floor(results.length / 2)];

  return {
    grader: 'editorial',
    score: median.score,
    details: median.details,
  };
}
