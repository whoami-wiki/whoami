# Search index rebuild story

> **Status:** sketch — implementation deferred. Spawn a fresh session driven by this plan when search-index drift becomes a felt problem.

**Goal:** Make the rules for when the search index is rebuilt explicit, so search results don't silently go stale when pages or GEDCOM data change outside the API write paths.

## What's already in place (audited 2026-05-03)

The audit's original framing — "no rebuild story" — was too strong.
There is partial coverage today:

- **On page write** (`frontend/app/api/pages/[slug]/route.ts:70–75`):
  the API route loads the current index, calls `idx.upsert(...)` for
  the page being written, and persists. Incremental — fast, correct
  for that one page.
- **On page delete** (same file, `:89–91`): mirror — `idx.remove(slug)`
  + `persistSearchIndex()`.
- **On GEDCOM sync** (`frontend/app/api/gedcom/sync/route.ts:32`):
  full rebuild via `rebuildSearchIndexFromDisk()` after derived YAMLs
  are regenerated.

What's **not** covered:

- **Direct file edits to `~/whoami/pages/`** — if the user edits a page
  with their text editor and the API never sees the write, the index
  goes stale. Common case: editing through git, syncing across machines.
- **Schema migrations** (see `2026-05-03-schema-migrations.md`) —
  `wai migrate` will rewrite many pages outside the API; index must rebuild.
- **First-boot of a fresh machine** — if `~/whoami/data/search.idx.json`
  doesn't exist, the index is empty until something triggers a rebuild.
  Today this is implicit (the GEDCOM sync route covers it the first
  time GEDCOM is synced); should be explicit.

## Sketch of the design

### A new CLI command: `wai rebuild-search`

```
wai rebuild-search [--check]
```

Walks `~/whoami/pages/`, builds a fresh index from disk, persists it.
`--check` exits non-zero if the existing index is stale (mtime of
pages dir > mtime of index file) without actually rebuilding —
useful in scripts or pre-commit hooks.

The actual logic already exists as `rebuildSearchIndexFromDisk()` in
`frontend/lib/server-services.ts`; the CLI command is a thin wrapper.
But the wrapper has to talk to the *running server* (because the
in-memory cache lives there), so it goes through the existing API
client pattern: `POST /api/search/rebuild`.

### A new API route: `/api/search/rebuild`

`frontend/app/api/search/rebuild/route.ts` — `POST` triggers
`rebuildSearchIndexFromDisk()` and returns `{ ok: true, pages: N,
ms: T }`. Cheap operation; idempotent.

### Auto-rebuild on stale (dev only)

In dev, `getSearchIndex()` checks the index file's mtime against the
pages directory's mtime. If pages is newer, rebuild before returning
the index. This makes "edit pages directly, hit the search route, see
fresh results" work without remembering to run `wai rebuild-search`.

In prod (the desktop app, eventually a deployed frontend), keep the
rebuild explicit — auto-rebuild is fine in dev where startup is cheap;
in prod it adds latency to the first request after any change.

Toggle via `process.env.NODE_ENV === 'development'`.

### Documentation

Add a section to `core/AGENTS.md` (under search) and `cli/AGENTS.md`
(in the commands table) describing the rebuild contract:
- API writes update incrementally, no manual action.
- GEDCOM sync rebuilds automatically.
- Direct file edits or schema migrations require `wai rebuild-search`.
- Dev mode auto-detects staleness; prod is explicit.

## Open questions

- **Should `wai migrate` (from the schema-migrations plan) call
  `wai rebuild-search` automatically when it finishes?** Probably yes —
  schema migrations rewrite pages outside the API. Add a flag
  `--rebuild-search` (default true) to make it explicit but easy.
- **Cross-machine sync via git** — if the user edits pages on machine
  A, commits, pulls on machine B, the index on B is stale. Current
  workaround: machine B runs `wai rebuild-search` after a pull. A
  post-merge git hook would automate this; out of scope for this plan
  but worth noting.
- **Partial rebuilds** — if only one page changed but the user can't
  use the API path (e.g. they want to validate before committing),
  is `wai rebuild-search --page <slug>` worth building? Lean: no, full
  rebuild is fast enough at current scale. Revisit if pages count
  exceeds ~10,000.

## Trigger to execute

When the user starts editing pages directly outside the API enough that
search staleness becomes a felt problem, or when the schema-migrations
plan ships (it will rewrite many pages and need a rebuild step).

## References

- Audit finding: `~/.claude/plans/do-an-architecture-audit-partitioned-cherny.md` Severity 5.2
- Existing rebuild logic: `frontend/lib/server-services.ts` (`rebuildSearchIndexFromDisk`, `persistSearchIndex`, `getSearchIndex`)
- Existing call sites: `frontend/app/api/pages/[slug]/route.ts:70-75,89-91`, `frontend/app/api/gedcom/sync/route.ts:32`
- Eventual new files:
  - `frontend/app/api/search/rebuild/route.ts`
  - `cli/src/commands/rebuild-search.ts`
- Related plan: `2026-05-03-schema-migrations.md` (the `wai migrate --rebuild-search` follow-on).
