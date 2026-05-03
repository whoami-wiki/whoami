# Family Browser: Coverage Prompts Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans.

**Goal:** Surface the gaps in the family tree as a small, actionable panel — "these known ancestors have unknown parents" — so contributors know exactly where to dig next, instead of just seeing "01 / 02" counts.

**Architecture:** Reuse the existing `byGeneration` data already on `FamilyTreeView`. Add `view.coverage` with two pieces:
1. **Per-generation completeness** — `{ generation, known, possible }` (already mostly derivable; explicit so the UI can render it cleanly).
2. **Research frontier** — list of known ancestors whose own parents are missing. These are the actionable leaf gaps. Each entry: `{ record, name, generation, side }`. Limited to the top ~12 by generation (closer = more impactful) so the panel doesn't sprawl.

UI: a third top-row card alongside the dl Stat strip — or, more honestly given density preference, render as a compact section between Family and Descendants titled "Coverage".

No new core module required — the computation is small and lives in `frontend/lib/family.ts` next to where descendants/cohort already live.

---

### Task 1: Compute coverage in family.ts

**Files:**
- Modify: `frontend/lib/family.ts`

- [ ] **Step 1: Add types and computation**

In `frontend/lib/family.ts`, add types alongside `BrowserDescendantView`:

```ts
export interface CoverageGenerationView {
  generation: number;
  known: number;
  possible: number;
}

export interface ResearchFrontierView {
  record: string;
  name: string;
  generation: number;
  side: 'paternal' | 'maternal';
  slug?: string;
  /** Which parent role is missing — 'father', 'mother', or 'both'. */
  missing: 'father' | 'mother' | 'both';
}

export interface CoverageView {
  byGeneration: CoverageGenerationView[];
  knownTotal: number;
  possibleTotal: number;
  frontier: ResearchFrontierView[];
}
```

Add `coverage: CoverageView` to `FamilyTreeView`.

In `getFamilyTree`, after the descendants block, before the relationship block, compute coverage. The view's lineage is keyed off `core.byGeneration`. For each generation g, possible = 2^g. For each ancestor in the lineage, look up their `DerivedRecord` to check whether their `parents[]` has a `father` and `mother`:

```ts
const coverageByGen: CoverageGenerationView[] = core.byGeneration.map(group => {
  const possible = 2 ** group.generation;
  const known = group.paternal.length + group.maternal.length;
  return { generation: group.generation, known, possible };
});
const knownTotal = coverageByGen.reduce((s, g) => s + g.known, 0);
const possibleTotal = coverageByGen.reduce((s, g) => s + g.possible, 0);

const frontierAll: ResearchFrontierView[] = [];
for (const group of core.byGeneration) {
  const consider = [
    ...group.paternal.map(p => ({ p, side: 'paternal' as const })),
    ...group.maternal.map(p => ({ p, side: 'maternal' as const })),
  ];
  for (const { p, side } of consider) {
    const rec = records.get(p.record);
    if (!rec) continue;
    const hasFather = rec.parents.some(r => r.role === 'father');
    const hasMother = rec.parents.some(r => r.role === 'mother');
    if (hasFather && hasMother) continue;
    frontierAll.push({
      record: p.record,
      name: p.name,
      generation: p.generation,
      side,
      slug: findSlug(p.record, p.name),
      missing: !hasFather && !hasMother ? 'both' : (!hasFather ? 'father' : 'mother'),
    });
  }
}
// Closer generations first; cap at 12 to avoid sprawl.
frontierAll.sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name));
const frontier = frontierAll.slice(0, 12);
```

