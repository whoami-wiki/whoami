import type { GraderResult, GraderCheck, PageRole } from '../types.js';

interface Check {
  name: string;
  test: (wikitext: string, opts?: CompletenessOptions) => boolean;
  /** Weight for scoring. Higher = more impact. Default 1. */
  weight: number;
}

export interface CompletenessOptions {
  role?: PageRole;
  subject?: string;
  expectedEpisodes?: string[];
  checkpointId?: string;
}

/**
 * Count prose words in wikitext, excluding templates, headings, categories, and ref tags.
 */
function countProseWords(wikitext: string): number {
  let text = wikitext;
  // Strip templates, ref tags, categories, headings, HTML tags, tables
  text = text.replace(/\{\{[^}]*\}\}/gs, '');
  text = text.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
  text = text.replace(/<ref[^/]*\/>/g, '');
  text = text.replace(/<references\s*\/>/g, '');
  text = text.replace(/\[\[Category:[^\]]+\]\]/g, '');
  text = text.replace(/^==+.*==+\s*$/gm, '');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\{\|[\s\S]*?\|\}/g, '');
  // Strip wikilinks but keep display text
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Count level-2 section headings (== Heading ==), excluding References/Bibliography/See also.
 */
function countContentSections(wikitext: string): number {
  const matches = wikitext.match(/^==\s*([^=].*?)\s*==\s*$/gm);
  if (!matches) return 0;
  return matches.filter((m) => !/References|Bibliography|See also/i.test(m)).length;
}

/**
 * Count level-3 subsection headings (=== Heading ===).
 */
function countSubsections(wikitext: string): number {
  const matches = wikitext.match(/^===\s*[^=].*===\s*$/gm);
  return matches ? matches.length : 0;
}

/**
 * Count unique <ref name="..."> tags (named citations).
 */
