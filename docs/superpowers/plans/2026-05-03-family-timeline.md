# Family Browser: Lifespan Timeline Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans.

**Goal:** Render a horizontal timeline showing each ancestor's lifespan as a bar — instantly answering "who overlapped with whom" and surfacing era / longevity at a glance.

**Architecture:**
- `core/src/family/dates.ts` (new, tested) — `parseGedcomYear(raw)` extracts an `{ year, qualifier?: 'about' | 'before' | 'after' | 'range' }` from a GEDCOM date string. The first new building block, lives in `core/` because it's reusable (timeline, search facets, sorting).
- `core/src/family/timeline.ts` (new, tested) — `computeTimeline({ records, lineage })` produces `{ entries, range }`. Each entry: `{ record, name, birthYear, deathYear, side, generation }`. `range`: `{ minYear, maxYear }`.
- `frontend/lib/family.ts` adds `view.timeline: TimelineView | null` (null when no lineage has any dates).
- `frontend/components/family/lifespan-bar.tsx` (new) — pure presentational row with name, dates, and a positioned bar. Avoids polluting `page.tsx` further.
- `frontend/app/family/tree/page.tsx` renders a Timeline section between Coverage and Descendants.

---

### Task 1: GEDCOM date parser

**Files:**
- Create: `core/src/family/dates.ts`
- Test: `core/test/family/dates.test.ts`

- [ ] **Step 1: Write tests covering the canonical formats**

```ts
// core/test/family/dates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGedcomYear } from '../../src/family/dates.ts';

test('parseGedcomYear: full date', () => {
  assert.deepEqual(parseGedcomYear('12 JAN 1950'), { year: 1950 });
});

test('parseGedcomYear: year only', () => {
  assert.deepEqual(parseGedcomYear('1880'), { year: 1880 });
});

test('parseGedcomYear: ABT (about)', () => {
  assert.deepEqual(parseGedcomYear('ABT 1880'), { year: 1880, qualifier: 'about' });
});

test('parseGedcomYear: BEF (before)', () => {
  assert.deepEqual(parseGedcomYear('BEF 1900'), { year: 1900, qualifier: 'before' });
});

test('parseGedcomYear: AFT (after)', () => {
  assert.deepEqual(parseGedcomYear('AFT 1850'), { year: 1850, qualifier: 'after' });
});

test('parseGedcomYear: BET ... AND ... uses midpoint', () => {
  // 1850–1860 → midpoint 1855
  assert.deepEqual(parseGedcomYear('BET 1850 AND 1860'), { year: 1855, qualifier: 'range' });
});

test('parseGedcomYear: null/empty/unrecognized returns null', () => {
  assert.equal(parseGedcomYear(null), null);
  assert.equal(parseGedcomYear(''), null);
  assert.equal(parseGedcomYear('not a date'), null);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd core && npx tsx --test test/family/dates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement parser**

```ts
// core/src/family/dates.ts
export interface ParsedYear {
  year: number;
  qualifier?: 'about' | 'before' | 'after' | 'range';
}

export function parseGedcomYear(raw: string | null | undefined): ParsedYear | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (!s) return null;

  const between = s.match(/^BET(?:WEEN)?\s+(\d{4})\s+AND\s+(\d{4})$/);
  if (between) {
    const a = Number(between[1]);
    const b = Number(between[2]);
    return { year: Math.round((a + b) / 2), qualifier: 'range' };
  }

  const prefixed = s.match(/^(ABT|ABOUT|EST|CIRCA|CA|BEF|BEFORE|AFT|AFTER)\s+.*?(\d{4})/);
  if (prefixed) {
    const tag = prefixed[1]!;
    const y = Number(prefixed[2]);
    if (tag === 'BEF' || tag === 'BEFORE') return { year: y, qualifier: 'before' };
    if (tag === 'AFT' || tag === 'AFTER') return { year: y, qualifier: 'after' };
    return { year: y, qualifier: 'about' };
  }

  const yearMatch = s.match(/(\d{4})/);
  if (yearMatch) return { year: Number(yearMatch[1]) };
  return null;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test test/family/dates.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add core/src/family/dates.ts core/test/family/dates.test.ts
git commit -m "feat: add gedcom year parser"
```

---

### Task 2: Timeline view module

**Files:**
- Create: `core/src/family/timeline.ts`
- Test: `core/test/family/timeline.test.ts`

- [ ] **Step 1: Write tests**

```ts
// core/test/family/timeline.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTimeline } from '../../src/family/timeline.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

function rec(record: string, name: string, b: string | null, d: string | null): DerivedRecord {
  return {
    record, name,
    birth: b ? { date: b, place: null } : null,
    death: d ? { date: d, place: null } : null,
    parents: [], spouses: [], children: [],
    residences: [], occupations: [], sources: [],
  };
}

