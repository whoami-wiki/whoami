# Family Browser: Descendants View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show everyone who descends from the selected person, grouped by generation — so a relative looking at "Great-Grandpa Joe" can see all his children, grandchildren, and great-grandchildren in one view.

**Architecture:** Add a pure `core/src/family/descendants.ts` module that walks `children[]` recursively from a target record up to a depth limit. Returns `{ byGeneration: { generation, people }[], total }`. Expose via `frontend/lib/family.ts` as `view.descendants`. Render in a new `<Descendants>` section on `/family/tree` placed after `<Family>` and before `<Lineage>`, grouped by generation with the same visual idiom as the lineage columns (single-column card list per generation, no paternal/maternal split since descent doesn't have a side relative to the root).

**Tech Stack:** Same as feature #1 — TypeScript, `node:test`, existing UI primitives.

---

## File Structure

- `core/src/family/descendants.ts` (new) — `computeDescendants({ records, rootRecord, maxDepth? })` returns `{ byGeneration, total }`. Each person carries `record`, `name`, `birth`, `generation` (1 = child, 2 = grandchild), and `via` (parent record + name in the descent chain — the immediate parent at the previous generation).
- `core/test/family/descendants.test.ts` (new) — covers single-line descent, multi-child branching, depth limit, missing records, cycle/diamond safety (target appearing in own descendants via data error).
- `frontend/lib/family.ts` (modify) — `FamilyTreeView` gains `descendants: { byGeneration: { generation, people }[]; total }` where `people: BrowserDescendantView[]` extends `BrowserRelationView` with `via: string` (immediate-parent name).
- `frontend/app/family/tree/page.tsx` (modify) — new `<Descendants>` section after `<Family>`, before `<Lineage>`. Uses `SectionHeader` and a single `Card` with stacked `GenerationBlock`-style sub-headers per generation, listing each descendant with `via` meta.

---

### Task 1: Descendants module — direct children

**Files:**
- Create: `core/src/family/descendants.ts`
- Test: `core/test/family/descendants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// core/test/family/descendants.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDescendants } from '../../src/family/descendants.ts';
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

test('computeDescendants: direct children form generation 1', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [
      { record: 'I2', name: 'A', born: null },
      { record: 'I3', name: 'B', born: null },
    ] })],
    ['I2', person('I2', 'A')],
    ['I3', person('I3', 'B')],
  ]);

  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 2);
  assert.equal(result.byGeneration.length, 1);
  assert.equal(result.byGeneration[0]!.generation, 1);
  assert.deepEqual(result.byGeneration[0]!.people.map(p => p.record), ['I2', 'I3']);
  assert.equal(result.byGeneration[0]!.people[0]!.via.parentName, 'Root');
});
```

- [ ] **Step 2: Run test (expect failure: module not found)**

Run: `cd core && npx tsx --test test/family/descendants.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement minimal module**

```ts
// core/src/family/descendants.ts
import type { DatedEvent, DerivedRecord } from '../gedcom/types.ts';

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

  interface QueueItem { record: string; name: string; generation: number; via: { parentRecord: string; parentName: string } }
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
    const person: DescendantPerson = {
      record: item.record,
      name: item.name,
      birth: rec?.birth ?? null,
      generation: item.generation,
      via: item.via,
    };
    const arr = byGen.get(item.generation) ?? [];
    arr.push(person);
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

function byBirthThenName(a: DescendantPerson, b: DescendantPerson): number {
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
```

- [ ] **Step 4: Run test (expect pass)**

Run: `cd core && npx tsx --test test/family/descendants.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add core/src/family/descendants.ts core/test/family/descendants.test.ts
git commit -m "feat: add descendants module with direct children"
```

---

### Task 2: Multi-generation descent and depth limit

- [ ] **Step 1: Add tests**

```ts
test('computeDescendants: walks multiple generations with via attribution', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'Child', born: null }] })],
    ['I2', person('I2', 'Child', { children: [{ record: 'I3', name: 'Grandchild', born: null }] })],
    ['I3', person('I3', 'Grandchild', { children: [{ record: 'I4', name: 'Great', born: null }] })],
    ['I4', person('I4', 'Great')],
  ]);

  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 3);
  assert.equal(result.byGeneration.length, 3);
  assert.equal(result.byGeneration[0]!.people[0]!.via.parentName, 'Root');
  assert.equal(result.byGeneration[1]!.people[0]!.via.parentName, 'Child');
  assert.equal(result.byGeneration[2]!.people[0]!.via.parentName, 'Grandchild');
});

test('computeDescendants: respects maxDepth', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'Child', born: null }] })],
    ['I2', person('I2', 'Child', { children: [{ record: 'I3', name: 'Grand', born: null }] })],
    ['I3', person('I3', 'Grand', { children: [{ record: 'I4', name: 'Great', born: null }] })],
    ['I4', person('I4', 'Great')],
  ]);

  const result = computeDescendants({ records, rootRecord: 'I1', maxDepth: 2 });
  assert.equal(result.total, 2);
  assert.equal(result.byGeneration.length, 2);
});
```

- [ ] **Step 2: Run tests (expect pass; implementation already handles both)**

Run: `cd core && npx tsx --test test/family/descendants.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 3: Commit**

```bash
git add core/test/family/descendants.test.ts
git commit -m "chore: cover multi-generation descent and depth limit"
```

---

### Task 3: Robustness — missing records and cycle safety

- [ ] **Step 1: Add tests**

