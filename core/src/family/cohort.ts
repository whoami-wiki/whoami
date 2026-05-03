import type { DatedEvent, DerivedRecord } from '../gedcom/types.ts';

export interface CohortSibling {
  record: string;
  name: string;
  birth: DatedEvent | null;
  kind: 'full' | 'half';
}

export interface CohortCousin {
  record: string;
  name: string;
  birth: DatedEvent | null;
  via: { parentRecord: string; parentName: string };
}

export interface Cohort {
  siblings: CohortSibling[];
  cousins: CohortCousin[];
}

export interface ComputeCohortConfig {
  records: Map<string, DerivedRecord>;
  targetRecord: string;
}

export function computeCohort(cfg: ComputeCohortConfig): Cohort {
  const target = cfg.records.get(cfg.targetRecord);
  if (!target) return { siblings: [], cousins: [] };

  const targetParentIds = new Set(target.parents.map(p => p.record));
  const siblingsMap = new Map<string, CohortSibling>();
  for (const parent of target.parents) {
    const parentRec = cfg.records.get(parent.record);
    if (!parentRec) continue;
    for (const child of parentRec.children) {
      if (child.record === target.record) continue;
      const existing = siblingsMap.get(child.record);
      if (existing) {
        existing.kind = 'full';
        continue;
      }
      const childRec = cfg.records.get(child.record);
      const sharedParents = childRec
        ? childRec.parents.filter(p => targetParentIds.has(p.record)).length
        : 1;
      siblingsMap.set(child.record, {
        record: child.record,
        name: child.name,
        birth: childRec?.birth ?? null,
        kind: sharedParents >= 2 ? 'full' : 'half',
      });
    }
  }

  return {
    siblings: [...siblingsMap.values()].sort(byBirthThenName),
    cousins: [],
  };
}

function byBirthThenName(
  a: { birth: DatedEvent | null; name: string },
  b: { birth: DatedEvent | null; name: string },
): number {
  const ay = yearOf(a.birth);
  const by = yearOf(b.birth);
  if (ay !== null && by !== null && ay !== by) return ay - by;
  if (ay !== null && by === null) return -1;
  if (ay === null && by !== null) return 1;
  return a.name.localeCompare(b.name);
}

function yearOf(d: DatedEvent | null): number | null {
  if (!d?.date) return null;
  const m = d.date.match(/\b(\d{4})\b/);
  return m ? Number(m[1]) : null;
}
