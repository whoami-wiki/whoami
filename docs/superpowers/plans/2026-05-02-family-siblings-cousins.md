# Family Browser: Siblings & Cousins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add siblings and first cousins to the family browser's person view so a relative looking at any person can see their cohort, not just their direct line.

**Architecture:** Add a pure `core/src/family/cohort.ts` module that, given the full `Map<string, DerivedRecord>` and a target record, returns the target's siblings (full + half) and first cousins. Extend `FamilyTreeView` in `frontend/lib/family.ts` with a `cohort` field. Render two new sub-sections inside the existing Family card on `/family/tree` using the existing `PersonRow` primitive — no new UI primitives.

**Tech Stack:** TypeScript, `node:test` + `node:assert/strict` for tests, Next.js App Router, existing `BrowserPerson` shape and `PersonRow`/`GroupedList` components.

---

## File Structure

- `core/src/family/cohort.ts` (new) — pure function `computeCohort({ records, targetRecord })` returning `{ siblings, cousins }`. Each entry includes `record`, `name`, `birth`, optional `kind: 'full' | 'half'` for siblings, and `via: { parentRecord, parentName }` for cousins (so the UI can say "via Aunt Jane").
- `core/test/family/cohort.test.ts` (new) — covers full/half siblings, self exclusion, paternal/maternal cousins, missing-record robustness, no-cohort case.
- `frontend/lib/family.ts` (modify) — `FamilyTreeView` gains `cohort: { siblings: BrowserRelationView[], cousins: BrowserCousinView[] }`. `BrowserCousinView extends BrowserRelationView` with `via: string`. Populate via `computeCohort` after `buildFamilyBrowser`.
- `frontend/app/family/tree/page.tsx` (modify) — inside the existing `<Family>` section, append Siblings and Cousins blocks under the existing Parents/Spouses/Children list when non-empty. Update the `familyCount` calculation accordingly.

No changes to `core/src/family/browser.ts`, `trace.ts`, or `gedcom/types.ts`.

---

### Task 1: Cohort module — full siblings

**Files:**
- Create: `core/src/family/cohort.ts`
- Test: `core/test/family/cohort.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// core/test/family/cohort.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCohort } from '../../src/family/cohort.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

function person(record: string, name: string, patch: Partial<DerivedRecord> = {}): DerivedRecord {
  return {
    record,
    name,
    birth: null,
    death: null,
    parents: [],
    spouses: [],
    children: [],
    residences: [],
    occupations: [],
    sources: [],
    ...patch,
  };
}

test('computeCohort: full sibling shares both parents', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IM', name: 'Mom', role: 'mother' },
      ],
    })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Sibling', born: null },
    ] })],
    ['IM', person('IM', 'Mom', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Sibling', born: null },
    ] })],
    ['I2', person('I2', 'Sibling', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IM', name: 'Mom', role: 'mother' },
      ],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.siblings.length, 1);
  assert.equal(result.siblings[0]!.record, 'I2');
  assert.equal(result.siblings[0]!.kind, 'full');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && bun test test/family/cohort.test.ts`
Expected: FAIL — module `../../src/family/cohort.ts` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// core/src/family/cohort.ts
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