test('computeTimeline: builds entries with year tuples and overall range', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', rec('I1', 'Self', '1990', null)],
    ['I2', rec('I2', 'Dad', '1960', '2020')],
    ['I3', rec('I3', 'Grandpa', 'ABT 1930', '1995')],
  ]);
  const lineage = [
    { record: 'I2', name: 'Dad', generation: 1, side: 'paternal' as const },
    { record: 'I3', name: 'Grandpa', generation: 2, side: 'paternal' as const },
  ];
  const view = computeTimeline({ records, self: 'I1', lineage });
  assert.equal(view.entries.length, 3); // self + 2 ancestors
  assert.equal(view.range.minYear, 1930);
  assert.equal(view.range.maxYear, 2020);
  const dad = view.entries.find(e => e.record === 'I2')!;
  assert.equal(dad.birthYear, 1960);
  assert.equal(dad.deathYear, 2020);
});

test('computeTimeline: skips ancestors with no parsable dates', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', rec('I1', 'Self', '1990', null)],
    ['I2', rec('I2', 'Mystery', null, null)],
  ]);
  const lineage = [{ record: 'I2', name: 'Mystery', generation: 1, side: 'maternal' as const }];
  const view = computeTimeline({ records, self: 'I1', lineage });
  assert.equal(view.entries.length, 1); // only self
  assert.equal(view.entries[0]!.record, 'I1');
});

test('computeTimeline: empty when no parsable dates anywhere', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', rec('I1', 'Self', null, null)],
  ]);
  const view = computeTimeline({ records, self: 'I1', lineage: [] });
  assert.equal(view.entries.length, 0);
  assert.equal(view.range, null);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd core && npx tsx --test test/family/timeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// core/src/family/timeline.ts
import type { DerivedRecord } from '../gedcom/types.ts';
import { parseGedcomYear } from './dates.ts';

export interface TimelineEntry {
  record: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  side: 'self' | 'paternal' | 'maternal';
  generation: number;
  /** Whether birth/death years carried qualifiers like ABT/BEF. */
  birthQualified: boolean;
  deathQualified: boolean;
}

export interface TimelineRange {
  minYear: number;
  maxYear: number;
}

export interface TimelineView {
  entries: TimelineEntry[];
  range: TimelineRange | null;
}

export interface ComputeTimelineConfig {
  records: Map<string, DerivedRecord>;
  self: string;
  lineage: { record: string; name: string; generation: number; side: 'paternal' | 'maternal' }[];
}

const DEFAULT_LIFESPAN_YEARS = 70;
const CURRENT_YEAR = new Date().getUTCFullYear();

export function computeTimeline(cfg: ComputeTimelineConfig): TimelineView {
  const entries: TimelineEntry[] = [];
  const consider: { record: string; name: string; generation: number; side: 'self' | 'paternal' | 'maternal' }[] = [
    { record: cfg.self, name: cfg.records.get(cfg.self)?.name ?? 'self', generation: 0, side: 'self' },
    ...cfg.lineage,
  ];

  for (const c of consider) {
    const rec = cfg.records.get(c.record);
    if (!rec) continue;
    const b = parseGedcomYear(rec.birth?.date ?? null);
    const d = parseGedcomYear(rec.death?.date ?? null);
    if (!b) continue; // no anchor; skip
    entries.push({
      record: c.record,
      name: c.name,
      birthYear: b.year,
      deathYear: d ? d.year : null,
      side: c.side,
      generation: c.generation,
      birthQualified: b.qualifier !== undefined,
      deathQualified: d?.qualifier !== undefined,
    });
  }

  if (entries.length === 0) return { entries, range: null };

  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const e of entries) {
    minYear = Math.min(minYear, e.birthYear);
    const end = e.deathYear ?? Math.min(CURRENT_YEAR, e.birthYear + DEFAULT_LIFESPAN_YEARS);
    maxYear = Math.max(maxYear, end);
  }
  // Sort: oldest first, then by side (paternal, maternal, self last? — keep self at top by generation 0 then chronological).
  entries.sort((a, b) => a.birthYear - b.birthYear || a.generation - b.generation);
  return { entries, range: { minYear, maxYear } };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test test/family/timeline.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add core/src/family/timeline.ts core/test/family/timeline.test.ts