```ts
test('computeDescendants: missing child record still recorded with no further descent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'Ghost', born: null }] })],
  ]);
  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 1);
  assert.equal(result.byGeneration[0]!.people[0]!.name, 'Ghost');
  assert.equal(result.byGeneration[0]!.people[0]!.birth, null);
});

test('computeDescendants: data cycle (descendant points back to root) does not loop', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'A', born: null }] })],
    ['I2', person('I2', 'A', { children: [{ record: 'I1', name: 'Root', born: null }] })],
  ]);
  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 1); // I2 only — I1 already in seen set
});

test('computeDescendants: unknown root returns empty', () => {
  const result = computeDescendants({ records: new Map(), rootRecord: 'I999' });
  assert.deepEqual(result, { byGeneration: [], total: 0 });
});
```

- [ ] **Step 2: Run tests (expect pass)**

Run: `cd core && npx tsx --test test/family/descendants.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 3: Commit**

```bash
git add core/test/family/descendants.test.ts
git commit -m "chore: cover missing records and cycle safety in descendants"
```

---

### Task 4: Wire descendants into the frontend view

**Files:**
- Modify: `frontend/lib/family.ts`

- [ ] **Step 1: Extend types and populate descendants**

Add to `frontend/lib/family.ts` imports near the existing `computeCohort` import:

```ts
import { computeDescendants } from '@core/family/descendants.ts';
```

Add view types alongside `BrowserCousinView`:

```ts
export interface BrowserDescendantView extends BrowserRelationView {
  generation: number;
  via: string;
}
```

Extend `FamilyTreeView`:

```ts
  descendants: {
    byGeneration: { generation: number; people: BrowserDescendantView[] }[];
    total: number;
  };
```

In `getFamilyTree`, after the cohort block and before the return, compute descendants for the **selected** record:

```ts
const descendantsRaw = computeDescendants({ records, rootRecord: targetForCohort });
const descendantsByGen = descendantsRaw.byGeneration.map(g => ({
  generation: g.generation,
  people: g.people.map(p => ({
    record: p.record,
    name: p.name,
    detail: yearLabel(p.birth?.date ?? null),
    slug: findSlug(p.record, p.name),
    generation: p.generation,
    via: p.via.parentName,
  } satisfies BrowserDescendantView)),
}));
```

Add `descendants: { byGeneration: descendantsByGen, total: descendantsRaw.total }` to the returned object.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/family.ts
git commit -m "feat: surface descendants on family tree view"
```

---

### Task 5: Render Descendants section on the family tree page

**Files:**
- Modify: `frontend/app/family/tree/page.tsx`

- [ ] **Step 1: Add descendants section between Family and Lineage**

After the `</section>` that closes `Family` (around the spot after `cousins.length > 0` block) and before the `{hasLineage ? (` block, insert:

```tsx
        {view.descendants.total > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '120ms' }}>
            <SectionHeader title="Descendants" count={view.descendants.total} />
            <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
              {view.descendants.byGeneration.map(group => (
                <DescendantsBlock
                  key={`desc-${group.generation}`}
                  generation={group.generation}
                  people={group.people}
                />
              ))}
            </Card>
          </section>
        ) : null}
```

Add the `DescendantsBlock` helper near the bottom of the file, alongside `GenerationBlock`:

```tsx
const DESCENDANT_HEADING: Record<number, string> = {
  1: 'Children',
  2: 'Grandchildren',
  3: 'Great-grandchildren',
  4: '2× Great-grandchildren',
  5: '3× Great-grandchildren',
};

function DescendantsBlock({
  generation,
  people,
}: {
  generation: number;
  people: BrowserDescendantView[];
}) {
  const heading = DESCENDANT_HEADING[generation] ?? `Generation +${generation}`;
  return (
    <section className="border-b rule-hair last:border-b-0">
      <header className="flex items-baseline gap-3 px-3 py-1.5">
        <span className="font-display text-[0.7rem] font-medium tabular-nums tracking-tight text-muted-foreground/70">
          +{roman(generation)}
        </span>
        <h4 className="flex-1 truncate font-display text-[0.78rem] uppercase tracking-[0.16em] text-muted-foreground">
          {heading}
        </h4>
        <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">
          {String(people.length).padStart(2, '0')}
        </span>
      </header>
      <div className="grid gap-x-2 px-2 pb-1.5 sm:grid-cols-2">
        {people.map((p, i) => (
          <AncestorTile
            key={`desc-${p.record}-${i}`}
            href={familyTreeHref(p.record)}
            name={p.name}
            meta={[p.detail, `via ${p.via}`].filter(Boolean).join('  ·  ')}
            ordinal={roman(i + 1).toLowerCase()}
          />
        ))}
      </div>
    </section>
  );
}
```

Add `BrowserDescendantView` to the existing imports from `@/lib/family`.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual verification via curl**

Curl `/family/tree` for a person who has descendants in the data, grep for `Descendants` and `Children`/`Grandchildren` strings.

```bash
curl -sS http://localhost:3001/family/tree | grep -oE '>Descendants<|>Children<|>Grandchildren<' | sort -u
```

Expected: at least `>Descendants<` appears for the self route. If not, navigate to a known ancestor route via `?person=I...` and re-check.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/family/tree/page.tsx
git commit -m "feat: render descendants on family tree page"
```

---

### Task 6: Final verification + roadmap

- [ ] **Step 1: Run all tests + typecheck**

```bash
cd core && npm test
cd frontend && npm test && npx tsc --noEmit
```

Expected: PASS — at least 99 core tests (3 new descendants), frontend unchanged count, typecheck clean.

- [ ] **Step 2: Update roadmap**

In `docs/superpowers/plans/2026-05-02-family-explorer-roadmap.md`, change feature #2's status to `(SHIPPED 2026-05-02)`.

- [ ] **Step 3: Commit roadmap**

```bash
git add docs/superpowers/plans/2026-05-02-family-explorer-roadmap.md
git commit -m "chore: mark descendants shipped on roadmap"
```