function byBirthThenName(a: { birth: DatedEvent | null; name: string }, b: { birth: DatedEvent | null; name: string }): number {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd core && bun test test/family/cohort.test.ts`
Expected: PASS — 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add core/src/family/cohort.ts core/test/family/cohort.test.ts
git commit -m "feat: add cohort module with full siblings"
```

---

### Task 2: Cohort module — half siblings & self exclusion

**Files:**
- Modify: `core/test/family/cohort.test.ts`
- Modify (verify, no change expected): `core/src/family/cohort.ts`

- [ ] **Step 1: Add failing tests for half siblings and self exclusion**

```ts
test('computeCohort: half sibling shares only one parent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IM', name: 'Mom', role: 'mother' },
      ],
    })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Half', born: null },
    ] })],
    ['IM', person('IM', 'Mom', { children: [
      { record: 'I1', name: 'Self', born: null },
    ] })],
    ['I2', person('I2', 'Half', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IS', name: 'Stepmom', role: 'mother' },
      ],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.siblings.length, 1);
  assert.equal(result.siblings[0]!.record, 'I2');
  assert.equal(result.siblings[0]!.kind, 'half');
});

test('computeCohort: self is never returned as own sibling', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
    ] })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.siblings.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd core && bun test test/family/cohort.test.ts`
Expected: PASS — 3 tests. (Implementation already handles these via the shared-parent count logic.)

- [ ] **Step 3: Commit**

```bash
git add core/test/family/cohort.test.ts
git commit -m "chore: cover half-sibling and self-exclusion in cohort tests"
```

---

### Task 3: Cohort module — first cousins

**Files:**
- Modify: `core/src/family/cohort.ts`
- Modify: `core/test/family/cohort.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('computeCohort: first cousins via paternal aunt', () => {
  const records = new Map<string, DerivedRecord>([
    // Self
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    // Self's father
    ['IF', person('IF', 'Dad', {
      parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }],
      children: [{ record: 'I1', name: 'Self', born: null }],
    })],
    // Grandfather has two children: Dad and Aunt
    ['IPGF', person('IPGF', 'Grandpa', {
      children: [
        { record: 'IF', name: 'Dad', born: null },
        { record: 'IA', name: 'Aunt', born: null },
      ],
    })],
    // Aunt has a child (cousin)
    ['IA', person('IA', 'Aunt', {
      parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }],
      children: [{ record: 'IC', name: 'Cousin', born: null }],
    })],
    ['IC', person('IC', 'Cousin', {
      parents: [{ record: 'IA', name: 'Aunt', role: 'mother' }],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.cousins.length, 1);
  assert.equal(result.cousins[0]!.record, 'IC');
  assert.equal(result.cousins[0]!.via.parentName, 'Aunt');
});

test('computeCohort: cousins exclude self and siblings', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    ['IF', person('IF', 'Dad', {
      parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }],
      children: [
        { record: 'I1', name: 'Self', born: null },
        { record: 'I2', name: 'Sibling', born: null },
      ],
    })],
    ['IPGF', person('IPGF', 'Grandpa', {
      children: [{ record: 'IF', name: 'Dad', born: null }],
    })],
    ['I2', person('I2', 'Sibling', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.cousins.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core && bun test test/family/cohort.test.ts`
Expected: FAIL — `cousins` is empty in the first new test (current implementation returns `cousins: []` always).

- [ ] **Step 3: Implement cousin computation**

Replace the body of `computeCohort` so it computes cousins after siblings:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core && bun test test/family/cohort.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add core/src/family/cohort.ts core/test/family/cohort.test.ts
git commit -m "feat: compute first cousins in cohort module"
```

---

### Task 4: Cohort module — robustness for missing records

**Files:**
- Modify: `core/test/family/cohort.test.ts`

- [ ] **Step 1: Add tests for missing records and empty cohorts**

```ts
test('computeCohort: missing parent record does not throw', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    // IF intentionally not in the map.
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.deepEqual(result, { siblings: [], cousins: [] });
});

test('computeCohort: target with no parents returns empty cohort', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self')],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.deepEqual(result, { siblings: [], cousins: [] });
});