Add `coverage: { byGeneration: coverageByGen, knownTotal, possibleTotal, frontier }` to the returned object.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/family.ts
git commit -m "feat: compute lineage coverage and research frontier"
```

---

### Task 2: Render Coverage panel on tree page

**Files:**
- Modify: `frontend/app/family/tree/page.tsx`

- [ ] **Step 1: Add panel after Family, before Descendants**

Place the panel above Descendants so it draws attention to gaps near the top. The panel has two halves:
- Left: per-generation table with known / possible
- Right: research frontier list (clickable links to those people)

Insert in `frontend/app/family/tree/page.tsx` immediately after the Family `</section>` and before the Descendants section:

```tsx
        {view.coverage.knownTotal > 0 ? (
          <section className="registry-rise mb-12" style={{ animationDelay: '100ms' }}>
            <SectionHeader
              title="Coverage"
              count={view.coverage.knownTotal}
              after={
                <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                  {view.coverage.knownTotal} / {view.coverage.possibleTotal} known
                </p>
              }
            />
            <div className="grid gap-4 md:grid-cols-[auto_1fr]">
              <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
                <header className="border-b rule-hair bg-muted/40 px-3 py-2">
                  <h3 className="font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                    Per generation
                  </h3>
                </header>
                <ul className="divide-y rule-hair">
                  {view.coverage.byGeneration.map(g => (
                    <li
                      key={`cov-${g.generation}`}
                      className="flex items-baseline justify-between gap-4 px-3 py-1.5 font-mono text-[0.72rem] tabular-nums"
                    >
                      <span className="text-muted-foreground">
                        {roman(g.generation)}
                      </span>
                      <span className="flex-1 truncate font-display tracking-tight text-foreground">
                        {GENERATION_HEADING[g.generation] ?? `Generation ${g.generation}`}
                      </span>
                      <span className={g.known === g.possible ? 'text-foreground' : 'text-muted-foreground'}>
                        {String(g.known).padStart(2, '0')} / {String(g.possible).padStart(2, '0')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              {view.coverage.frontier.length > 0 ? (
                <Card className="gap-0 overflow-hidden p-0 py-0 shadow-none ring-foreground/12">
                  <header className="border-b rule-hair bg-muted/40 px-3 py-2 flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                      Research frontier
                    </h3>
                    <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70">
                      {String(view.coverage.frontier.length).padStart(2, '0')}
                    </span>
                  </header>
                  <ul className="divide-y rule-hair">
                    {view.coverage.frontier.map(f => (
                      <li key={`fr-${f.record}`}>
                        <Link
                          href={familyTreeHref(f.record)}
                          className="flex items-baseline gap-3 px-3 py-1.5 transition-colors hover:bg-accent/45"
                        >
                          <span className="font-mono text-[0.62rem] tabular-nums text-muted-foreground/70 w-5 shrink-0">
                            {roman(f.generation)}
                          </span>
                          <span className="flex-1 truncate font-display tracking-tight text-foreground">
                            {f.name}
                          </span>
                          <span className="font-display text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                            missing {f.missing === 'both' ? 'parents' : f.missing}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <Card className="flex items-center justify-center p-6 shadow-none ring-foreground/12">
                  <p className="font-display text-sm text-muted-foreground">
                    Lineage is complete to the configured depth.
                  </p>
                </Card>
              )}
            </div>
          </section>
        ) : null}
```

The `GENERATION_HEADING` map is already defined at the top of the file — reuse it.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual verification via curl**

```bash
curl -sS http://localhost:3001/family/tree | grep -oE '>(Coverage|Per generation|Research frontier|missing parents|missing father|missing mother)<' | sort -u
```

Expected: `>Coverage<`, `>Per generation<`, `>Research frontier<`, plus at least one `missing parents`/`missing father`/`missing mother` (assuming the data has gaps — likely at older generations).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/family/tree/page.tsx
git commit -m "feat: render coverage panel with research frontier"
```

---

### Task 3: Final verification + roadmap

- [ ] **Step 1: Tests + typecheck**

```bash
cd core && npm test
cd frontend && npm test && npx tsc --noEmit
```

Expected: PASS — counts unchanged from previous feature; this plan adds no core tests because the computation is straightforward derivation in the frontend layer (could be unit-tested if the panel grows complex; deferred for now).

- [ ] **Step 2: Mark feature #4 shipped on roadmap**

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/
git commit -m "chore: ship coverage prompts"
```
