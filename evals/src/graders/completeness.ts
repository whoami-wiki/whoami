import type { GraderResult, GraderCheck, PageRole } from '../types.js';
import { parsePageContent } from './parse-page.js';

interface Check {
  name: string;
  test: (body: string, opts?: CompletenessOptions) => boolean;
  /** Weight for scoring. Higher = more impact. Default 1. */
  weight: number;
}

export interface CompletenessOptions {
  role?: PageRole;
  subject?: string;
  expectedEpisodes?: string[];
  checkpointId?: string;
}

const SECTION_STOP_WORDS = new Set([
  'references',
  'footnotes',
  'see also',
  'bibliography',
]);

/**
 * Strip markdown structural noise (directives, headings, footnotes, wikilink
 * brackets, image refs) and return the running word count of the prose.
 */
function countProseWords(body: string): number {
  let text = body;
  // Strip container directives (whole multi-line blocks)
  text = text.replace(/^:::[a-z-]+(?:\{[^}]*\})?\n[\s\S]*?\n:::\s*$/gm, '');
  // Strip leaf directives (single-line)
  text = text.replace(/^::[a-z-]+(?:\{[^}]*\})?\s*$/gm, '');
  // Strip footnote definitions
  text = text.replace(/^\[\^[^\]]+\]:.*(?:\n[ \t]+.*)*$/gm, '');
  // Strip footnote refs
  text = text.replace(/\[\^[^\]]+\]/g, '');
  // Strip headings
  text = text.replace(/^#+\s.*$/gm, '');
  // Strip wikilinks (preserve display text)
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
  // Strip markdown image refs
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Count level-2 headings, excluding References/Footnotes/See also/Bibliography.
 */
function countContentSections(body: string): number {
  return parsePageContent(body)
    .headings.filter(
      (h) => h.depth === 2 && !SECTION_STOP_WORDS.has(h.text.toLowerCase()),
    ).length;
}

/**
 * Count level-3 subsection headings.
 */
function countSubsections(body: string): number {
  return parsePageContent(body).headings.filter((h) => h.depth === 3).length;
}

/**
 * Count unique footnote labels referenced in the body, e.g. `[^a]`, `[^ig-2022]`.
 */
function countUniqueFootnotes(body: string): number {
  const labels = new Set<string>();
  for (const m of body.matchAll(/\[\^([^\]]+)\]/g)) {
    if (m[1]) labels.add(m[1]);
  }
  return labels.size;
}

function hasInfobox(body: string): boolean {
  return parsePageContent(body).directives.some(
    (d) =>
      d.name === 'infobox-person' ||
      d.name === 'infobox-company' ||
      d.name === 'infobox-episode' ||
      d.name === 'infobox-project',
  );
}

function hasBlockquote(body: string): boolean {
  return parsePageContent(body).directives.some((d) => d.name === 'blockquote');
}

function countDialogue(body: string): number {
  return parsePageContent(body).directives.filter((d) => d.name === 'dialogue')
    .length;
}

function hasMedia(body: string): boolean {
  // Markdown image refs e.g. ![caption](/assets/photo.jpg) or audio/video directives
  if (/!\[[^\]]*\]\([^)]*\)/.test(body)) return true;
  return parsePageContent(body).directives.some(
    (d) => d.name === 'audio' || d.name === 'video' || d.name === 'audio-clip',
  );
}

function hasCiteVault(body: string): boolean {
  return parsePageContent(body).directives.some(
    (d) => d.name === 'cite-vault' || d.name.startsWith('cite-'),
  );
}

function hasCategory(body: string): boolean {
  // Categories are now frontmatter (YAML), but also accept legacy directive form
  if (/^---\s*\n[\s\S]*?\bcategor(?:y|ies)\s*:/m.test(body)) return true;
  return parsePageContent(body).directives.some((d) => d.name === 'category');
}

// ============================================================
// Person / Episode checks
// ============================================================