test('computeCohort: unknown target returns empty cohort', () => {
  const records = new Map<string, DerivedRecord>();
  const result = computeCohort({ records, targetRecord: 'I999' });
  assert.deepEqual(result, { siblings: [], cousins: [] });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd core && bun test test/family/cohort.test.ts`
Expected: PASS — 8 tests. (Implementation already guards every `cfg.records.get(...)` with `if (!rec) continue;`.)

- [ ] **Step 3: Commit**

```bash
git add core/test/family/cohort.test.ts
git commit -m "chore: cover missing-record cases in cohort tests"
```

---

### Task 5: Wire cohort into the frontend family view

**Files:**
- Modify: `frontend/lib/family.ts`
- Test: `frontend/lib/family.test.ts` (extend existing if it covers `getFamilyTree`; otherwise add test)

- [ ] **Step 1: Inspect current test file to decide whether to extend or add**

Run: `grep -n 'getFamilyTree\|computeCohort' /Users/nyetwork/dev/whoami/frontend/lib/family.test.ts /Users/nyetwork/dev/whoami/frontend/lib/derived.test.ts`
Expected: zero hits for `computeCohort`. Note whether `getFamilyTree` has direct tests — if yes, add a cohort test alongside; if no, defer integration testing to the page-level e2e and skip a unit test for this glue.

- [ ] **Step 2: Update `frontend/lib/family.ts` to populate cohort**

Add the new types and import near the top:

```ts
import { buildFamilyBrowser, type BrowserPerson } from '@core/family/browser.ts';
import { traceAncestry, type AncestryTree, type AncestorNode } from '@core/family/trace.ts';
import { computeCohort, type CohortSibling, type CohortCousin } from '@core/family/cohort.ts';
```

Extend `BrowserRelationView` block with:

```ts
export interface BrowserSiblingView extends BrowserRelationView {
  kind: 'full' | 'half';
}

export interface BrowserCousinView extends BrowserRelationView {
  via: string; // human-readable parent name, e.g. "Aunt Jane"
}
```

Add to `FamilyTreeView`:

```ts
export interface FamilyTreeView {
  root: BrowserPersonView;
  selected: BrowserPersonView;
  byGeneration: { generation: number; paternal: BrowserPersonView[]; maternal: BrowserPersonView[] }[];
  selectedRelations: {
    parents: BrowserRelationView[];
    spouses: BrowserRelationView[];
    children: BrowserRelationView[];
  };
  cohort: {
    siblings: BrowserSiblingView[];
    cousins: BrowserCousinView[];
  };
}
```

In `getFamilyTree`, after computing `core` but before the return, compute the cohort using the **selected** record (so navigating to grandpa shows grandpa's siblings, not yours):

```ts
const targetForCohort = selectedRecord ?? rootRecord;
const cohortRaw = computeCohort({ records, targetRecord: targetForCohort });

const siblings: BrowserSiblingView[] = cohortRaw.siblings.map(s => ({
  record: s.record,
  name: s.name,
  detail: yearLabel(s.birth?.date ?? null),
  slug: findSlug(s.record, s.name),
  kind: s.kind,
}));

const cousins: BrowserCousinView[] = cohortRaw.cousins.map(c => ({
  record: c.record,
  name: c.name,
  detail: yearLabel(c.birth?.date ?? null),
  slug: findSlug(c.record, c.name),
  via: c.via.parentName,
}));
```

Add a small helper `yearLabel` near the bottom of the file:

```ts
function yearLabel(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/\b(\d{4})\b/);
  return m ? `b. ${m[1]}` : null;
}
```

Add `cohort: { siblings, cousins }` to the returned object.

- [ ] **Step 3: Type-check**

Run: `cd frontend && bun run tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 4: Run any existing family tests**

Run: `cd frontend && bun test lib/family.test.ts`
Expected: PASS (existing tests should still pass — we only added optional fields).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/family.ts
git commit -m "feat: surface siblings and cousins on family tree view"
```

---

### Task 6: Render Siblings and Cousins on the family tree page

**Files:**
- Modify: `frontend/app/family/tree/page.tsx`

- [ ] **Step 1: Read the current Family section**

Re-read `frontend/app/family/tree/page.tsx:153-173` (the `<Family>` section) to confirm the structure before editing.

- [ ] **Step 2: Update the Family section to include siblings and cousins**

Replace the existing block:

```tsx
        {familyCount > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '80ms' }}>
            <SectionHeader title="Family" count={familyCount} />
            <GroupedList>
              {[
                ...parents.map(p => ({ kind: 'parent' as const, person: p })),
                ...spouses.map(p => ({ kind: 'spouse' as const, person: p })),
                ...children.map(p => ({ kind: 'child' as const, person: p })),
              ].map(({ kind, person: p }, i) => (
                <PersonRow ... />
              ))}
            </GroupedList>
          </section>
        ) : null}
```

With (note: `familyCount` is recomputed to include cohort, and the page now consumes `view.cohort`):

```tsx
        const { siblings, cousins } = view.cohort;
        const cohortCount = siblings.length + cousins.length;
        const totalFamilyCount = familyCount + cohortCount;

        // ... near familyCount declaration above, replace with:
        // const familyCount = parents.length + spouses.length + children.length;
        // const cohortCount = view.cohort.siblings.length + view.cohort.cousins.length;
        // const totalFamilyCount = familyCount + cohortCount;

        // and the JSX:
        {totalFamilyCount > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '80ms' }}>
            <SectionHeader title="Family" count={totalFamilyCount} />
            <div className="flex flex-col gap-6">
              {familyCount > 0 ? (
                <GroupedList title="Immediate">
                  {[
                    ...parents.map(p => ({ kind: 'parent' as const, person: p })),
                    ...spouses.map(p => ({ kind: 'spouse' as const, person: p })),
                    ...children.map(p => ({ kind: 'child' as const, person: p })),
                  ].map(({ kind, person: p }, i) => (
                    <PersonRow
                      key={`${kind}-${p.record}`}
                      href={familyTreeHref(p.record)}
                      name={p.name}
                      ordinal={roman(i + 1).toLowerCase()}
                      meta={relationMeta(p)}
                      trailing={<RelationLabel>{kind}</RelationLabel>}
                    />
                  ))}
                </GroupedList>
              ) : null}

              {siblings.length > 0 ? (
                <GroupedList title={`Siblings (${siblings.length})`}>
                  {siblings.map((s, i) => (
                    <PersonRow
                      key={`sibling-${s.record}`}
                      href={familyTreeHref(s.record)}
                      name={s.name}
                      ordinal={roman(i + 1).toLowerCase()}
                      meta={s.detail}
                      trailing={
                        <RelationLabel>
                          {s.kind === 'half' ? 'half-sibling' : 'sibling'}
                        </RelationLabel>
                      }
                    />
                  ))}
                </GroupedList>
              ) : null}

              {cousins.length > 0 ? (
                <GroupedList title={`First cousins (${cousins.length})`}>
                  {cousins.map((c, i) => (
                    <PersonRow
                      key={`cousin-${c.record}`}
                      href={familyTreeHref(c.record)}
                      name={c.name}
                      ordinal={roman(i + 1).toLowerCase()}
                      meta={[c.detail, `via ${c.via}`].filter(Boolean).join('  ·  ')}
                      trailing={<RelationLabel>cousin</RelationLabel>}
                    />
                  ))}
                </GroupedList>
              ) : null}
            </div>
          </section>
        ) : null}
