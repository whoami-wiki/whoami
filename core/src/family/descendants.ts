import type { DatedEvent, DerivedRecord } from '../gedcom/types.ts';
import { byBirthThenName } from './sort.ts';

export interface DescendantPerson {
  record: string;
  name: string;
  birth: DatedEvent | null;
  generation: number;
  via: { parentRecord: string; parentName: string };
}

export interface DescendantsView {
  byGeneration: { generation: number; people: DescendantPerson[] }[];
  total: number;
}

export interface ComputeDescendantsConfig {
  records: Map<string, DerivedRecord>;
  rootRecord: string;
  maxDepth?: number;
}

export function computeDescendants(cfg: ComputeDescendantsConfig): DescendantsView {
  const root = cfg.records.get(cfg.rootRecord);
  if (!root) return { byGeneration: [], total: 0 };
  const maxDepth = cfg.maxDepth ?? 5;

  const seen = new Set<string>([cfg.rootRecord]);
  const byGen = new Map<number, DescendantPerson[]>();

  interface QueueItem {
    record: string;
    name: string;
    generation: number;
    via: { parentRecord: string; parentName: string };
  }
  const queue: QueueItem[] = root.children.map(c => ({
    record: c.record,
    name: c.name,
    generation: 1,
    via: { parentRecord: root.record, parentName: root.name },
  }));

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.generation > maxDepth) continue;
    if (seen.has(item.record)) continue;
    seen.add(item.record);

    const rec = cfg.records.get(item.record);
    const dperson: DescendantPerson = {
      record: item.record,
      name: item.name,
      birth: rec?.birth ?? null,
      generation: item.generation,
      via: item.via,
    };
    const arr = byGen.get(item.generation) ?? [];
    arr.push(dperson);
    byGen.set(item.generation, arr);

    if (rec) {
      for (const child of rec.children) {
        queue.push({
          record: child.record,
          name: child.name,
          generation: item.generation + 1,
          via: { parentRecord: rec.record, parentName: rec.name },
        });
      }
    }
  }

  for (const arr of byGen.values()) {
    arr.sort(byBirthThenName);
  }
  const byGeneration = [...byGen.entries()]
    .sort(([a], [b]) => a - b)
    .map(([generation, people]) => ({ generation, people }));
  const total = byGeneration.reduce((s, g) => s + g.people.length, 0);
  return { byGeneration, total };
}