git commit -m "feat: add lifespan timeline computation"
```

---

### Task 3: Wire timeline into FamilyTreeView

**Files:**
- Modify: `frontend/lib/family.ts`

- [ ] **Step 1: Add types and computation**

Import `computeTimeline` and re-export `TimelineEntry`/`TimelineView`. In `getFamilyTree`, after coverage compute, build a flat lineage array from `core.byGeneration` and call `computeTimeline`:

```ts
import { computeTimeline, type TimelineView } from '@core/family/timeline.ts';
```

```ts
const flatLineage = core.byGeneration.flatMap(g => [
  ...g.paternal.map(p => ({ record: p.record, name: p.name, generation: p.generation, side: 'paternal' as const })),
  ...g.maternal.map(p => ({ record: p.record, name: p.name, generation: p.generation, side: 'maternal' as const })),
]);
const timeline = computeTimeline({ records, self: targetForCohort, lineage: flatLineage });
```

Add to `FamilyTreeView`:

```ts
  timeline: TimelineView;
```

Add `timeline` to the return object.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/family.ts
git commit -m "feat: surface lifespan timeline on family tree view"
```

---

### Task 4: LifespanBar component

**Files:**
- Create: `frontend/components/family/lifespan-bar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/components/family/lifespan-bar.tsx
import Link from 'next/link';

interface Props {
  href: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  side: 'self' | 'paternal' | 'maternal';
  rangeMin: number;
  rangeMax: number;
  /** Year used for the right edge when deathYear is null (alive or unknown). */
  endYear: number;
  birthQualified: boolean;
  deathQualified: boolean;
}

function pct(year: number, min: number, max: number): number {
  if (max === min) return 0;
  return ((year - min) / (max - min)) * 100;
}

export function LifespanBar({
  href, name, birthYear, deathYear, side, rangeMin, rangeMax, endYear,
  birthQualified, deathQualified,
}: Props) {
  const left = pct(birthYear, rangeMin, rangeMax);
  const right = pct(endYear, rangeMin, rangeMax);
  const width = Math.max(0.5, right - left);
  const accent =
    side === 'paternal' ? 'var(--paternal)'
    : side === 'maternal' ? 'var(--maternal)'
    : 'var(--foreground)';
  const dates = deathYear
    ? `${birthQualified ? 'c. ' : ''}${birthYear} – ${deathQualified ? 'c. ' : ''}${deathYear}`
    : `${birthQualified ? 'c. ' : ''}${birthYear} – `;

  return (
    <Link
      href={href}
      className="grid grid-cols-[10rem_1fr_5rem] items-baseline gap-3 px-3 py-1.5 text-sm hover:bg-accent/45 transition-colors"
    >
      <span className="truncate font-display tracking-tight text-foreground">{name}</span>
      <span className="relative h-2.5 rounded-sm bg-muted/40">
        <span
          className="absolute top-0 h-2.5 rounded-sm"
          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: accent, opacity: deathYear ? 0.85 : 0.55 }}
          aria-hidden
        />
      </span>
      <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/85 text-right">
        {dates}
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

---

### Task 5: Render Timeline section

**Files:**
- Modify: `frontend/app/family/tree/page.tsx`

- [ ] **Step 1: Insert section after Coverage, before Descendants**

Add import:

```tsx
import { LifespanBar } from '@/components/family/lifespan-bar';
```

Insert in the JSX between Coverage and Descendants (find the `{view.descendants.total > 0 ?` block and add before it):

```tsx
        {view.timeline.entries.length > 0 && view.timeline.range ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '110ms' }}>
            <SectionHeader
              title="Lifespans"
              count={view.timeline.entries.length}
              after={
                <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                  {view.timeline.range.minYear} – {view.timeline.range.maxYear}
                </p>
              }
            />
            <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
              <div className="divide-y rule-hair">
                {view.timeline.entries.map(e => (
                  <LifespanBar
                    key={`life-${e.record}`}
                    href={familyTreeHref(e.record)}
                    name={e.name}
                    birthYear={e.birthYear}
                    deathYear={e.deathYear}
                    side={e.side}
                    rangeMin={view.timeline.range!.minYear}
                    rangeMax={view.timeline.range!.maxYear}
                    endYear={e.deathYear ?? Math.min(new Date().getUTCFullYear(), e.birthYear + 70)}
                    birthQualified={e.birthQualified}
                    deathQualified={e.deathQualified}
                  />
                ))}
              </div>
            </Card>
          </section>
        ) : null}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual verification via curl**

```bash
curl -sS http://localhost:3001/family/tree | grep -oE '>(Lifespans|[0-9]{4} – [0-9]{4})<' | head -5
```

Expected: `>Lifespans<` and a year-range header.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/family/lifespan-bar.tsx frontend/app/family/tree/page.tsx
git commit -m "feat: render lifespan timeline on family tree page"
```

---

### Task 6: Final verification + roadmap

- [ ] **Step 1: Tests + typecheck**

Run all suites; expect 124 core tests (10 new: 7 dates + 3 timeline), frontend unchanged, typecheck clean.

- [ ] **Step 2: Mark feature #5 shipped on roadmap; commit.**
