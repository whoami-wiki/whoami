import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { buildFamilyBrowser, type BrowserPerson } from '@core/family/browser.ts';
import { traceAncestry, type AncestryTree, type AncestorNode } from '@core/family/trace.ts';
import { computeCohort } from '@core/family/cohort.ts';
import { computeDescendants } from '@core/family/descendants.ts';
import { computeRelationship } from '@core/family/relationship.ts';
import { computeTimeline, type TimelineEntry, type TimelineView } from '@core/family/timeline.ts';
import { groupBirthplaces, type PlacesView } from '@core/family/places.ts';

export interface TimelineEntryView extends TimelineEntry {
  portrait?: string;
}

export interface TimelineViewWithPortraits {
  entries: TimelineEntryView[];
  range: TimelineView['range'];
}
import type { DerivedRecord } from '@core/gedcom/types.ts';
import { DERIVED_DIR, SELF_RECORD } from './env';
import { getCachedList } from './server-services';

export type { AncestorNode, AncestryTree };

export interface AncestorView extends AncestorNode {
  /** Wiki slug for this individual, if a page exists. */
  slug?: string;
}

export interface FamilyView {
  self: AncestorView;
  /** Generations as ordered groups (1 = parents, 2 = grandparents, etc.). */
  byGeneration: { generation: number; ancestors: AncestorView[] }[];
}

export interface BrowserPersonView extends BrowserPerson {
  slug?: string;
  portrait?: string;
}

export interface BrowserRelationView {
  record: string;
  name: string;
  detail: string | null;
  slug?: string;
  portrait?: string;
}

export interface BrowserSiblingView extends BrowserRelationView {
  kind: 'full' | 'half';
}

export interface BrowserCousinView extends BrowserRelationView {
  via: string;
}

export interface BrowserDescendantView extends BrowserRelationView {
  generation: number;
  via: string;
}

export interface CoverageGenerationView {
  generation: number;
  known: number;
  possible: number;
}

export interface ResearchFrontierView {
  record: string;
  name: string;
  generation: number;
  side: 'paternal' | 'maternal';
  slug?: string;
  portrait?: string;
  missing: 'father' | 'mother' | 'both';
}

export interface CoverageView {
  byGeneration: CoverageGenerationView[];
  knownTotal: number;
  possibleTotal: number;
  frontier: ResearchFrontierView[];
}

export interface FamilyTreeView {
  root: BrowserPersonView;
  selected: BrowserPersonView;
  byGeneration: {
    generation: number;
    paternal: BrowserPersonView[];
    maternal: BrowserPersonView[];
  }[];
  selectedRelations: {
    parents: BrowserRelationView[];
    spouses: BrowserRelationView[];
    children: BrowserRelationView[];
  };
  cohort: {
    siblings: BrowserSiblingView[];
    cousins: BrowserCousinView[];
  };
  descendants: {
    byGeneration: { generation: number; people: BrowserDescendantView[] }[];
    total: number;
  };
  coverage: CoverageView;
  places: PlacesView;
  timeline: TimelineViewWithPortraits;
  relationshipToSelf: { label: string; path: string[]; perspective: { record: string; name: string; isMe: boolean } } | null;
}

/**
 * Build a server-side family view for the configured SELF_RECORD.
 * Joins each ancestor with their wiki page slug (if one exists with a matching
 * `gedcom.record` in frontmatter), so the UI can deep-link to person pages.
 */
