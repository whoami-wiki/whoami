import type { GraderResult, GraderCheck } from '../types.js';

const VALID_TEMPLATES = ['message', 'voice note', 'photo', 'video', 'vault', 'testimony'];
const REQUIRED_FIELDS = ['hash', 'date'];
const TYPE_SPECIFIC_FIELDS: Record<string, string[]> = {
  message: [],
  'voice note': ['speaker'],
  photo: [],
  video: [],
  vault: ['type'],
  testimony: ['speaker'],
};

interface ParsedCitation {
  template: string;
  fields: Record<string, string>;
  raw: string;
}

export function parseCitations(wikitext: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];
  const citeRegex = /\{\{Cite\s+([\w\s]+?)\s*\|([^}]*)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = citeRegex.exec(wikitext)) !== null) {
    const template = match[1].trim().toLowerCase();
    const fieldsStr = match[2];
    const fields: Record<string, string> = {};

    for (const part of fieldsStr.split('|')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const key = part.slice(0, eqIdx).trim();
        const value = part.slice(eqIdx + 1).trim();
        fields[key] = value;
      }
    }

    citations.push({ template, fields, raw: match[0] });
  }

  return citations;
}

function validateCitation(citation: ParsedCitation): GraderCheck[] {
  const checks: GraderCheck[] = [];

  const validTemplate = VALID_TEMPLATES.includes(citation.template);
  checks.push({
    check: `Template "${citation.template}" is valid`,
    passed: validTemplate,
    penalty: validTemplate ? 0 : 1,
    note: validTemplate ? undefined : `Unknown template: ${citation.template}`,
  });

  if (!validTemplate) return checks;

  for (const field of REQUIRED_FIELDS) {
    // Accept either hash or snapshot as the identifier
    // Testimony citations have no snapshot — skip hash/snapshot requirement
    if (field === 'hash') {
      if (citation.template === 'testimony') {
        // Testimony has no digital snapshot — skip
        continue;
      }
      const hasId = 'hash' in citation.fields || 'snapshot' in citation.fields;
      checks.push({
        check: `Has hash or snapshot field`,
        passed: hasId,
        penalty: hasId ? 0 : 1,
      });
    } else if (field === 'date') {
      // Accept either date or timestamp (vault uses timestamp)
      const hasDate = 'date' in citation.fields || 'timestamp' in citation.fields;
      checks.push({
        check: `Has date or timestamp field`,
        passed: hasDate,
        penalty: hasDate ? 0 : 1,
      });
    } else {
      const hasField = field in citation.fields;
      checks.push({
        check: `Has required field: ${field}`,
        passed: hasField,
        penalty: hasField ? 0 : 1,
      });
    }
  }

  const typeFields = TYPE_SPECIFIC_FIELDS[citation.template] ?? [];
  for (const field of typeFields) {
    const hasField = field in citation.fields;
    checks.push({
      check: `Has type-specific field: ${field}`,
      passed: hasField,
      penalty: hasField ? 0 : 0.5,
    });
  }

  return checks;
}

/**
 * Split wikitext into paragraphs (blocks separated by blank lines or headings).
 * Returns each paragraph with its start offset in the original text.
 */
function splitParagraphs(wikitext: string): { text: string; start: number }[] {
  const paragraphs: { text: string; start: number }[] = [];
  const blocks = wikitext.split(/\n\s*\n|(?=^==)/m);
  let offset = 0;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length > 0) {
      paragraphs.push({ text: trimmed, start: wikitext.indexOf(trimmed, offset) });
    }
    offset += block.length + 1;
  }
  return paragraphs;
}

export function findUncitedClaims(wikitext: string): string[] {
  const uncited: string[] = [];
  const paragraphs = splitParagraphs(wikitext);

  for (const para of paragraphs) {
    // Skip headings, templates, categories, tables, bibliography, file/image embeds
    if (/^==|^\{\{|^\[\[Category:|^\{\||^\[\[(?:File|Image):/i.test(para.text)) continue;
    if (/\{\{Cite\b|<references/.test(para.text)) continue;

    // If the paragraph has any <ref> tag, all sentences in it are considered cited
    if (/<ref/.test(para.text)) continue;

    // No ref in this paragraph — check each sentence for factual claims
    const sentences = para.text.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (/<ref|<references|\{\{Cite/.test(sentence)) continue;

      const hasDate = /\b\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(sentence);
      const hasProperNoun = /[A-Z][a-z]{2,}/.test(sentence);
      const isFactual = hasDate || (hasProperNoun && sentence.length > 30);

      if (isFactual) {
        uncited.push(sentence.trim().slice(0, 80));
      }
    }
  }

  return uncited;
}

export function gradeCitations(wikitext: string): GraderResult {
  const citations = parseCitations(wikitext);
  const details: GraderCheck[] = [];

  if (citations.length === 0) {
    return {
      grader: 'citations',
      score: 0,
      details: [{ check: 'Has at least one citation', passed: false, penalty: 1 }],
    };
  }

  let validCount = 0;
  for (const citation of citations) {
    const checks = validateCitation(citation);
    details.push(...checks);
    const allPassed = checks.every((c) => c.passed);
    if (allPassed) validCount++;
  }

  const uncited = findUncitedClaims(wikitext);
  for (const claim of uncited) {
    details.push({
      check: 'Uncited factual claim',
      passed: false,
      penalty: 0.1,
      note: claim,
    });
  }

  // Base score: valid citations / total citations
  let score = validCount / citations.length;

  // Penalty for uncited claims: 0.05 per uncited claim, cap at 0.3
  const uncitedPenalty = Math.min(uncited.length * 0.05, 0.3);
  score = Math.max(0, score - uncitedPenalty);

  return {
    grader: 'citations',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}
