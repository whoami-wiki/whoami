# Family Browser: Places Panel Implementation Plan

**Goal:** Surface where ancestors were born — grouped by region, with counts and a list of who came from each place — so the user can read migration patterns at a glance.

**Scope cut from original "Map of birthplaces":** No geocoding, no SVG map. Birthplace strings in the data are not standardized ("Kiev, Soviet Union" vs "Kiev, Ukraine" vs "Fastov, Kiev, Ukraine") and there are no coordinates. A real map needs either Nominatim batch lookups (live geocoding has terms-of-service issues for routine use) or hand-coded coords per region (deferred to a follow-up plan when the user is ready to curate that lookup table). The places panel ships immediate value with the data we have.

**Architecture:**
- `core/src/family/places.ts` (new, tested) — `groupBirthplaces({ entries })` takes a flat list of `{ record, name, place }` and returns `{ regions: { region, normalized, people }[] }` grouped by a normalized "country/region" key. Normalization is a small heuristic: take the last comma-separated segment, lowercase, strip "USA"/"United States of America" → "United States", treat "Soviet Union"/"Russian Empire" as historical Ukraine/Russia/Lithuania regions when possible — for now just normalize "USA" / "United States of America" → "United States" and trust the rest.
- `frontend/lib/family.ts` adds `view.places: PlacesView` (uses lineage flat list for input).
- `frontend/app/family/tree/page.tsx` renders a Places section after Coverage.

---

### Task 1: Places grouping module

- [ ] **Step 1: Tests**

```ts
// core/test/family/places.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBirthplaces } from '../../src/family/places.ts';

test('groupBirthplaces: groups by last segment with country normalization', () => {
  const entries = [
    { record: 'I1', name: 'A', place: 'Kiev, Ukraine' },
    { record: 'I2', name: 'B', place: 'Pittsburgh, Allegheny County, Pennsylvania, United States of America' },
    { record: 'I3', name: 'C', place: 'New York, USA' },
    { record: 'I4', name: 'D', place: null },
    { record: 'I5', name: 'E', place: 'Kiev, Soviet Union' },
  ];
  const result = groupBirthplaces({ entries });
  const byRegion = new Map(result.regions.map(r => [r.region, r]));
  assert.equal(byRegion.get('United States')!.people.length, 2);
  assert.equal(byRegion.get('Ukraine')!.people.length, 1);
  assert.equal(byRegion.get('Soviet Union')!.people.length, 1);
});

test('groupBirthplaces: drops null/empty places, sorts by count desc', () => {
  const entries = [
    { record: 'I1', name: 'A', place: 'X, A' },
    { record: 'I2', name: 'B', place: 'Y, A' },
    { record: 'I3', name: 'C', place: 'Z, B' },
    { record: 'I4', name: 'D', place: '' },
    { record: 'I5', name: 'E', place: null },
  ];
  const result = groupBirthplaces({ entries });
  assert.equal(result.regions.length, 2);
  assert.equal(result.regions[0]!.region, 'A');
  assert.equal(result.regions[0]!.people.length, 2);
  assert.equal(result.regions[1]!.region, 'B');
});
```

- [ ] **Step 2: Implementation**

```ts
// core/src/family/places.ts
export interface PlaceEntry {
  record: string;
  name: string;
  place: string | null;
}

export interface PlacesPerson {
  record: string;
  name: string;
  /** The original full place string. */
  place: string;
}

export interface PlacesRegion {
  region: string;
  people: PlacesPerson[];
}

export interface PlacesView {
  regions: PlacesRegion[];
}

export function groupBirthplaces(cfg: { entries: PlaceEntry[] }): PlacesView {
  const groups = new Map<string, PlacesPerson[]>();
  for (const e of cfg.entries) {
    if (!e.place || !e.place.trim()) continue;
    const region = lastSegment(e.place);
    const arr = groups.get(region) ?? [];
    arr.push({ record: e.record, name: e.name, place: e.place });
    groups.set(region, arr);
  }
  const regions: PlacesRegion[] = [...groups.entries()]
    .map(([region, people]) => ({ region, people }))
    .sort((a, b) => b.people.length - a.people.length || a.region.localeCompare(b.region));
  return { regions };
}

function lastSegment(place: string): string {
  const segs = place.split(',').map(s => s.trim()).filter(Boolean);
  const last = segs[segs.length - 1] ?? place.trim();
  return normalizeCountry(last);
}

function normalizeCountry(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'usa' || lower === 'u.s.a.' || lower === 'united states of america' || lower === 'united states') return 'United States';
  if (lower === 'uk' || lower === 'u.k.') return 'United Kingdom';
  return s;
}
```

- [ ] **Step 3: Run + commit**

```bash
cd core && npx tsx --test test/family/places.test.ts
git add core/src/family/places.ts core/test/family/places.test.ts
git commit -m "feat: add birthplace grouping module"
```

---

### Task 2: Wire into FamilyTreeView

- [ ] **Step 1:** import `groupBirthplaces`, build entries from lineage (record/name/birth.place), include self, store as `view.places`.
- [ ] **Step 2:** Type-check + commit.

---

### Task 3: Render Places section

- [ ] **Step 1:** Add a section after Coverage, before Lifespans. Two-column or single-column card grid showing each region, a count, and the people listed.
- [ ] **Step 2:** Curl-verify presence of "Places", "United States", etc.
- [ ] **Step 3:** Commit.

---

### Task 4: Roadmap & follow-up

- [ ] Mark feature #8 as `(SHIPPED 2026-05-03 — places panel; SVG map deferred)`.
- [ ] Add a roadmap note: "Real birthplace map (SVG dot plot) requires a curated `places-coords.yml` lookup. Open as new plan when ready."
