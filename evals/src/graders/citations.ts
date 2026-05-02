import type { GraderResult, GraderCheck } from '../types.js';
import { parsePageContent } from './parse-page.js';

const VALID_TEMPLATES = ['message', 'voice-note', 'photo', 'video', 'vault', 'testimony'];
const REQUIRED_FIELDS = ['snapshot', 'date'];
const TYPE_SPECIFIC_FIELDS: Record<string, string[]> = {
  message: ['thread'],
  'voice-note': ['speaker'],
  photo: [],
  video: [],
  vault: ['type'],
  testimony: ['speaker'],
};

export interface ParsedCitation {
  template: string;
  fields: Record<string, string>;
}

const CITE_PREFIX = 'cite-';

function templateOf(name: string): string {
  return name.startsWith(CITE_PREFIX) ? name.slice(CITE_PREFIX.length) : name;
}

export function parseCitations(body: string): ParsedCitation[] {
  const parsed = parsePageContent(body);
  const out: ParsedCitation[] = [];
  for (const d of parsed.directives) {
    if (!d.name.startsWith(CITE_PREFIX)) continue;
    out.push({ template: templateOf(d.name), fields: { ...d.attrs } });
  }
  return out;
}

function validateCitation(citation: ParsedCitation): GraderCheck[] {
  const checks: GraderCheck[] = [];
  const validTemplate = VALID_TEMPLATES.includes(citation.template);
  checks.push({
    check: `Template "${citation.template}" is valid`,
    passed: validTemplate,
    penalty: validTemplate ? 0 : 0.5,
  });
  for (const f of REQUIRED_FIELDS) {
    const present = !!citation.fields[f]?.trim();
    checks.push({ check: `Has required field "${f}"`, passed: present, penalty: present ? 0 : 0.25 });
  }
  for (const f of TYPE_SPECIFIC_FIELDS[citation.template] ?? []) {
    const present = !!citation.fields[f]?.trim();
    checks.push({ check: `Has ${citation.template}-specific field "${f}"`, passed: present, penalty: present ? 0 : 0.15 });
  }
  return checks;
}

export function gradeCitations(body: string): GraderResult {
  const citations = parseCitations(body);
  const details: GraderCheck[] = [];
  if (citations.length === 0) {
    return {
      grader: 'citations',
      score: 1,
      details: [{ check: 'No citations found', passed: true, penalty: 0 }],
    };
  }
  let totalPenalty = 0;
  for (const c of citations) {
    for (const check of validateCitation(c)) {
      details.push(check);
      totalPenalty += check.penalty;
    }
  }
  const maxPenalty = citations.length * 1.0;
  const score = Math.max(0, 1 - totalPenalty / Math.max(1, maxPenalty));
  return { grader: 'citations', score: Math.round(score * 1000) / 1000, details };
}

const DATE_PATTERN = /\b(?:\d{4}|[A-Z][a-z]+ \d+,? \d{4}|in \d{4})\b/;
const FOOTNOTE_REF = /\[\^[^\]]+\]/;

export function findUncitedClaims(body: string): string[] {
  const sentences = body.split(/(?<=[.!?])\s+/);
  return sentences.filter(s => DATE_PATTERN.test(s) && !FOOTNOTE_REF.test(s));
}
