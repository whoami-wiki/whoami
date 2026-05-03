# Family Browser: Relationship Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Given any two people in the data, render a human-readable relationship label ("great-aunt", "first cousin once removed", "no known relation") and the path between them, so a non-genealogist can ask "how am I related to X?" and get a real answer.

**Architecture:** Pure `core/src/family/relationship.ts` module. Algorithm: BFS up from each person collecting `{ ancestor → distance }` maps; the lowest common ancestor (LCA) is the ancestor with the smallest combined depth. Distances `(d1, d2)` from each party to the LCA classify the relationship using a small lookup table (parent/child, sibling, aunt/niece, cousin-N-times-removed). Surface via `view.relationshipFromRoot` on `getFamilyTree` (always computed against `SELF_RECORD`, the configured perspective). UI: a small "Relation to me" line under the Folio number on the person header — does not need a separate page yet.

**Tech Stack:** Same as features #1–#2.

---

## File Structure

- `core/src/family/relationship.ts` (new) — `computeRelationship({ records, fromRecord, toRecord })` returns `{ label, path } | null`. `path` is the chain of records from `from` → LCA → `to` for later UI use; `label` is the human relationship.
- `core/test/family/relationship.test.ts` (new) — covers self, parent, sibling, half-sibling, grandparent, great-grandparent, aunt/uncle, niece/nephew, first cousin, first cousin once removed, second cousin, unrelated.
- `frontend/lib/family.ts` (modify) — add `relationshipFromRoot: { label: string; path: string[] } | null` to `FamilyTreeView`. Compute by calling `computeRelationship` from `SELF_RECORD` to the **selected** record (skipped when selected is self).
- `frontend/app/family/tree/page.tsx` (modify) — render the label as a subtle line in the header (under the dates) when `relationshipFromRoot` is non-null.

---

### Task 1: Relationship — self, parent/child, grandparent

**Files:**
- Create: `core/src/family/relationship.ts`
- Test: `core/test/family/relationship.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// core/test/family/relationship.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRelationship } from '../../src/family/relationship.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

function person(record: string, name: string, patch: Partial<DerivedRecord> = {}): DerivedRecord {
  return {
    record, name,
    birth: null, death: null,
    parents: [], spouses: [], children: [],
    residences: [], occupations: [], sources: [],
    ...patch,
  };
}

test('computeRelationship: self', () => {
  const records = new Map<string, DerivedRecord>([['I1', person('I1', 'Self')]]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I1' });
  assert.equal(r?.label, 'self');
});

test('computeRelationship: parent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { children: [{ record: 'I1', name: 'Self', born: null }] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IF' });
  assert.equal(r?.label, 'father');
});

test('computeRelationship: child (inverse of parent)', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { children: [{ record: 'I1', name: 'Self', born: null }] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'IF', toRecord: 'I1' });
  assert.equal(r?.label, 'child');
});

test('computeRelationship: grandparent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IPGF' });
  assert.equal(r?.label, 'grandfather');
});
```

- [ ] **Step 2: Run tests (expect failure: module not found)**

Run: `cd core && npx tsx --test test/family/relationship.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal module**

```ts
// core/src/family/relationship.ts
import type { DerivedRecord, ParentRef } from '../gedcom/types.ts';

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
  /** Path of records from the source up to (and including) this ancestor. */
  path: string[];
  /** Role at each hop, used to determine father vs mother for first-degree. */
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

function findLCA(a: Map<string, AncestorHit>, b: Map<string, AncestorHit>): { record: string; aDist: number; bDist: number } | null {
  let best: { record: string; aDist: number; bDist: number } | null = null;
  for (const [rec, ah] of a) {
    const bh = b.get(rec);
    if (!bh) continue;
    const total = ah.distance + bh.distance;
    if (!best || (ah.distance + bh.distance) < (best.aDist + best.bDist)) {
      best = { record: rec, aDist: ah.distance, bDist: bh.distance };
      if (total === 0) break;
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

function siblingLabel(): string {
  return 'sibling';
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
  // equalDist = distance from each side to the LCA when they're equal (after subtracting removed)
  const cousinDegree = equalDist - 1;
  const ord = ORDINAL[cousinDegree - 1] ?? `${cousinDegree}th`;
  const rem = REMOVED_TIMES[removed] ?? `${removed} times removed`;
  return rem ? `${ord} cousin ${rem}` : `${ord} cousin`;
}

function classify(aDist: number, bDist: number, fromRoles: ('father' | 'mother')[]): string {
  if (aDist === 0 && bDist === 0) return 'self';
  if (aDist === 0) return descendantLabel(bDist);
  if (bDist === 0) return ancestorLabel(aDist, fromRoles[0]);
  if (aDist === 1 && bDist === 1) return siblingLabel();
  if (aDist === 1) return nieceNephewLabel(bDist);
  if (bDist === 1) return auntUncleLabel(aDist);
  // Cousins: the shorter side determines cousin degree, difference = removed.
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
  // path: from-side path up to LCA, then to-side path down (reverse, drop the duplicated LCA)
  const path = [...aHit.path, ...bHit.path.slice(0, -1).reverse()];
  return { label, path };
}
```

- [ ] **Step 4: Run tests**

Run: `cd core && npx tsx --test test/family/relationship.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add core/src/family/relationship.ts core/test/family/relationship.test.ts
git commit -m "feat: add relationship calculator with parent/child and grandparent labels"
```

---

### Task 2: Siblings, aunts/uncles, cousins, removed cousins

- [ ] **Step 1: Add tests**

```ts
test('computeRelationship: sibling', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['I2', person('I2', 'Sibling', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Sibling', born: null },
    ] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I2' });
  assert.equal(r?.label, 'sibling');
});

test('computeRelationship: aunt/uncle', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IA' });
  assert.equal(r?.label, 'aunt or uncle');
});

test('computeRelationship: niece/nephew (inverse)', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'IA', toRecord: 'I1' });
  assert.equal(r?.label, 'niece or nephew');
});

