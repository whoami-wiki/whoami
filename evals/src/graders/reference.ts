import type { GraderResult, GraderCheck, PageRole } from '../types.js';

/**
 * Extract == Level 2 == section headings from wikitext.
 */
function extractHeadings(wikitext: string): string[] {
  const matches = wikitext.match(/^==\s*([^=].*?)\s*==\s*$/gm);
  if (!matches) return [];
  return matches.map((m) => m.replace(/^==\s*/, '').replace(/\s*==\s*$/, '').trim().toLowerCase());
}

/**
 * Extract infobox fields (| key = value) from first {{Infobox ...}} template.
 */
function extractInfoboxFields(wikitext: string): string[] {
  const infoboxMatch = wikitext.match(/\{\{Infobox\b[^}]*\}\}/s);
  if (!infoboxMatch) return [];
  const fields: string[] = [];
  const fieldRegex = /\|\s*(\w[\w\s]*?)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(infoboxMatch[0])) !== null) {
    fields.push(match[1].trim().toLowerCase());
  }
  return fields;
}

/**
 * Extract citation hashes (hash = X or snapshot = X) from {{Cite ...}} templates.
 */
function extractCitationHashes(wikitext: string): string[] {
  const hashes: string[] = [];
  const regex = /\{\{Cite\s+\w+[^}]*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(wikitext)) !== null) {
    const hashMatch = match[0].match(/(?:hash|snapshot)\s*=\s*([^\s|}\]]+)/);
    if (hashMatch) {
      hashes.push(hashMatch[1].toLowerCase());
    }
  }
  return hashes;
}

/**
 * Extract [[Category:X]] tags from wikitext.
 */
function extractCategories(wikitext: string): string[] {
  const matches = wikitext.match(/\[\[Category:([^\]]+)\]\]/g);
  if (!matches) return [];
  return matches.map((m) => {
    const inner = m.match(/\[\[Category:([^\]]+)\]\]/);
    return inner ? inner[1].trim().toLowerCase() : '';
  }).filter(Boolean);
}

/**
 * Compute fraction of reference items present in agent output.
 */
function coverage(referenceItems: string[], agentItems: string[]): number {
  if (referenceItems.length === 0) return 1;
  const agentSet = new Set(agentItems);
  const found = referenceItems.filter((item) => agentSet.has(item)).length;
  return found / referenceItems.length;
}

/**
 * Grade content pages (person/episode/talk) against reference.
 */
function gradeContentReference(wikitext: string, referenceWikitext: string): { score: number; details: GraderCheck[] } {
  const details: GraderCheck[] = [];

  // Section heading coverage (0.4)
  const refHeadings = extractHeadings(referenceWikitext);
  const agentHeadings = extractHeadings(wikitext);
  const headingCov = coverage(refHeadings, agentHeadings);
  details.push({
    check: 'Section heading coverage',
    passed: headingCov >= 0.5,
    penalty: (1 - headingCov) * 0.4,
    note: `${Math.round(headingCov * 100)}% (${agentHeadings.filter((h) => refHeadings.map((r) => r.toLowerCase()).includes(h)).length}/${refHeadings.length})`,
  });

  // Infobox field coverage (0.2)
  const refFields = extractInfoboxFields(referenceWikitext);
  const agentFields = extractInfoboxFields(wikitext);
  const fieldCov = coverage(refFields, agentFields);
  details.push({
    check: 'Infobox field coverage',
    passed: fieldCov >= 0.5,
    penalty: (1 - fieldCov) * 0.2,
    note: `${Math.round(fieldCov * 100)}% (${agentFields.filter((f) => refFields.includes(f)).length}/${refFields.length})`,
  });

  // Citation hash presence (0.2) — checks that agent citations include hashes,
  // not that they match reference hashes (fresh snapshots produce different hashes)
  const refHashCount = extractCitationHashes(referenceWikitext).length;
  const agentHashCount = extractCitationHashes(wikitext).length;
  const hashPresence = refHashCount > 0 ? Math.min(agentHashCount / refHashCount, 1.0) : 1.0;
  details.push({
    check: 'Citation hash presence',
    passed: hashPresence >= 0.5,
    penalty: (1 - hashPresence) * 0.2,
    note: `${Math.round(hashPresence * 100)}% (${agentHashCount}/${refHashCount} hash-bearing citations)`,
  });

  // Category coverage (0.2)
  const refCategories = extractCategories(referenceWikitext);
  const agentCategories = extractCategories(wikitext);
  const catCov = coverage(refCategories, agentCategories);
  details.push({
    check: 'Category coverage',
    passed: catCov >= 0.5,
    penalty: (1 - catCov) * 0.2,
    note: `${Math.round(catCov * 100)}% (${agentCategories.filter((c) => refCategories.includes(c)).length}/${refCategories.length})`,
  });

  const score = headingCov * 0.4 + fieldCov * 0.2 + hashPresence * 0.2 + catCov * 0.2;
  return { score, details };
}

/**
 * Grade source pages against reference.
 */
function gradeSourceReference(wikitext: string, referenceWikitext: string): { score: number; details: GraderCheck[] } {
  const details: GraderCheck[] = [];

  // Content length ratio (0.3) — capped at 1.0
  const ratio = referenceWikitext.length > 0
    ? Math.min(wikitext.length / referenceWikitext.length, 1.0)
    : (wikitext.length > 0 ? 1.0 : 0);
  details.push({
    check: 'Content length ratio',
    passed: ratio >= 0.5,
    penalty: (1 - ratio) * 0.3,
    note: `${Math.round(ratio * 100)}% (${wikitext.length}/${referenceWikitext.length} chars)`,
  });

  // Key line coverage (0.7) — fuzzy: trimmed, case-insensitive
  const refLines = referenceWikitext
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0);

  const agentText = wikitext.toLowerCase();
  const matchedLines = refLines.filter((line) => agentText.includes(line));
  const lineCov = refLines.length > 0 ? matchedLines.length / refLines.length : 1;

  details.push({
    check: 'Key line coverage',
    passed: lineCov >= 0.5,
    penalty: (1 - lineCov) * 0.7,
    note: `${Math.round(lineCov * 100)}% (${matchedLines.length}/${refLines.length} lines)`,
  });

  const score = ratio * 0.3 + lineCov * 0.7;
  return { score, details };
}

/**
 * Compare agent output against a known-good reference page.
 */
export function gradeReference(wikitext: string, referenceWikitext: string, role: PageRole): GraderResult {
  const { score, details } = role === 'source'
    ? gradeSourceReference(wikitext, referenceWikitext)
    : gradeContentReference(wikitext, referenceWikitext);

  return {
    grader: 'reference',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}