function countUniqueRefs(wikitext: string): number {
  const named = wikitext.match(/<ref\s+name="[^"]+"/g);
  if (!named) return 0;
  const names = new Set(named.map((r) => r.match(/"([^"]+)"/)?.[1]).filter(Boolean));
  return names.size;
}

// ============================================================
// Person / Episode checks
// ============================================================

// Structural checks — necessary but low weight (boilerplate)
const STRUCTURAL_CHECKS: Check[] = [
  {
    name: 'Lead paragraph before first heading',
    weight: 1,
    test: (wikitext) => {
      const firstHeading = wikitext.indexOf('==');
      if (firstHeading === -1) return false;
      const lead = wikitext.slice(0, firstHeading).trim();
      return lead.length > 0;
    },
  },
  {
    name: 'Infobox template with required fields',
    weight: 2,
    test: (wikitext) => {
      const infoboxMatch = wikitext.match(/\{\{Infobox\b[^}]*\}\}/s);
      if (!infoboxMatch) return false;
      const infobox = infoboxMatch[0];
      return infobox.includes('|') && infobox.length > 20;
    },
  },
  {
    name: 'Body section with substantive prose',
    weight: 1,
    test: (wikitext) => {
      const sectionRegex = /^==\s*[^=].*==\s*$/gm;
      let match: RegExpExecArray | null;
      const sectionStarts: number[] = [];
      while ((match = sectionRegex.exec(wikitext)) !== null) {
        sectionStarts.push(match.index + match[0].length);
      }
      for (let i = 0; i < sectionStarts.length; i++) {
        const start = sectionStarts[i];
        const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : wikitext.length;
        const content = wikitext.slice(start, end).trim();
        const headingBefore = wikitext.slice(Math.max(0, start - 80), start);
        if (/References|Bibliography/i.test(headingBefore)) continue;
        if (content.length > 50) return true;
      }
      return false;
    },
  },
  {
    name: 'References section with <references />',
    weight: 0.5,
    test: (wikitext) => /==\s*References\s*==/.test(wikitext) && /<references\s*\/>/.test(wikitext),
  },
  {
    name: 'Bibliography section with {{Cite vault}}',
    weight: 0.5,
    test: (wikitext) => /==\s*Bibliography\s*==/.test(wikitext) && /\{\{Cite vault\b/.test(wikitext),
  },
  {
    name: 'At least one category tag',
    weight: 0.5,
    test: (wikitext) => /\[\[Category:[^\]]+\]\]/.test(wikitext),
  },
];

// Depth checks — high weight, hard thresholds calibrated against reference pages
const DEPTH_CHECKS: Check[] = [
  {
    name: 'Prose word count >= 800',
    weight: 3,
    test: (wikitext) => countProseWords(wikitext) >= 800,
  },
  {
    name: 'At least 5 content sections',
    weight: 3,
    test: (wikitext) => countContentSections(wikitext) >= 5,
  },
  {
    name: 'At least 3 subsections (===)',
    weight: 2,
    test: (wikitext) => countSubsections(wikitext) >= 3,
  },
  {
    name: 'At least 10 unique inline citations',
    weight: 2,
    test: (wikitext) => countUniqueRefs(wikitext) >= 10,
  },
];

/**
 * Return depth checks with thresholds relative to the checkpoint stage.
 * Early checkpoints (draft) have lower thresholds since not all sources are available yet.
 */
function getDepthChecks(checkpointId?: string): Check[] {
  if (!checkpointId) return DEPTH_CHECKS;

  let proseMin: number;
  let sectionsMin: number;
  let citationsMin: number;

  if (checkpointId === 'draft') {
    proseMin = 400;
    sectionsMin = 3;
    citationsMin = 5;
  } else if (checkpointId === 'new-source' || checkpointId === 'episodes' || checkpointId === 'persons' || checkpointId === 'owner-input') {
    proseMin = 700;
    sectionsMin = 5;
    citationsMin = 10;
  } else {
    // verify, survey, or default — full thresholds
    return DEPTH_CHECKS;
  }

  return [
    {
      name: `Prose word count >= ${proseMin}`,
      weight: 3,
      test: (wikitext: string) => countProseWords(wikitext) >= proseMin,
    },
    {
      name: `At least ${sectionsMin} content sections`,
      weight: 3,
      test: (wikitext: string) => countContentSections(wikitext) >= sectionsMin,
    },
    {
      name: 'At least 3 subsections (===)',
      weight: 2,
      test: (wikitext: string) => countSubsections(wikitext) >= 3,
    },
    {
      name: `At least ${citationsMin} unique inline citations`,
      weight: 2,
      test: (wikitext: string) => countUniqueRefs(wikitext) >= citationsMin,
    },
  ];
}

// Content richness checks — evidence of deep engagement with sources
const RICHNESS_CHECKS: Check[] = [
  {
    name: 'Has blockquotes or dialogue',
    weight: 1.5,
    test: (wikitext) => {
      // Formal blockquote/dialogue templates
      if (/\{\{Blockquote\b/.test(wikitext) || /\{\{Dialogue\b/.test(wikitext) || /<blockquote>/i.test(wikitext)) return true;
      // Inline quoted passages (>15 chars) integrated into prose — editorial guide
      // recommends this for short quotes, reserving {{Blockquote}} for extended passages
      const inlineQuotes = wikitext.match(/"[^"]{15,}"/g);
      return inlineQuotes !== null && inlineQuotes.length >= 3;
    },
  },
  {
    name: 'Has embedded media (images, audio, video)',
    weight: 1.5,
    test: (wikitext) => /\[\[File:/.test(wikitext) || /\{\{Audio clip\b/.test(wikitext),
  },
];

const PERSON_EPISODE_LINK: Check = {
  name: 'Links to episode pages',
  weight: 0.5,
  test: (wikitext, opts) => {
    if (!opts?.expectedEpisodes || opts.expectedEpisodes.length === 0) return true;
    return opts.expectedEpisodes.some((ep) => wikitext.includes(`[[${ep}`));
  },
};

const EPISODE_PERSON_LINK: Check = {
  name: 'Links back to person page',
  weight: 0.5,
  test: (wikitext, opts) => {
    if (!opts?.subject) return true;
    return wikitext.includes(`[[${opts.subject}`);
  },
};

// ============================================================
// Source checks
// ============================================================

const SOURCE_CHECKS: Check[] = [
  {
    name: 'Has snapshot identifier',
    weight: 1,
    test: (wikitext) => /snapshot\s*=\s*\S+/i.test(wikitext) || /\{\{Cite vault\b[^}]*snapshot/i.test(wikitext),
  },
  {
    name: 'Has source type metadata',
    weight: 1,
    test: (wikitext) => {
      if (/type\s*=\s*\S+/i.test(wikitext)) return true;
      if (/\|\s*(facebook|whatsapp|photos|messages|transactions|voice[_ ]?notes|location)\s*[\|\}]/i.test(wikitext)) return true;
      const lead = wikitext.slice(0, 500).toLowerCase();
      return /\b(facebook|whatsapp|instagram|photos?|messages?|transactions?|voice\s*notes?|location|android|ios)\b/.test(lead);
    },
  },
  {
    name: 'Has file listing or content summary',
    weight: 1,
    test: (wikitext) => {
      const stripped = wikitext.replace(/\{\{[^}]*\}\}/g, '').replace(/^==.*==$/gm, '').trim();
      return stripped.length > 100;
    },
  },
  {
    name: 'Has at least one category tag',
    weight: 0.5,
    test: (wikitext) => /\[\[Category:[^\]]+\]\]/.test(wikitext),
  },
  {
    name: 'At least 2 content sections',
    weight: 2,
    test: (wikitext) => countContentSections(wikitext) >= 2,
  },
  {
    name: 'Substantive content (>= 500 chars beyond templates)',
    weight: 2,
    test: (wikitext) => {
      const stripped = wikitext
        .replace(/\{\{[^}]*\}\}/gs, '')
        .replace(/^==.*==$/gm, '')
        .replace(/\[\[Category:[^\]]+\]\]/g, '')
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
    test: (wikitext) => /^==\s*[^=].*==\s*$/m.test(wikitext),
  },
  {
    name: 'No lead prose before first heading',
    weight: 1,
    test: (wikitext) => {
      const firstHeading = wikitext.indexOf('==');
      if (firstHeading === -1) return false;
      const lead = wikitext.slice(0, firstHeading).trim();
      return lead.length === 0;
    },
  },
  {
    name: 'Has editorial decisions or rationale',
    weight: 2,
    test: (wikitext) =>
      /==\s*Editorial decisions\s*==/i.test(wikitext) ||
      /==\s*Editorial\s*==/i.test(wikitext) ||
      /\{\{Closed\}\}/i.test(wikitext) ||
      /\{\{Superseded\}\}/i.test(wikitext),
  },
  {
    name: 'Has active gaps or open questions',
    weight: 1.5,
    test: (wikitext) =>
      /\{\{Open\}\}/i.test(wikitext) ||
      /==\s*Active gaps\s*==/i.test(wikitext) ||
      /==\s*Open questions\s*==/i.test(wikitext),
  },
  {
    name: 'Has research notes or source index',
    weight: 1.5,
    test: (wikitext) =>
      /==\s*Research notes\s*==/i.test(wikitext) ||
      /==\s*Source index\s*==/i.test(wikitext) ||
      /==\s*Key dates\s*==/i.test(wikitext) ||
      /==\s*Key people\s*==/i.test(wikitext) ||
      /==\s*Sources?\s*==/i.test(wikitext),
  },
];

// ============================================================
// Grader
// ============================================================

function getChecks(role: PageRole, checkpointId?: string): Check[] {
  switch (role) {
    case 'person':
      return [...STRUCTURAL_CHECKS, ...getDepthChecks(checkpointId), ...RICHNESS_CHECKS, PERSON_EPISODE_LINK];
    case 'project':
      return [...STRUCTURAL_CHECKS, ...getDepthChecks(checkpointId), ...RICHNESS_CHECKS, PERSON_EPISODE_LINK];
    case 'episode':
      return [...STRUCTURAL_CHECKS, ...getDepthChecks(checkpointId), ...RICHNESS_CHECKS, EPISODE_PERSON_LINK];
    case 'source':
      return SOURCE_CHECKS;
    case 'talk':
      return TALK_CHECKS;
  }
}

export function gradeCompleteness(wikitext: string, options?: CompletenessOptions): GraderResult {
  const role = options?.role ?? 'person';
  const checks = getChecks(role, options?.checkpointId);
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);

  const details: GraderCheck[] = checks.map((check) => {
    const passed = check.test(wikitext, options);
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