export async function getFamily(): Promise<FamilyView | null> {
  const tree = traceAncestry({ rootRecord: SELF_RECORD, derivedDir: DERIVED_DIR });
  if (!tree) return null;

  const { list } = await getCachedList();
  const slugByRecord = new Map<string, string>();
  for (const page of list) {
    if (page.isArchived) continue;
    if (page.gedcomRecord) slugByRecord.set(page.gedcomRecord, page.slug);
  }

  function slugifyName(name: string): string {
    return name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const titleByName = new Map<string, string>();
  for (const page of list) {
    if (page.isArchived) continue;
    titleByName.set(slugifyName(page.title), page.slug);
  }
  const findSlug = (a: AncestorNode): string | undefined =>
    slugByRecord.get(a.record) ?? titleByName.get(slugifyName(a.name));

  const enrich = (a: AncestorNode): AncestorView => ({ ...a, slug: findSlug(a) });

  const grouped = new Map<number, AncestorView[]>();
  for (const a of tree.ancestors) {
    const view = enrich(a);
    const arr = grouped.get(a.generation);
    if (arr) arr.push(view);
    else grouped.set(a.generation, [view]);
  }
  // Within each generation, paternal first then maternal, alphabetical within side.
  for (const arr of grouped.values()) {
    arr.sort((a, b) => {
      if (a.side !== b.side) return a.side === 'paternal' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  const byGeneration = [...grouped.entries()]
    .sort(([g1], [g2]) => g1 - g2)
    .map(([generation, ancestors]) => ({ generation, ancestors }));

  return {
    self: enrich(tree.self),
    byGeneration,
  };
}

export function loadDerivedRecordsForTree(derivedDir: string = DERIVED_DIR): Map<string, DerivedRecord> {
  const records = new Map<string, DerivedRecord>();
  let entries;
  try {
    entries = readdirSync(derivedDir, { withFileTypes: true });
  } catch {
    return records;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.yml')) continue;
    try {
      const raw = readFileSync(join(derivedDir, entry.name), 'utf-8');
      const record = yaml.load(raw) as DerivedRecord;
      if (record?.record && /^I\d+$/.test(record.record)) records.set(record.record, record);
    } catch {
      continue;
    }
  }
  return records;
}

const DERIVED_RECORDS_TTL_MS = 2000;
let _derivedRecordsCache: { records: Map<string, DerivedRecord>; expiresAt: number; mtimeMs: number } | null = null;

function getCachedDerivedRecords(): Map<string, DerivedRecord> {
  const now = Date.now();
  let mtimeMs = 0;
  try {
    mtimeMs = statSync(DERIVED_DIR).mtimeMs;
  } catch {
    return new Map();
  }
  if (_derivedRecordsCache && _derivedRecordsCache.expiresAt > now && _derivedRecordsCache.mtimeMs === mtimeMs) {
    return _derivedRecordsCache.records;
  }
  const records = loadDerivedRecordsForTree();
  _derivedRecordsCache = { records, expiresAt: now + DERIVED_RECORDS_TTL_MS, mtimeMs };
  return records;
}

interface PageJoinResult {
  slug?: string;
  portrait?: string;
}

async function buildPageJoin(): Promise<(record: string, name: string) => PageJoinResult> {
  const { list } = await getCachedList();
  const byRecord = new Map<string, PageJoinResult>();
  const byName = new Map<string, PageJoinResult>();
  const slugifyName = (name: string): string =>
    name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  for (const page of list) {
    if (page.isArchived) continue;
    const entry: PageJoinResult = { slug: page.slug, portrait: page.portrait };
    if (page.gedcomRecord) byRecord.set(page.gedcomRecord, entry);
    byName.set(slugifyName(page.title), entry);
  }
  return (record, name) => byRecord.get(record) ?? byName.get(slugifyName(name)) ?? {};
}

async function buildSlugJoin(): Promise<(record: string, name: string) => string | undefined> {
  const join = await buildPageJoin();
  return (record, name) => join(record, name).slug;
}

export async function getFamilyTree(
  rootRecord: string = SELF_RECORD,
  selectedRecord?: string | null,
  perspectiveRecord?: string | null,
): Promise<FamilyTreeView | null> {
  if (!/^I\d+$/.test(rootRecord)) return null;
  if (perspectiveRecord && !/^I\d+$/.test(perspectiveRecord)) return null;
  if (selectedRecord && !/^I\d+$/.test(selectedRecord)) return null;

  const records = getCachedDerivedRecords();
  const core = buildFamilyBrowser({ records, rootRecord, selectedRecord });
  if (!core) return null;

  const findPage = await buildPageJoin();
  const findSlug = (record: string, name: string) => findPage(record, name).slug;
  const enrich = (person: BrowserPerson): BrowserPersonView => {
    const page = findPage(person.record, person.name);
    return { ...person, slug: page.slug, portrait: page.portrait };
  };
  const relation = (r: { record: string; name: string }, detail: string | null): BrowserRelationView => {
    const page = findPage(r.record, r.name);
    return { record: r.record, name: r.name, detail, slug: page.slug, portrait: page.portrait };
  };

  const targetForCohort = selectedRecord ?? rootRecord;
  const cohortRaw = computeCohort({ records, targetRecord: targetForCohort });
  const siblings: BrowserSiblingView[] = cohortRaw.siblings.map(s => {
    const page = findPage(s.record, s.name);
    return {
      record: s.record,
      name: s.name,
      detail: yearLabel(s.birth?.date ?? null),
      slug: page.slug,
      portrait: page.portrait,
      kind: s.kind,
    };
  });
  const cousins: BrowserCousinView[] = cohortRaw.cousins.map(c => {
    const page = findPage(c.record, c.name);
    return {
      record: c.record,
      name: c.name,
      detail: yearLabel(c.birth?.date ?? null),
      slug: page.slug,
      portrait: page.portrait,
      via: c.via.parentName,
    };
  });

  const coverageByGen: CoverageGenerationView[] = core.byGeneration.map(group => {
    const possible = 2 ** group.generation;
    const known = group.paternal.length + group.maternal.length;
    return { generation: group.generation, known, possible };
  });
  const knownTotal = coverageByGen.reduce((s, g) => s + g.known, 0);
  const possibleTotal = coverageByGen.reduce((s, g) => s + g.possible, 0);

  const frontierAll: ResearchFrontierView[] = [];
  for (const group of core.byGeneration) {
    const consider = [
      ...group.paternal.map(p => ({ p, side: 'paternal' as const })),
      ...group.maternal.map(p => ({ p, side: 'maternal' as const })),
    ];
    for (const { p, side } of consider) {
      const rec = records.get(p.record);
      if (!rec) continue;
      const hasFather = rec.parents.some(r => r.role === 'father');
      const hasMother = rec.parents.some(r => r.role === 'mother');
      if (hasFather && hasMother) continue;
      const page = findPage(p.record, p.name);
      frontierAll.push({
        record: p.record,
        name: p.name,
        generation: p.generation,
        side,
        slug: page.slug,
        portrait: page.portrait,
        missing: !hasFather && !hasMother ? 'both' : (!hasFather ? 'father' : 'mother'),
      });
    }
  }
  frontierAll.sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name));
  const frontier = frontierAll.slice(0, 12);

  const flatLineage = core.byGeneration.flatMap(g => [
    ...g.paternal.map(p => ({ record: p.record, name: p.name, generation: p.generation, side: 'paternal' as const })),
    ...g.maternal.map(p => ({ record: p.record, name: p.name, generation: p.generation, side: 'maternal' as const })),
  ]);
  const placesEntries = [
    { record: targetForCohort, name: records.get(targetForCohort)?.name ?? '', place: records.get(targetForCohort)?.birth?.place ?? null },
    ...flatLineage.map(p => ({ record: p.record, name: p.name, place: records.get(p.record)?.birth?.place ?? null })),
  ];
  const places = groupBirthplaces({ entries: placesEntries });

  const timelineRaw = computeTimeline({ records, self: targetForCohort, lineage: flatLineage });
  const timeline: TimelineViewWithPortraits = {
    range: timelineRaw.range,
    entries: timelineRaw.entries.map(e => ({ ...e, portrait: findPage(e.record, e.name).portrait })),
  };

  const descendantsRaw = computeDescendants({ records, rootRecord: targetForCohort });
  const descendantsByGen = descendantsRaw.byGeneration.map(g => ({
    generation: g.generation,
    people: g.people.map(p => {
      const page = findPage(p.record, p.name);
      return {
        record: p.record,
        name: p.name,
        detail: yearLabel(p.birth?.date ?? null),
        slug: page.slug,
        portrait: page.portrait,
        generation: p.generation,
        via: p.via.parentName,
      } satisfies BrowserDescendantView;
    }),
  }));

  return {
    root: enrich(core.root),
    selected: enrich(core.selected),
    byGeneration: core.byGeneration.map(group => ({
      generation: group.generation,
      paternal: group.paternal.map(enrich),
      maternal: group.maternal.map(enrich),
    })),
    selectedRelations: {
      parents: core.selectedRelations.parents.map(r => relation(r, r.role)),
      spouses: core.selectedRelations.spouses.map(r => relation(r, r.married ? `m. ${r.married}` : null)),
      children: core.selectedRelations.children.map(r => relation(r, r.born ? `b. ${r.born}` : null)),
    },
    cohort: { siblings, cousins },
    descendants: { byGeneration: descendantsByGen, total: descendantsRaw.total },
    coverage: { byGeneration: coverageByGen, knownTotal, possibleTotal, frontier },
    places,
    timeline,
    relationshipToSelf: (() => {
      const fromRecord = perspectiveRecord ?? SELF_RECORD;
      if (targetForCohort === fromRecord) return null;
      const rel = computeRelationship({ records, fromRecord, toRecord: targetForCohort });
      if (!rel) return null;
      const fromRec = records.get(fromRecord);
      return {
        label: rel.label,
        path: rel.path,
        perspective: {
          record: fromRecord,
          name: fromRec?.name ?? 'me',
          isMe: fromRecord === SELF_RECORD,
        },
      };
    })(),
  };
}

function yearLabel(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/\b(\d{4})\b/);
  return m ? `b. ${m[1]}` : null;
}