test('computeRelationship: first cousin', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IC', person('IC', 'Cousin', { parents: [{ record: 'IA', name: 'Aunt', role: 'mother' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IC' });
  assert.equal(r?.label, 'first cousin');
});

test('computeRelationship: first cousin once removed', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IC1', person('IC1', 'Cousin', { parents: [{ record: 'IA', name: 'Aunt', role: 'mother' }] })],
    ['IC2', person('IC2', 'CousinChild', { parents: [{ record: 'IC1', name: 'Cousin', role: 'mother' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IC2' });
  assert.equal(r?.label, 'first cousin once removed');
});

test('computeRelationship: second cousin', () => {
  // Two pairs of great-grandparents shared: a 2nd cousin is two generations down on each side from a common great-grandparent.
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa', { parents: [{ record: 'IGG', name: 'GreatGrandpa', role: 'father' }] })],
    ['IGG', person('IGG', 'GreatGrandpa')],
    ['I2', person('I2', '2C', { parents: [{ record: 'I2P', name: 'P2', role: 'father' }] })],
    ['I2P', person('I2P', 'P2', { parents: [{ record: 'I2GP', name: 'GP2', role: 'father' }] })],
    ['I2GP', person('I2GP', 'GP2', { parents: [{ record: 'IGG', name: 'GreatGrandpa', role: 'father' }] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I2' });
  assert.equal(r?.label, 'second cousin');
});
```

- [ ] **Step 2: Run tests (expect pass — implementation already covers these via classify())**

Run: `cd core && npx tsx --test test/family/relationship.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 3: Commit**

```bash
git add core/test/family/relationship.test.ts
git commit -m "chore: cover sibling, aunt, cousin, and removed-cousin classifications"
```

---

### Task 3: No-relation and missing-record cases

- [ ] **Step 1: Add tests**

```ts
test('computeRelationship: unrelated returns null', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self')],
    ['I2', person('I2', 'Stranger')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I2' });
  assert.equal(r, null);
});

test('computeRelationship: missing from-record returns null', () => {
  const records = new Map<string, DerivedRecord>([['I2', person('I2', 'Other')]]);
  const r = computeRelationship({ records, fromRecord: 'I999', toRecord: 'I2' });
  assert.equal(r, null);
});
```

- [ ] **Step 2: Run tests (expect pass)**

Run: `cd core && npx tsx --test test/family/relationship.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 3: Commit**

```bash
git add core/test/family/relationship.test.ts
git commit -m "chore: cover no-relation and missing-record cases"
```

---

### Task 4: Wire into frontend view + render in header

**Files:**
- Modify: `frontend/lib/family.ts`
- Modify: `frontend/app/family/tree/page.tsx`

- [ ] **Step 1: Add relationship to FamilyTreeView**

In `frontend/lib/family.ts`, add import:

```ts
import { computeRelationship } from '@core/family/relationship.ts';
```

Add to `FamilyTreeView`:

```ts
  relationshipFromRoot: { label: string; path: string[] } | null;
```

In `getFamilyTree`, after computing descendants, before `return`:

```ts
const relationshipFromRoot =
  targetForCohort === rootRecord
    ? null
    : computeRelationship({ records, fromRecord: rootRecord, toRecord: targetForCohort });
```

Add `relationshipFromRoot` to the returned object.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Render in header**

In `frontend/app/family/tree/page.tsx`, locate the header block where `Folio · {person.record}` is rendered (around line 119). Insert the relation line right after the dates/place paragraph:

```tsx
            {view.relationshipFromRoot ? (
              <p className="mt-1 font-display text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
                {view.relationshipFromRoot.label} · to me
              </p>
            ) : null}
```

- [ ] **Step 4: Visual verification**

Curl an ancestor route, grep for the relation label.

```bash
curl -sS "http://localhost:3001/family/tree?person=I28906360365" | grep -oE '(father|mother|grand[a-z]+|aunt[^<]*|first cousin[^<]*|second cousin) · to me'
```

Expected: at least one match.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/family.ts frontend/app/family/tree/page.tsx
git commit -m "feat: show relationship-to-me on family tree person header"
```

---

### Task 5: Final verification + roadmap

- [ ] **Step 1: Run all tests + typecheck**

```bash
cd core && npm test
cd frontend && npm test && npx tsc --noEmit
```

Expected: PASS — at least 111 core tests (12 new), frontend unchanged, typecheck clean.

- [ ] **Step 2: Update roadmap**

Mark feature #3 `(SHIPPED 2026-05-02)`.

- [ ] **Step 3: Commit roadmap**

```bash
git add docs/superpowers/plans/2026-05-02-family-explorer-roadmap.md docs/superpowers/plans/2026-05-02-family-relationship-calculator.md
git commit -m "chore: ship relationship calculator"
```
