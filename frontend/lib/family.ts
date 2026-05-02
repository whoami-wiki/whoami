import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { buildFamilyBrowser, type BrowserPerson } from '@core/family/browser.ts';
import { traceAncestry, type AncestryTree, type AncestorNode } from '@core/family/trace.ts';
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
}

export interface BrowserRelationView {
  record: string;
  name: string;
  detail: string | null;
  slug?: string;
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

function loadAllDerivedRecords(): Map<string, DerivedRecord> {
  const records = new Map<string, DerivedRecord>();
  for (const entry of readdirSync(DERIVED_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.yml')) continue;
    const raw = readFileSync(join(DERIVED_DIR, entry.name), 'utf-8');
    const record = yaml.load(raw) as DerivedRecord;
    if (record?.record && /^I\d+$/.test(record.record)) records.set(record.record, record);
  }
  return records;
}

async function buildSlugJoin(): Promise<(record: string, name: string) => string | undefined> {
  const { list } = await getCachedList();
  const slugByRecord = new Map<string, string>();
  const slugByName = new Map<string, string>();
  const slugifyName = (name: string): string =>
    name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  for (const page of list) {
    if (page.isArchived) continue;
    if (page.gedcomRecord) slugByRecord.set(page.gedcomRecord, page.slug);
    slugByName.set(slugifyName(page.title), page.slug);
  }
  return (record, name) => slugByRecord.get(record) ?? slugByName.get(slugifyName(name));
}

export async function getFamilyTree(
  rootRecord: string = SELF_RECORD,
  selectedRecord?: string | null,
): Promise<FamilyTreeView | null> {
  if (!/^I\d+$/.test(rootRecord)) return null;
  if (selectedRecord && !/^I\d+$/.test(selectedRecord)) return null;

  const records = loadAllDerivedRecords();
  const core = buildFamilyBrowser({ records, rootRecord, selectedRecord });
  if (!core) return null;

  const findSlug = await buildSlugJoin();
  const enrich = (person: BrowserPerson): BrowserPersonView => ({
    ...person,
    slug: findSlug(person.record, person.name),
  });
  const relation = (r: { record: string; name: string }, detail: string | null): BrowserRelationView => ({
    record: r.record,
    name: r.name,
    detail,
    slug: findSlug(r.record, r.name),
  });

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
  };
}
