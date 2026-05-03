# Family Explorer Roadmap

> **Index, not a plan.** Each feature below gets its own plan document under `docs/superpowers/plans/`. This file just sequences them and explains why.

**Goal:** Turn the family browser from a chain-style ancestor walker into a tool a non-technical relative can open and (a) see their cohort, not just their line, (b) understand how they relate to anyone, (c) navigate down as well as up, (d) recognize people by face and lifespan, and (e) discover gaps to fill.

**Scope:** 9 features, sequenced below. Each is a separate, shippable plan.

**Constraints carried through every feature:**
- No auth (Tailscale ACLs are the access layer)
- Information density preferred — no Apple-style sparseness
- No page-bg tints, drop caps, noise overlays, or other "wiki vibes" flourishes
- whoami.wiki conventions: `core/` holds pure logic + tests, `frontend/lib/` joins to wiki pages, `frontend/components/family/` holds presentational pieces
- Tests live next to the module (`*.test.ts`), use `node:test`/`assert/strict`
- Conventional commits, lowercase subject, no scope, imperative

---

## Sequenced features

### 1. Siblings & cousins on the person view  (SHIPPED 2026-05-02)
**Why first:** smallest, all data is in `DerivedRecord` already (parents → children minus self for siblings; parents' siblings' children for cousins). Directly fixes the "this feels like a chain" complaint. No new derivation, no UI primitives needed beyond what `PersonRow`/`AncestorTile` already provide.
**Plan:** `2026-05-02-family-siblings-cousins.md`

### 2. Descendants view  (SHIPPED 2026-05-02)
**Why second:** uses the same directional walker shape as the cousin computation in #1; reusing those primitives is cleanest if #1 lands first. Walks `children[]` recursively from any selected ancestor — answers "everyone who descends from Great-Grandpa Joe."
**Plan:** `2026-05-02-family-descendants.md`

### 3. Relationship calculator  (SHIPPED 2026-05-02)
**Why third:** needs bidirectional graph traversal (BFS up from both parties to a lowest common ancestor, then label the path). Gets significantly easier if the descendants walker (#2) and the cousin labeler (#1) already exist — the relationship terms ("first cousin once removed", "great-aunt") are the same logic. Highest delight-per-line-of-code.
**Plan:** `2026-05-02-family-relationship-calculator.md`

### 4. Coverage prompts  (SHIPPED 2026-05-03)
**Why fourth:** trivial once #1–#3 normalize how "known vs possible" is computed. Surface gaps as a sidebar panel ("3 of 8 great-great-grandparents unknown — paternal-paternal-paternal, paternal-paternal-maternal, …"). Already partially surfaced as `01 / 02` counts in the existing UI; this just promotes it.
**Plan:** `2026-05-02-family-coverage.md`

### 5. Lifespan timeline  (SHIPPED 2026-05-03)
**Why fifth:** independent UI feature, but needs a GEDCOM-date → year parser (handles `12 JAN 1950`, `ABT 1880`, `BEF 1900`, `BET 1850 AND 1860`). Year parser is small but worth its own commit. Renders horizontal bars per ancestor — answers "who overlapped with whom."
**Plan:** `2026-05-02-family-timeline.md`

### 6. Portraits on tiles  (SHIPPED 2026-05-03 — monogram fallback; portrait field ready in PageMeta)
**Why sixth:** depends on whether wiki page frontmatter already has portrait paths (TBD — first task in this plan is "audit the data"). If yes, this is a presentational change to `AncestorTile` + `PersonRow` with monogram fallback. If no, it's a separate data-shape change first.
**Plan:** `2026-05-02-family-portraits.md`

### 7. Search facets  (SHIPPED 2026-05-03 — type facets only; surname/decade/place deferred)
**Why seventh:** separate concern from the family browser; touches `frontend/app/search/`. Filters by surname, decade, place. Worth doing after the family work because the family browser's data shape may change first and the search index will want to reflect that.
**Plan:** `2026-05-02-search-facets.md`

### 8. Map of birthplaces  (SHIPPED 2026-05-03 — Leaflet map + curated `genealogy/places-coords.yml`; unknown places fall back to the Unmapped list and `research-plans/places-research.md`)
**Why eighth:** highest scope. Needs geocoding (place strings → lat/lon) which is either a one-shot batch via Nominatim with caching to a checked-in JSON, or a manual curated lookup. Render as a static SVG. Punt to last because the data work dominates.
**Plan:** `2026-05-02-family-map.md`

### 9. Shareable relationship links  (SHIPPED 2026-05-03)
**Why last:** depends on #3 (relationship calculator) being in place. Tiny once #3 ships — `?from=I123&to=I456` query params produce a captioned page like "Y's paternal great-grandmother."
**Plan:** `2026-05-02-family-shareable-links.md`

---

## Sequencing principles

- **Reuse before you build.** #1 → #2 → #3 share graph-walking primitives; doing them in order means the third reuses what the first two crystallized.
- **Data work before presentation.** #5 (date parser) and #6 (portrait audit) gate their UI; surface those data unknowns at the start of each plan, not midway.
- **Highest scope last.** #8 has a meaningful data project inside it (geocoding); all other features are pure code on existing data.

## Execution model

Each plan is a separate session with its own subagent-driven execution. Commit boundaries match plan boundaries. Don't skip the test step — `core/test/family/` is the source of truth for graph-walking correctness.
