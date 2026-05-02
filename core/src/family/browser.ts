import type { DatedEvent, DerivedRecord } from '../gedcom/types.ts';
import type { Side } from './trace.ts';

export interface BrowserPerson {
  record: string;
  name: string;
  birth: DatedEvent | null;
  death: DatedEvent | null;
  generation: number;
  side: Side;
  role?: 'father' | 'mother';
  label: string;
  pathFromRoot: string[];
}

export interface BrowserGeneration {
  generation: number;
  paternal: BrowserPerson[];
  maternal: BrowserPerson[];
}

export interface BrowserRelations {
  parents: { record: string; name: string; role: 'father' | 'mother' }[];
  spouses: { record: string; name: string; married: string | null }[];
  children: { record: string; name: string; born: string | null }[];
}

export interface FamilyBrowserView {
  root: BrowserPerson;
  selected: BrowserPerson;
  byGeneration: BrowserGeneration[];
  selectedRelations: BrowserRelations;
}

export interface BuildFamilyBrowserConfig {
  records: Map<string, DerivedRecord>;
  rootRecord: string;
  selectedRecord?: string | null;
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

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function labelFor(generation: number, role: 'father' | 'mother' | undefined, side: Side): string {
  if (generation === 0) return 'Self';
  const noun = role === 'father' ? 'father' : role === 'mother' ? 'mother' : 'parent';
  if (generation === 1) return capitalize(noun);
  const prefix = PREFIX_BY_GEN[generation] ?? `${'great-'.repeat(generation - 2)}grand`;
  const sideLabel = side === 'self' ? '' : `${capitalize(side)} `;
  return `${sideLabel}${prefix}${noun}`.trim();
}

function toPerson(
  rec: DerivedRecord,
  generation: number,
  side: Side,
  role: 'father' | 'mother' | undefined,
  pathFromRoot: string[],
): BrowserPerson {
  return {
    record: rec.record,
    name: rec.name,
    birth: rec.birth,
    death: rec.death,
    generation,
    side,
    role,
    label: labelFor(generation, role, side),
    pathFromRoot,
  };
}

export function buildFamilyBrowser(cfg: BuildFamilyBrowserConfig): FamilyBrowserView | null {
  const root = cfg.records.get(cfg.rootRecord);
  if (!root) return null;

  const maxDepth = cfg.maxDepth ?? 6;
  const ancestors: BrowserPerson[] = [];
  const seenPositions = new Set<string>();
  const queue = root.parents.map(parent => ({
    record: parent.record,
    generation: 1,
    side: parent.role === 'father' ? 'paternal' as const : 'maternal' as const,
    role: parent.role,
    pathFromRoot: [parent.record],
  }));

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.generation > maxDepth) continue;
    const positionKey = `${item.side}:${item.generation}:${item.record}`;
    if (seenPositions.has(positionKey)) continue;
    seenPositions.add(positionKey);

    const rec = cfg.records.get(item.record);
    if (!rec) continue;
    ancestors.push(toPerson(rec, item.generation, item.side, item.role, item.pathFromRoot));

    for (const parent of rec.parents) {
      if (item.pathFromRoot.includes(parent.record)) continue;
      queue.push({
        record: parent.record,
        generation: item.generation + 1,
        side: item.side,
        role: parent.role,
        pathFromRoot: [...item.pathFromRoot, parent.record],
      });
    }
  }

  const groups = new Map<number, BrowserGeneration>();
  for (const person of ancestors) {
    let group = groups.get(person.generation);
    if (!group) {
      group = { generation: person.generation, paternal: [], maternal: [] };
      groups.set(person.generation, group);
    }
    if (person.side === 'paternal') group.paternal.push(person);
    if (person.side === 'maternal') group.maternal.push(person);
  }

  for (const group of groups.values()) {
    group.paternal.sort((a, b) => a.name.localeCompare(b.name));
    group.maternal.sort((a, b) => a.name.localeCompare(b.name));
  }

  const selectedRec = cfg.selectedRecord ? cfg.records.get(cfg.selectedRecord) : null;
  const selected = selectedRec ?? root;
  const selectedAncestor = ancestors.find(a => a.record === selected.record);

  return {
    root: toPerson(root, 0, 'self', undefined, []),
    selected: selectedAncestor ?? toPerson(selected, 0, 'self', undefined, []),
    byGeneration: [...groups.values()].sort((a, b) => a.generation - b.generation),
    selectedRelations: {
      parents: selected.parents,
      spouses: selected.spouses,
      children: selected.children,
    },
  };
}
