# core/

Platform-agnostic logic shared by every other package. No React, no Next,
no Electron. The functions here describe the wiki's data model — pages,
GEDCOM records, family graphs, search documents — and the operations on
them. Everything I/O lives at the boundary in callers.

## Modules

| Module          | Responsibility                                                            |
| --------------- | ------------------------------------------------------------------------- |
| `pages/`        | Markdown + frontmatter parsing, page metadata schema (Zod), file storage. |
| `gedcom/`       | GEDCOM file parsing, deriving per-individual YAML records, sync state.   |
| `family/`       | Pure graph operations on GEDCOM records — ancestors, descendants, cohort (siblings/cousins), relationship calculator, lifespan timeline, places. |
| `search/`       | FlexSearch index build + persist for wiki content. |

## How tests work here

Tests live next to the module under `core/test/<area>/<name>.test.ts` and
use `node:test` + `node:assert/strict` — no Jest, no Vitest.

```bash
npm test                                          # full suite
npx tsx --test test/family/relationship.test.ts   # one file
```

The shape that makes core code testable is **functions that take their
data as arguments**, not functions that read files. For example, every
function in `family/` accepts `Map<string, DerivedRecord>` rather than
`derivedDir: string`. The frontend's `lib/family.ts` is the one place
that does the file reading and passes the map down.

When you add a new module here, follow the same shape:

- Inputs: plain data (Map, array, primitive)
- Output: plain data
- No `readFileSync`, no `fetch`, no globals
- Test fixture builds the input inline in the test file

## What lives at the boundary, not here

- File reads from `genealogy/derived/*.yml` → `frontend/lib/family.ts`
- File reads from `pages/*.md` → `core/src/pages/store.ts` is the only
  exception; it's the page-store interface and intentionally crosses
  the line because pages are the unit the platform deals with.
- Wiki page → page slug joins → `frontend/lib/family.ts` (`buildPageJoin`)
- Anything React → `frontend/`

## Conventions

- Each module is one folder under `core/src/<name>/` with its public
  surface in `index.ts` (or named exports from a small set of files).
- Types live next to the code that produces them, not in a generic
  `types.ts` (except for foundational shared types like `DerivedRecord`
  in `gedcom/types.ts`).
- Sort comparators that show up in two modules go in `core/src/family/sort.ts`
  (or equivalent shared file). Don't duplicate.
- Date parsing → `core/src/family/dates.ts`. The GEDCOM format has
  date qualifiers (`ABT 1880`, `BEF 1900`, `BET 1850 AND 1860`) that
  the parser handles — call it instead of hand-rolling regex.

## Pitfalls

- **Don't add file I/O to `family/`, `gedcom/`, `search/`** — keep them
  pure. The temptation is high when you're hooking up a new feature; resist.
- **Don't import from `frontend/` or `desktop/`** — that's a layer
  violation. If you find you need types from those packages, the type
  probably belongs here.
- **Don't depend on Node-only globals** in `family/`, `gedcom/`,
  `search/` — these modules should run in any TS environment.
