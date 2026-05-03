import type { DerivedRecord } from '../gedcom/types.ts';

export interface RelationshipResult {
  label: string;
  /** Records from `from` up to LCA then back down to `to`. Includes both endpoints. */
  path: string[];
}

export interface ComputeRelationshipConfig {
  records: Map<string, DerivedRecord>;
  fromRecord: string;
  toRecord: string;
}

interface AncestorHit {
  distance: number;
  path: string[];
  roles: ('father' | 'mother')[];
}

function ancestorMap(records: Map<string, DerivedRecord>, start: string): Map<string, AncestorHit> {
  const out = new Map<string, AncestorHit>();
  out.set(start, { distance: 0, path: [start], roles: [] });
  const queue: string[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const hit = out.get(cur)!;
    const rec = records.get(cur);
    if (!rec) continue;
    for (const parent of rec.parents) {
      if (out.has(parent.record)) continue;
      out.set(parent.record, {
        distance: hit.distance + 1,
        path: [...hit.path, parent.record],
        roles: [...hit.roles, parent.role],
      });
      queue.push(parent.record);
    }
  }
  return out;
}

function findLCA(
  a: Map<string, AncestorHit>,
  b: Map<string, AncestorHit>,
): { record: string; aDist: number; bDist: number } | null {
  let best: { record: string; aDist: number; bDist: number } | null = null;
  for (const [rec, ah] of a) {
    const bh = b.get(rec);
    if (!bh) continue;
    if (!best || ah.distance + bh.distance < best.aDist + best.bDist) {
      best = { record: rec, aDist: ah.distance, bDist: bh.distance };
      if (best.aDist + best.bDist === 0) break;
    }
  }
  return best;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];
const REMOVED_TIMES = ['', 'once removed', 'twice removed', 'three times removed', 'four times removed'];

function ancestorLabel(degree: number, role: 'father' | 'mother' | undefined): string {
  if (degree === 1) return role === 'mother' ? 'mother' : role === 'father' ? 'father' : 'parent';
  if (degree === 2) return role === 'mother' ? 'grandmother' : role === 'father' ? 'grandfather' : 'grandparent';
  const greats = degree - 2;
  const noun = role === 'mother' ? 'grandmother' : role === 'father' ? 'grandfather' : 'grandparent';
  return `${'great-'.repeat(greats)}${noun}`;
}

function descendantLabel(degree: number): string {
  if (degree === 1) return 'child';
  if (degree === 2) return 'grandchild';
  const greats = degree - 2;
  return `${'great-'.repeat(greats)}grandchild`;
}

function auntUncleLabel(degree: number): string {
  if (degree === 2) return 'aunt or uncle';
  const greats = degree - 2;
  return `${'great-'.repeat(greats)}aunt or uncle`;
}

function nieceNephewLabel(degree: number): string {
  if (degree === 2) return 'niece or nephew';
  const greats = degree - 2;
  return `${'great-'.repeat(greats)}niece or nephew`;
}

function cousinLabel(equalDist: number, removed: number): string {
  const cousinDegree = equalDist - 1;
  const ord = ORDINAL[cousinDegree - 1] ?? `${cousinDegree}th`;
  const rem = REMOVED_TIMES[removed] ?? `${removed} times removed`;
  return rem ? `${ord} cousin ${rem}` : `${ord} cousin`;
}

function classify(aDist: number, bDist: number, fromRoles: ('father' | 'mother')[]): string {
  if (aDist === 0 && bDist === 0) return 'self';
  if (aDist === 0) return descendantLabel(bDist);
  // Target's gender comes from their role in their child's family — the LAST hop in the chain.
  if (bDist === 0) return ancestorLabel(aDist, fromRoles[fromRoles.length - 1]);
  if (aDist === 1 && bDist === 1) return 'sibling';
  if (aDist === 1) return nieceNephewLabel(bDist);
  if (bDist === 1) return auntUncleLabel(aDist);
  const min = Math.min(aDist, bDist);
  const removed = Math.abs(aDist - bDist);
  return cousinLabel(min, removed);
}

export function computeRelationship(cfg: ComputeRelationshipConfig): RelationshipResult | null {
  if (!cfg.records.has(cfg.fromRecord) || !cfg.records.has(cfg.toRecord)) return null;
  const aAnc = ancestorMap(cfg.records, cfg.fromRecord);
  const bAnc = ancestorMap(cfg.records, cfg.toRecord);
  const lca = findLCA(aAnc, bAnc);
  if (!lca) return null;
  const aHit = aAnc.get(lca.record)!;
  const bHit = bAnc.get(lca.record)!;
  const label = classify(aHit.distance, bHit.distance, aHit.roles);
  const path = [...aHit.path, ...bHit.path.slice(0, -1).reverse()];
  return { label, path };
}