```

Update the `Stat` strip earlier in the file (`frontend/app/family/tree/page.tsx:132-138`) to include cohort counts so the at-a-glance numbers match the new sections. Replace the existing `<dl>` with:

```tsx
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 border-t rule-hair pt-4 sm:max-w-lg sm:grid-cols-5">
              <Stat label="Parents" value={parents.length} />
              <Stat label="Siblings" value={siblings.length} />
              <Stat label="Spouses" value={spouses.length} />
              <Stat label="Children" value={children.length} />
              <Stat label="Ancestors" value={ancestorCount} sub={`${generationCount} gens`} />
            </dl>
```

(Cousins intentionally omitted from the Stat strip — keeping it to 5 cells; cousin count is shown in the section header.)

- [ ] **Step 3: Type-check**

Run: `cd frontend && bun run tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual verification**

Start the dev server: `cd frontend && bun run dev` (run in background).
Navigate to `http://localhost:3000/family/tree` and confirm:
- Siblings section appears below Immediate when self has siblings in the data
- Half-siblings, if any, are tagged `half-sibling`
- Cousins section appears with `via Aunt/Uncle Name` meta
- Sibling count appears in the Stat strip
- Clicking a sibling/cousin navigates to their tree page
- When selecting an ancestor with no known siblings/cousins, neither section renders

If any check fails, fix and re-verify before committing.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/family/tree/page.tsx
git commit -m "feat: render siblings and cousins on family tree page"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all tests**

Run: `cd core && bun test test/family/`
Expected: PASS — all family tests, including the 8 new cohort tests.

Run: `cd frontend && bun test lib/`
Expected: PASS.

Run: `cd frontend && bun run tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Manual UI smoke test**

In the running dev server, click through to a couple of grandparents and a great-grandparent and confirm their siblings/cousins render correctly relative to the **selected** person (not relative to self). This is the most likely place for a wiring bug.

- [ ] **Step 3: Update the roadmap**

Edit `docs/superpowers/plans/2026-05-02-family-explorer-roadmap.md` and change the Siblings & cousins entry's `(PLAN NEXT)` to `(SHIPPED)`.

- [ ] **Step 4: Final commit if roadmap changed**

```bash
git add docs/superpowers/plans/2026-05-02-family-explorer-roadmap.md
git commit -m "chore: mark siblings & cousins shipped on roadmap"
```

---

## Self-review notes

- **Type consistency:** `BrowserSiblingView`/`BrowserCousinView` extend `BrowserRelationView`; `kind` and `via` match the field names used in tests (Task 1, 3) and in the page render (Task 6).
- **Cohort target = selected, not root:** intentional. Browsing to grandpa shows grandpa's siblings, which is what makes lateral navigation useful.
- **Half-sibling detection:** relies on either (a) the half-sibling having two parents in their `parents[]` so we can count overlap with target's parents, or (b) the half-sibling being a child of only one of the target's parents — handled by the `sharedParents` count and the `existing.kind = 'full'` upgrade when a sibling appears in a second parent's children list.
- **Cousin dedupe:** `cousinsMap` keyed by record; first observation wins for `via` (the aunt/uncle name shown). Acceptable — if a cousin descends from two paths, the data is unusual enough that a single `via` is fine.
- **Performance:** cohort computation is O(parents + grandparents + aunts/uncles + their children) — bounded by the number of records at depth 2 from the target. Negligible.
