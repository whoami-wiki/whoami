# core/

Platform-agnostic logic shared by every other package. No React, no Next,
no Electron. The functions here describe the wiki's data model — pages,
GEDCOM records, family graphs, search documents — and the operations on
them.

Most of `core/` is purely functional: functions take data, return data.
A handful of modules are explicitly **I/O-boundary modules** where the
rest of the system meets the disk; they accept paths in their public
signatures by design. New code that isn't one of those boundary modules
should accept data, not paths.

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

## Pure modules vs. boundary modules

**Pure** (take data, return data — no file I/O, no `process`, no `fetch`):

- All of `core/src/family/*` *except* `trace.ts`. `cohort.ts`,
  `descendants.ts`, `relationship.ts`, `dates.ts`, `timeline.ts`,
  `places.ts`, `places-coords.ts` (parser only), `browser.ts`, `sort.ts`.
- `core/src/pages/types.ts`, `schema.ts`, `frontmatter.ts`, `slug.ts`,
  `locks.ts` (in-memory promise queue).
- `core/src/gedcom/types.ts`.
- `core/src/search/types.ts`, `module.ts`, `index.ts`, `doc-builder.ts`.

**Boundary modules** (allowed to do file I/O at their public surface
because they *are* the seam between the rest of the system and disk):

| File | Role |
| --- | --- |
| `pages/store.ts` | Page-store interface — read/write/list pages on disk. |
| `pages/git.ts` | Git plumbing on page files (commit, blame, history). |
| `gedcom/parser.ts` | Parse a `.ged` file into the AST. |
| `gedcom/derive.ts` | Read AST + write `genealogy/derived/*.yml`. |
| `gedcom/snapshots.ts` | Read/write the snapshot manifest. |
| `gedcom/sync.ts` | Walk dirs, write/delete derived YAMLs. |
| `gedcom/recite.ts` | Read/write wiki page files to advance citation pointers. |
| `search/rebuild.ts` | Walk `pages/`, build the search index. |
| `search/persist.ts` | Read/write FlexSearch shard files. |
| `family/trace.ts` | Read derived records from disk for ancestor tracing. |

Other paths data takes:

- File reads from `genealogy/derived/*.yml` → `frontend/lib/family.ts`
  (the loader; `family/trace.ts` is the older path used by `getFamily`).
- Wiki page → page slug joins → `frontend/lib/family.ts` (`buildPageJoin`).
- Anything React → `frontend/`.

If you find yourself wanting to add a new boundary module, ask whether it
genuinely *is* a boundary or whether the I/O could live in a caller and
keep your new module pure. Default answer: keep it pure.

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

- **Don't add file I/O to a pure module** — keep them pure. The temptation
  is high when you're hooking up a new feature; resist. If a new module
  truly needs to read files, justify why it's a boundary module before
  adding it to the table above.
- **Don't import from `frontend/` or `desktop/`** — that's a layer
  violation. If you find you need types from those packages, the type
  probably belongs here.
- **Don't depend on Node-only globals** in pure modules — they should
  run in any TS environment (browser, edge, worker, Deno).