const STRUCTURAL_CHECKS: Check[] = [
  {
    name: 'Lead paragraph before first heading',
    weight: 1,
    test: (body) => {
      const firstHeading = body.search(/^#+\s/m);
      if (firstHeading === -1) return false;
      const lead = body.slice(0, firstHeading).trim();
      // Strip any frontmatter or directives — check there's actual prose
      const stripped = lead
        .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
        .replace(/^:::[a-z-]+(?:\{[^}]*\})?\n[\s\S]*?\n:::\s*$/gm, '')
        .replace(/^::[a-z-]+(?:\{[^}]*\})?\s*$/gm, '')
        .trim();
      return stripped.length > 0;
    },
  },
  {
    name: 'Infobox directive with required fields',
    weight: 2,
    test: (body) => {
      const infoboxes = parsePageContent(body).directives.filter(
        (d) =>
          d.name === 'infobox-person' ||
          d.name === 'infobox-company' ||
          d.name === 'infobox-episode' ||
          d.name === 'infobox-project',
      );
      if (infoboxes.length === 0) return false;
      // Must have substantive body content (key:value pairs)
      return infoboxes.some((i) => (i.body ?? '').length > 10);
    },
  },
  {
    name: 'Body section with substantive prose',
    weight: 1,
    test: (body) => {
      const headingRegex = /^(#+)\s+(.*)$/gm;
      const matches: Array<{ index: number; end: number; depth: number; text: string }> = [];
      let m: RegExpExecArray | null;
      while ((m = headingRegex.exec(body)) !== null) {
        matches.push({
          index: m.index,
          end: m.index + m[0].length,
          depth: m[1].length,
          text: m[2].trim(),
        });
      }
      for (let i = 0; i < matches.length; i++) {
        if (matches[i].depth !== 2) continue;
        if (SECTION_STOP_WORDS.has(matches[i].text.toLowerCase())) continue;
        const start = matches[i].end;
        const next = matches.find((mm, j) => j > i && mm.depth <= 2);
        const end = next ? next.index : body.length;
        const content = body.slice(start, end).trim();
        if (content.length > 50) return true;
      }
      return false;
    },
  },
  {
    name: 'References / footnotes section present',
    weight: 0.5,
    test: (body) => {
      // Either a "References" heading + at least one footnote definition, or
      // any footnote definition at all.
      const hasFootnoteDefs = /^\[\^[^\]]+\]:/m.test(body);
      return hasFootnoteDefs;
    },
  },
  {
    name: 'Bibliography section with cite-vault directive',
    weight: 0.5,
    test: (body) => {
      const headings = parsePageContent(body).headings;
      const hasBibHeading = headings.some(
        (h) =>
          h.depth === 2 &&
          /^bibliography$/i.test(h.text.trim()),
      );
      return hasBibHeading && hasCiteVault(body);
    },
  },
  {
    name: 'At least one category tag',
    weight: 0.5,
    test: (body) => hasCategory(body),
  },
];

// Depth checks — high weight, hard thresholds calibrated against reference pages
const DEPTH_CHECKS: Check[] = [
  {
    name: 'Prose word count >= 800',
    weight: 3,
    test: (body) => countProseWords(body) >= 800,
  },
  {
    name: 'At least 5 content sections',
    weight: 3,
    test: (body) => countContentSections(body) >= 5,
  },
  {
    name: 'At least 3 subsections (###)',
    weight: 2,
    test: (body) => countSubsections(body) >= 3,
  },
  {
    name: 'At least 10 unique inline citations',
    weight: 2,
    test: (body) => countUniqueFootnotes(body) >= 10,
  },
];

