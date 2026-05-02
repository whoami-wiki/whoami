import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { DerivedRecord } from '../gedcom/types.ts';

export type Side = 'self' | 'paternal' | 'maternal';

export interface AncestorNode {
  record: string;
  name: string;
  birth?: { date: string | null; place: string | null } | null;
  death?: { date: string | null; place: string | null } | null;
  /** 0 = self, 1 = parent, 2 = grandparent, 3 = great-grandparent, etc. */
  generation: number;
  /** 'self' for the root, otherwise which side of the tree they sit on. */
  side: Side;
  /** 'father' | 'mother' role in their child's family record. Undefined for self. */
  role?: 'father' | 'mother';
  /** Human-readable label like "Father", "Maternal grandmother". */
  label: string;
  /** Records from root to here (excludes self). [parent, grandparent, ...]. */
  pathFromRoot: string[];
}

export interface AncestryTree {
  self: AncestorNode;
  ancestors: AncestorNode[];
}

export interface TraceConfig {
  /** Root individual's GEDCOM record id. */
  rootRecord: string;
  /** Path to genealogy/derived/. */
  derivedDir: string;
  /** Max generations to walk up. Default 6. */
  maxDepth?: number;
}

const PREFIX_BY_GEN: Record<number, string> = {
  1: '',
  2: 'grand',
  3: 'great-grand',
  4: 'great-great-grand',
  5: 'great-great-great-grand',
  6: 'great-great-great-great-grand',
};

function makeLabel(generation: number, role: 'father' | 'mother' | undefined, side: Side): string {
  if (generation === 0) return 'Self';
  const noun = role === 'father' ? 'father' : role === 'mother' ? 'mother' : 'parent';
  if (generation === 1) return capitalize(noun);
  const prefix = PREFIX_BY_GEN[generation] ?? `${'great-'.repeat(generation - 2)}grand`;
  const sideLabel = side === 'self' ? '' : `${capitalize(side)} `;
  return `${sideLabel}${prefix}${noun}`.trim();
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function loadDerived(derivedDir: string, record: string): DerivedRecord | null {
  if (!/^I\d+$/.test(record)) return null;
  const path = join(derivedDir, `${record}.yml`);
  if (!existsSync(path)) return null;
  try {
    return yaml.load(readFileSync(path, 'utf-8')) as DerivedRecord;
  } catch {
    return null;
  }
}

export function traceAncestry(cfg: TraceConfig): AncestryTree | null {
  const root = loadDerived(cfg.derivedDir, cfg.rootRecord);
  if (!root) return null;

  const maxDepth = cfg.maxDepth ?? 6;
  const ancestors: AncestorNode[] = [];
  const seenPositions = new Set<string>();

  // BFS up parents. Each queue item carries everything we need to label the
  // node without extra disk reads; role comes from the descendant's parents[].
  interface QueueItem {
    record: string;
    role: 'father' | 'mother';
    generation: number;
    side: Side;
    path: string[];
  }
  const queue: QueueItem[] = root.parents.map(p => ({
    record: p.record,
    role: p.role,
    generation: 1,
    side: p.role === 'father' ? 'paternal' : 'maternal',
    path: [p.record],
  }));

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.generation > maxDepth) continue;
    const positionKey = `${item.side}:${item.generation}:${item.record}`;
    if (seenPositions.has(positionKey)) continue;
    seenPositions.add(positionKey);

    const rec = loadDerived(cfg.derivedDir, item.record);
    if (!rec) continue;

    ancestors.push({
      record: rec.record,
      name: rec.name,
      birth: rec.birth,
      death: rec.death,
      generation: item.generation,
      side: item.side,
      role: item.role,
      label: makeLabel(item.generation, item.role, item.side),
      pathFromRoot: item.path,
    });

    // Enqueue this ancestor's own parents at the next generation, preserving side.
    for (const next of rec.parents) {
      if (item.path.includes(next.record)) continue;
      queue.push({
        record: next.record,
        role: next.role,
        generation: item.generation + 1,
        side: item.side,
        path: [...item.path, next.record],
      });
    }
  }

  return {
    self: {
      record: root.record,
      name: root.name,
      birth: root.birth,
      death: root.death,
      generation: 0,
      side: 'self',
      label: 'Self',
      pathFromRoot: [],
    },
    ancestors,
  };
}
