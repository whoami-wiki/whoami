import type { GraderResult, GraderCheck, PageRole } from '../types.js';
import { parsePageContent, isInfoboxDirective } from './parse-page.js';
import { parseCitations } from './citations.js';

function extractHeadings(body: string): string[] {
  return parsePageContent(body)
    .headings
    .filter(h => h.depth === 2)
    .map(h => h.text.toLowerCase());
}

function extractInfoboxFields(body: string): string[] {
  const ibox = parsePageContent(body).directives.find(d => isInfoboxDirective(d.name));
  if (!ibox?.body) return [];
  const fields: string[] = [];
  for (const line of ibox.body.split('\n')) {
    const m = line.match(/^([a-z][\w]*?)\s*:/i);
    if (m) fields.push(m[1]!.toLowerCase());
  }
  return fields;
}

function extractCitationSnapshots(body: string): string[] {
  return parseCitations(body)
    .map(c => c.fields.snapshot?.toLowerCase())
    .filter((s): s is string => !!s);
}

function gradeContentReference(body: string, ref: string): { score: number; details: GraderCheck[] } {
  const refHeadings = new Set(extractHeadings(ref));
  const bodyHeadings = new Set(extractHeadings(body));
  const refFields = new Set(extractInfoboxFields(ref));
  const bodyFields = new Set(extractInfoboxFields(body));
  const refSnapshots = new Set(extractCitationSnapshots(ref));
  const bodySnapshots = new Set(extractCitationSnapshots(body));

  const details: GraderCheck[] = [];
  const overlap = (a: Set<string>, b: Set<string>) => [...a].filter(x => b.has(x)).length;

  const headingOverlap = overlap(refHeadings, bodyHeadings) / Math.max(1, refHeadings.size);
  const fieldOverlap = overlap(refFields, bodyFields) / Math.max(1, refFields.size);
  const snapshotOverlap = overlap(refSnapshots, bodySnapshots) / Math.max(1, refSnapshots.size);

  details.push({ check: `Headings overlap with reference (${overlap(refHeadings, bodyHeadings)}/${refHeadings.size})`, passed: headingOverlap >= 0.5, penalty: 1 - headingOverlap });
  details.push({ check: `Infobox fields overlap (${overlap(refFields, bodyFields)}/${refFields.size})`, passed: fieldOverlap >= 0.5, penalty: 1 - fieldOverlap });
  details.push({ check: `Citation snapshots overlap (${overlap(refSnapshots, bodySnapshots)}/${refSnapshots.size})`, passed: snapshotOverlap >= 0.5, penalty: 1 - snapshotOverlap });

  const score = (headingOverlap + fieldOverlap + snapshotOverlap) / 3;
  return { score: Math.round(score * 1000) / 1000, details };
}

function gradeSourceReference(body: string, ref: string): { score: number; details: GraderCheck[] } {
  const refHeadings = new Set(extractHeadings(ref));
  const bodyHeadings = new Set(extractHeadings(body));
  const overlap = [...refHeadings].filter(x => bodyHeadings.has(x)).length;
  const score = refHeadings.size > 0 ? overlap / refHeadings.size : 1;
  return {
    score: Math.round(score * 1000) / 1000,
    details: [{ check: `Source headings overlap (${overlap}/${refHeadings.size})`, passed: score >= 0.5, penalty: 1 - score }],
  };
}

export function gradeReference(body: string, referenceBody: string, role: PageRole): GraderResult {
  const { score, details } = role === 'source'
    ? gradeSourceReference(body, referenceBody)
    : gradeContentReference(body, referenceBody);
  return { grader: 'reference', score, details };
}