function getDepthChecks(checkpointId?: string): Check[] {
  if (!checkpointId) return DEPTH_CHECKS;

  let proseMin: number;
  let sectionsMin: number;
  let citationsMin: number;

  if (checkpointId === 'draft') {
    proseMin = 400;
    sectionsMin = 3;
    citationsMin = 5;
  } else if (
    checkpointId === 'new-source' ||
    checkpointId === 'episodes' ||
    checkpointId === 'persons' ||
    checkpointId === 'owner-input'
  ) {
    proseMin = 700;
    sectionsMin = 5;
    citationsMin = 10;
  } else {
    return DEPTH_CHECKS;
  }

  return [
    {
      name: `Prose word count >= ${proseMin}`,
      weight: 3,
      test: (body: string) => countProseWords(body) >= proseMin,
    },
    {
      name: `At least ${sectionsMin} content sections`,
      weight: 3,
      test: (body: string) => countContentSections(body) >= sectionsMin,
    },
    {
      name: 'At least 3 subsections (###)',
      weight: 2,
      test: (body: string) => countSubsections(body) >= 3,
    },
    {
      name: `At least ${citationsMin} unique inline citations`,
      weight: 2,
      test: (body: string) => countUniqueFootnotes(body) >= citationsMin,
    },
  ];
}

// Content richness checks — evidence of deep engagement with sources
const RICHNESS_CHECKS: Check[] = [
  {
    name: 'Has blockquotes or dialogue',
    weight: 1.5,
    test: (body) => {
      if (hasBlockquote(body) || countDialogue(body) > 0) return true;
      // Inline quoted passages (>15 chars) — short quotes integrated into prose
      const inlineQuotes = body.match(/"[^"]{15,}"/g);
      return inlineQuotes !== null && inlineQuotes.length >= 3;
    },
  },
  {
    name: 'Has embedded media (images, audio, video)',
    weight: 1.5,
    test: (body) => hasMedia(body),
  },
];

const PERSON_EPISODE_LINK: Check = {
  name: 'Links to episode pages',
  weight: 0.5,
  test: (body, opts) => {
    if (!opts?.expectedEpisodes || opts.expectedEpisodes.length === 0)
      return true;
    return opts.expectedEpisodes.some((ep) => body.includes(`[[${ep}`));
  },
};

const EPISODE_PERSON_LINK: Check = {
  name: 'Links back to person page',
  weight: 0.5,
  test: (body, opts) => {
    if (!opts?.subject) return true;
    return body.includes(`[[${opts.subject}`);
  },
};

// ============================================================
// Source checks
// ============================================================

const SOURCE_CHECKS: Check[] = [
  {
    name: 'Has snapshot identifier',
    weight: 1,
    test: (body) => {
      // Frontmatter or directive attribute with snapshot
      if (/snapshot\s*[:=]\s*\S+/i.test(body)) return true;
      const directives = parsePageContent(body).directives;
      return directives.some((d) => d.attrs.snapshot || d.attrs.snapshotId);
    },
  },
  {
    name: 'Has source type metadata',
    weight: 1,
    test: (body) => {
      if (/^\s*type\s*[:=]\s*\S+/im.test(body)) return true;
      const directives = parsePageContent(body).directives;
      if (directives.some((d) => d.attrs.type)) return true;
      const lead = body.slice(0, 500).toLowerCase();
      return /\b(facebook|whatsapp|instagram|photos?|messages?|transactions?|voice\s*notes?|location|android|ios)\b/.test(
        lead,
      );
    },
  },
  {
    name: 'Has file listing or content summary',
    weight: 1,
    test: (body) => {
      // Strip directives and headings and check substance remains
      const stripped = body
        .replace(/^:::[a-z-]+(?:\{[^}]*\})?\n[\s\S]*?\n:::\s*$/gm, '')
        .replace(/^::[a-z-]+(?:\{[^}]*\})?\s*$/gm, '')
        .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
        .replace(/^#+\s.*$/gm, '')
        .trim();
      return stripped.length > 100;
    },
  },
  {
    name: 'Has at least one category tag',
    weight: 0.5,
    test: (body) => hasCategory(body),
  },
  {
    name: 'At least 2 content sections',
    weight: 2,
    test: (body) => countContentSections(body) >= 2,
  },
  {
    name: 'Substantive content (>= 500 chars beyond directives)',
    weight: 2,
    test: (body) => {
      const stripped = body
        .replace(/^:::[a-z-]+(?:\{[^}]*\})?\n[\s\S]*?\n:::\s*$/gm, '')
        .replace(/^::[a-z-]+(?:\{[^}]*\})?\s*$/gm, '')
        .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
        .replace(/^#+\s.*$/gm, '')
        .trim();
      return stripped.length >= 500;
    },
  },
];

