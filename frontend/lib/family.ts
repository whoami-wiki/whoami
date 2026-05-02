import { traceAncestry, type AncestryTree, type AncestorNode } from '@core/family/trace.ts';
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
