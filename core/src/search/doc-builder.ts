import type { Page } from '../pages/types.ts';
import type { DerivedRecord } from '../gedcom/types.ts';
import type { SearchDoc } from './types.ts';

export function buildSearchDoc(page: Page, derived?: DerivedRecord | null): SearchDoc {
  const places: string[] = [];
  const occupations: string[] = [];
  const related: string[] = [];

  if (derived) {
    if (derived.birth?.place) places.push(derived.birth.place);
    if (derived.death?.place) places.push(derived.death.place);
    for (const r of derived.residences) {
      if (r.place) places.push(r.place);
    }
    for (const o of derived.occupations) {
      if (o.title) occupations.push(o.title);
    }
    for (const p of [...derived.parents, ...derived.spouses, ...derived.children]) {
      related.push(p.name);
    }
  }

  return {
    slug: page.slug,
    title: page.meta.title,
    type: page.meta.type,
    body: page.body,
    aliases: page.meta.aliases.join(' '),
    categories: page.meta.categories.join(' '),
    places: places.join(' '),
    occupations: occupations.join(' '),
    related: related.join(' '),
  };
}
