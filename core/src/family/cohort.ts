import type { DatedEvent, DerivedRecord } from '../gedcom/types.ts';
import { byBirthThenName } from './sort.ts';

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

  // Cousins = children of the target's aunts and uncles.
  // Aunt/uncle = a child of any of the target's grandparents who is not the target's parent.
  const exclude = new Set<string>([target.record, ...siblingsMap.keys()]);
  const cousinsMap = new Map<string, CohortCousin>();
  for (const parent of target.parents) {
    const parentRec = cfg.records.get(parent.record);
    if (!parentRec) continue;
    for (const grandparent of parentRec.parents) {
      const grandparentRec = cfg.records.get(grandparent.record);
      if (!grandparentRec) continue;
      for (const auntUncle of grandparentRec.children) {
        if (auntUncle.record === parent.record) continue;
        const auntUncleRec = cfg.records.get(auntUncle.record);
        if (!auntUncleRec) continue;
        for (const cousin of auntUncleRec.children) {
          if (exclude.has(cousin.record)) continue;
          if (cousinsMap.has(cousin.record)) continue;
          const cousinRec = cfg.records.get(cousin.record);
          cousinsMap.set(cousin.record, {
            record: cousin.record,
            name: cousin.name,
            birth: cousinRec?.birth ?? null,
            via: { parentRecord: auntUncle.record, parentName: auntUncle.name },
          });
        }
      }
    }
  }

  return {
    siblings: [...siblingsMap.values()].sort(byBirthThenName),
    cousins: [...cousinsMap.values()].sort(byBirthThenName),
  };
}