// ============================================================
// Talk checks
// ============================================================

const TALK_CHECKS: Check[] = [
  {
    name: 'Has at least one section heading',
    weight: 1,
    test: (body) => parsePageContent(body).headings.some((h) => h.depth === 2),
  },
  {
    name: 'No lead prose before first heading',
    weight: 1,
    test: (body) => {
      const firstHeading = body.search(/^#+\s/m);
      if (firstHeading === -1) return false;
      const lead = body.slice(0, firstHeading).trim();
      const stripped = lead
        .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
        .trim();
      return stripped.length === 0;
    },
  },
  {
    name: 'Has editorial decisions or rationale',
    weight: 2,
    test: (body) => {
      const headings = parsePageContent(body).headings;
      if (
        headings.some(
          (h) =>
            h.depth === 2 &&
            /^editorial(\s+decisions?)?$/i.test(h.text.trim()),
        )
      )
        return true;
      const directives = parsePageContent(body).directives;
      return directives.some(
        (d) => d.name === 'closed' || d.name === 'superseded',
      );
    },
  },
  {
    name: 'Has active gaps or open questions',
    weight: 1.5,
    test: (body) => {
      const headings = parsePageContent(body).headings;
      if (
        headings.some(
          (h) =>
            h.depth === 2 &&
            /^(active\s+gaps|open\s+questions)$/i.test(h.text.trim()),
        )
      )
        return true;
      const directives = parsePageContent(body).directives;
      return directives.some((d) => d.name === 'open');
    },
  },
  {
    name: 'Has research notes or source index',
    weight: 1.5,
    test: (body) => {
      const headings = parsePageContent(body).headings;
      return headings.some(
        (h) =>
          h.depth === 2 &&
          /^(research\s+notes|source\s+index|key\s+dates|key\s+people|sources?)$/i.test(
            h.text.trim(),
          ),
      );
    },
  },
];

// ============================================================
// Grader
// ============================================================

function getChecks(role: PageRole, checkpointId?: string): Check[] {
  switch (role) {
    case 'person':
      return [
        ...STRUCTURAL_CHECKS,
        ...getDepthChecks(checkpointId),
        ...RICHNESS_CHECKS,
        PERSON_EPISODE_LINK,
      ];
    case 'project':
      return [
        ...STRUCTURAL_CHECKS,
        ...getDepthChecks(checkpointId),
        ...RICHNESS_CHECKS,
        PERSON_EPISODE_LINK,
      ];
    case 'episode':
      return [
        ...STRUCTURAL_CHECKS,
        ...getDepthChecks(checkpointId),
        ...RICHNESS_CHECKS,
        EPISODE_PERSON_LINK,
      ];
    case 'source':
      return SOURCE_CHECKS;
    case 'talk':
      return TALK_CHECKS;
  }
}

export function gradeCompleteness(
  body: string,
  options?: CompletenessOptions,
): GraderResult {
  const role = options?.role ?? 'person';
  const checks = getChecks(role, options?.checkpointId);
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);

  const details: GraderCheck[] = checks.map((check) => {
    const passed = check.test(body, options);
    return {
      check: check.name,
      passed,
      penalty: passed ? 0 : check.weight / totalWeight,
    };
  });

  const passedWeight = checks
    .filter((_, i) => details[i].passed)
    .reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? passedWeight / totalWeight : 0;

  return {
    grader: 'completeness',
    score: Math.round(score * 1000) / 1000,
    details,
  };
}
