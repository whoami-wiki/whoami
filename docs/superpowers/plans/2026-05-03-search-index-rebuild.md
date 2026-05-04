# Search index rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the search index rebuild contract explicit — give the user a `wai rebuild-search` command for the cases the API doesn't cover (direct file edits, schema migrations, fresh-machine first boot), and add a dev-mode auto-rebuild so iteration on pages doesn't require remembering to run it.

**Architecture:** Two new surfaces on top of the existing `rebuildSearchIndexFromDisk()` (`frontend/lib/server-services.ts:71`):
1. **HTTP route** `frontend/app/api/search/rebuild/route.ts` — `POST` triggers a rebuild and reports `{ ok, pages, ms }`; `GET` reports `{ stale }` without rebuilding.
2. **CLI command** `wai rebuild-search [--check]` — thin client over the route, like every other `wai` command.
3. **Dev-only staleness probe** in `getSearchIndex()` — walks `pages/` mtimes against the index file mtime and triggers a rebuild before returning the index. Off in production (the desktop app, eventually deployed frontend) where it would add latency to the first request after any change.

**Tech Stack:** Next.js 16 App Router (frontend), Node `tsx --test` (tests), the existing `wai` CLI HTTP client pattern.

**Resolved design questions (resolve again at execute time if context changes):**

- **Staleness check uses per-file mtime, not directory mtime.** The original sketch said "mtime of pages dir > mtime of index file." Directory mtime only changes on add/remove/rename, not when an existing file is edited — which is the most common case. We walk `readdirSync(pagesDir)` and `statSync` each `.md` to find the max mtime, then compare to the index file mtime. With ~100–2000 pages this is sub-millisecond.
- **CLI always goes through the API.** No standalone "talk directly to disk" mode. The in-memory cache lives in the server, so the rebuild has to invalidate it through the route. If the server isn't running, `wai rebuild-search` fails with a clean `ApiError` like every other `wai` command. This matches user expectations from `wai write`, `wai sync-gedcom`, etc.
- **`--check` is `GET /api/search/rebuild`, rebuild is `POST`.** Idiomatic REST; lets `--check` be a true no-op.
- **Documentation lives in `core/AGENTS.md` and `cli/AGENTS.md`** as the original sketch specified. The dev-mode behavior is an implementation detail that doesn't change the contract, so it doesn't need a `frontend/AGENTS.md` section.

---

## File Structure

**Create:**
- `frontend/app/api/search/rebuild/route.ts` — GET (staleness probe) + POST (rebuild).
- `frontend/lib/search-staleness.ts` — pure-ish `isSearchIndexStale(pagesDir, indexPath)` returning a boolean (uses `statSync`; no globals).
- `frontend/lib/search-staleness.test.ts` — unit test for the staleness check using a tmp dir.
- `cli/src/commands/rebuild-search.ts` — `runRebuildSearch({ check, client, write })`.
- `cli/test/rebuild-search.test.ts` — unit test with a mocked client.

**Modify:**
- `frontend/lib/server-services.ts` — `rebuildSearchIndexFromDisk()` returns `{ pages, ms }`; `getSearchIndex()` runs the dev staleness probe before returning.
- `cli/src/api-client.ts` — add `rebuildSearch()` and `rebuildSearchCheck()` methods.
- `cli/src/index.ts` — wire `rebuild-search` into the command switch + help text.
- `cli/test/api-client.test.ts` — add coverage for the new client methods.
- `core/AGENTS.md` — add a "Search rebuild contract" subsection under the search module description.
- `cli/AGENTS.md` — add `rebuild-search` to the commands table.

---

## Task 1: Set up worktree

This plan executes in an isolated worktree off `main`, not on the current `migration-spec` branch (which has unrelated uncommitted work).

**Files:** N/A (workspace setup).

- [ ] **Step 1: Verify there are no uncommitted changes you care about losing.**

The current `migration-spec` branch has uncommitted changes that belong to other in-progress work — leave them alone. Don't `git stash` or `git add` anything from this directory before creating the worktree.

- [ ] **Step 2: Create the worktree off main.**

Run:
```bash
cd /Users/nyetwork/dev/whoami
git fetch origin main
git worktree add -b search-index-rebuild ../whoami.search-index-rebuild origin/main
cd ../whoami.search-index-rebuild
```

Expected: a new worktree at `../whoami.search-index-rebuild` on a fresh `search-index-rebuild` branch off `origin/main`.

- [ ] **Step 3: Confirm clean status in the worktree.**

Run: `git status`
Expected: `nothing to commit, working tree clean` (or only the new docs plan if you want to bring it forward — usually fine to re-create it in this worktree to keep history linear).

All subsequent paths in this plan are relative to the worktree root (`../whoami.search-index-rebuild`).

---

## Task 2: Pure staleness check

A pure function that the dev auto-rebuild and the `--check` route both call. Lives in the frontend (it's a frontend concern — `core/` doesn't depend on file paths above the function boundary, and `core/search/rebuild.ts` already does the actual walk).

**Files:**
- Create: `frontend/lib/search-staleness.ts`
- Test: `frontend/lib/search-staleness.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `frontend/lib/search-staleness.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isSearchIndexStale } from './search-staleness';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'staleness-'));
  const pagesDir = join(root, 'pages');
  const indexPath = join(root, 'data', 'search.idx.json');
  mkdirSync(pagesDir, { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  return { root, pagesDir, indexPath };
}

test('staleness: missing index is stale', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(join(pagesDir, 'a.md'), '---\ntitle: A\n---\nbody\n');
    assert.equal(isSearchIndexStale(pagesDir, indexPath), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: index newer than every page is fresh', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(join(pagesDir, 'a.md'), '---\ntitle: A\n---\nbody\n');
    // Backdate the page so the index (written next) is strictly newer.
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(pagesDir, 'a.md'), past, past);
    writeFileSync(indexPath, '{}');
    assert.equal(isSearchIndexStale(pagesDir, indexPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: an edited existing page makes the index stale', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(join(pagesDir, 'a.md'), '---\ntitle: A\n---\nbody\n');
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(pagesDir, 'a.md'), past, past);
    writeFileSync(indexPath, '{}');
    // Now "edit" the page — bump its mtime to now.
    const now = new Date();
    utimesSync(join(pagesDir, 'a.md'), now, now);
    assert.equal(isSearchIndexStale(pagesDir, indexPath), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: ignores _archived and _meta entries', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    mkdirSync(join(pagesDir, '_archived'), { recursive: true });
    writeFileSync(join(pagesDir, '_archived', 'old.md'), '---\ntitle: Old\n---\nbody\n');
    writeFileSync(indexPath, '{}');
    // _archived was written after the index, but should be ignored.
    assert.equal(isSearchIndexStale(pagesDir, indexPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: ignores non-md files', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(indexPath, '{}');
    // Touch a non-md file after the index was written.
    writeFileSync(join(pagesDir, 'README.txt'), 'hi');
    assert.equal(isSearchIndexStale(pagesDir, indexPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run the test, verify it fails.**

Run: `cd frontend && npx tsx --test lib/search-staleness.test.ts`
Expected: FAIL with "Cannot find module './search-staleness'".

- [ ] **Step 3: Write the implementation.**

Create `frontend/lib/search-staleness.ts`:
```typescript
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Returns true if the search index file is missing, or any non-archived
 * .md page in pagesDir has an mtime newer than the index file.
 *
 * Sync, no globals — safe to call from request paths. ~100–2000 statSync
 * calls per invocation; sub-millisecond at current scale.
 */
export function isSearchIndexStale(pagesDir: string, indexPath: string): boolean {
  if (!existsSync(indexPath)) return true;
  const indexMtime = statSync(indexPath).mtimeMs;
  for (const entry of readdirSync(pagesDir)) {
    if (entry.startsWith('_')) continue;
    if (!entry.endsWith('.md')) continue;
    const mtime = statSync(join(pagesDir, entry)).mtimeMs;
    if (mtime > indexMtime) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run the test, verify it passes.**

Run: `cd frontend && npx tsx --test lib/search-staleness.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Typecheck.**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit.**

```bash
git add frontend/lib/search-staleness.ts frontend/lib/search-staleness.test.ts
git commit -m "feat: add isSearchIndexStale staleness probe"
```

---

## Task 3: Make `rebuildSearchIndexFromDisk` return metrics

The route needs `{ pages, ms }` to report a useful response. The function already has all the data; just thread the count and timing out.

**Files:**
- Modify: `frontend/lib/server-services.ts:71-79`

- [ ] **Step 1: Look at the current implementation.**

The current code at `frontend/lib/server-services.ts:71-79`:
```typescript
export async function rebuildSearchIndexFromDisk(): Promise<void> {
  const idx = createSearchIndex();
  await rebuildSearchIndex(idx, {
    pagesDir: join(WHOAMI_ROOT, 'pages'),
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
  });
  await saveSearchIndex(idx, SEARCH_INDEX_FILE);
  _search = idx;
}
```

`rebuildSearchIndex` (in `core/src/search/rebuild.ts`) already returns `Promise<number>` — the count of pages indexed. So we just need to capture it and time the call.

- [ ] **Step 2: Modify `rebuildSearchIndexFromDisk` to return `{ pages, ms }`.**

Replace lines 71-79 of `frontend/lib/server-services.ts` with:
```typescript
export async function rebuildSearchIndexFromDisk(): Promise<{ pages: number; ms: number }> {
  const t0 = Date.now();
  const idx = createSearchIndex();
  const pages = await rebuildSearchIndex(idx, {
    pagesDir: join(WHOAMI_ROOT, 'pages'),
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
  });
  await saveSearchIndex(idx, SEARCH_INDEX_FILE);
  _search = idx;
  return { pages, ms: Date.now() - t0 };
}
```

- [ ] **Step 3: Confirm the existing caller still compiles.**

The only existing caller is `frontend/app/api/gedcom/sync/route.ts:32`:
```typescript
await rebuildSearchIndexFromDisk();
```

This ignores the return value, so the signature change is non-breaking. Verify by running:
```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run the existing frontend test suite to confirm nothing regressed.**

Run: `cd frontend && npm test`
Expected: all existing tests pass (the change is additive).

- [ ] **Step 5: Commit.**

```bash
git add frontend/lib/server-services.ts
git commit -m "feat: rebuildSearchIndexFromDisk returns {pages, ms}"
```

---

## Task 4: Dev-mode auto-rebuild in `getSearchIndex`

In dev, before returning the index, check if it's stale and rebuild if so. In prod, skip — the explicit rebuild path is the contract there.

**Files:**
- Modify: `frontend/lib/server-services.ts` (`getSearchIndex` at lines 48-64)

- [ ] **Step 1: Read the existing `getSearchIndex` to refresh the layout.**

Current code (lines 45-64):
```typescript
let _search: SearchIndex | null = null;
let _searchReady: Promise<void> | null = null;

export async function getSearchIndex(): Promise<SearchIndex> {
  if (!_search) {
    _search = createSearchIndex();
    _searchReady = (async () => {
      const loaded = await loadSearchIndex(_search!, SEARCH_INDEX_FILE);
      if (!loaded) {
        await rebuildSearchIndex(_search!, {
          pagesDir: join(WHOAMI_ROOT, 'pages'),
          genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
        });
        await saveSearchIndex(_search!, SEARCH_INDEX_FILE);
      }
    })();
  }
  await _searchReady;
  return _search!;
}
```

- [ ] **Step 2: Add the dev staleness probe.**

Add the import near the top of `frontend/lib/server-services.ts` (after the `WHOAMI_ROOT` import on line 8):
```typescript
import { isSearchIndexStale } from './search-staleness';
```

Add a single in-flight guard for the stale check (so concurrent requests don't trigger duplicate rebuilds). After the existing `let _search` and `let _searchReady` declarations, add:
```typescript
let _devStaleCheck: Promise<void> | null = null;
```

Replace the body of `getSearchIndex` with:
```typescript
export async function getSearchIndex(): Promise<SearchIndex> {
  if (!_search) {
    _search = createSearchIndex();
    _searchReady = (async () => {
      const loaded = await loadSearchIndex(_search!, SEARCH_INDEX_FILE);
      if (!loaded) {
        await rebuildSearchIndex(_search!, {
          pagesDir: join(WHOAMI_ROOT, 'pages'),
          genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
        });
        await saveSearchIndex(_search!, SEARCH_INDEX_FILE);
      }
    })();
  }
  await _searchReady;
  // Dev only: if pages have been edited outside the API path, rebuild
  // before returning. Single in-flight guard collapses concurrent checks.
  if (process.env.NODE_ENV === 'development') {
    if (!_devStaleCheck) {
      _devStaleCheck = (async () => {
        try {
          if (isSearchIndexStale(PAGES_DIR, SEARCH_INDEX_FILE)) {
            await rebuildSearchIndexFromDisk();
          }
        } finally {
          _devStaleCheck = null;
        }
      })();
    }
    await _devStaleCheck;
  }
  return _search!;
}
```

Note: `PAGES_DIR` is already imported on line 8; `SEARCH_INDEX_FILE` likewise. No new imports needed beyond `isSearchIndexStale`.

- [ ] **Step 3: Typecheck.**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run tests.**

Run: `cd frontend && npm test`
Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add frontend/lib/server-services.ts
git commit -m "feat: dev-mode auto-rebuild of stale search index"
```

---

## Task 5: API route `/api/search/rebuild`

`POST` rebuilds and returns metrics; `GET` reports staleness without side effects.

**Files:**
- Create: `frontend/app/api/search/rebuild/route.ts`

- [ ] **Step 1: Create the route file.**

```bash
mkdir -p frontend/app/api/search/rebuild
```

Create `frontend/app/api/search/rebuild/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { rebuildSearchIndexFromDisk } from '@/lib/server-services';
import { isSearchIndexStale } from '@/lib/search-staleness';
import { PAGES_DIR, SEARCH_INDEX_FILE } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stale = isSearchIndexStale(PAGES_DIR, SEARCH_INDEX_FILE);
  return NextResponse.json({ stale });
}

export async function POST() {
  try {
    const { pages, ms } = await rebuildSearchIndexFromDisk();
    return NextResponse.json({ ok: true, pages, ms });
  } catch (err) {
    return NextResponse.json(
      { error: 'rebuild-failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Typecheck.**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test against the dev server (skip if no dev server).**

In one terminal:
```bash
cd frontend && npm run dev
```

In another:
```bash
curl -s http://localhost:3001/api/search/rebuild | jq .
curl -sX POST http://localhost:3001/api/search/rebuild | jq .
curl -s http://localhost:3001/api/search/rebuild | jq .
```

Expected output (in order):
1. `{"stale": false}` or `{"stale": true}` depending on disk state.
2. `{"ok": true, "pages": <count>, "ms": <ms>}`.
3. `{"stale": false}` (the POST refreshed the index, so GET should report fresh).

If you don't have the dev server running locally, skip this step — the e2e test in Task 11 covers the same path when a server is up.

- [ ] **Step 4: Commit.**

```bash
git add frontend/app/api/search/rebuild/route.ts
git commit -m "feat: add /api/search/rebuild route"
```

---

## Task 6: ApiClient methods

Two methods: `rebuildSearch()` (POST) and `rebuildSearchCheck()` (GET).

**Files:**
- Modify: `cli/src/api-client.ts`
- Test: `cli/test/api-client.test.ts`

- [ ] **Step 1: Write failing tests for both methods.**

Add to the end of `cli/test/api-client.test.ts`:
```typescript
test('ApiClient.rebuildSearch: POSTs and parses metrics', async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/api/search/rebuild');
      res.setHeader('content-type', 'application/json');
      res.end('{"ok":true,"pages":42,"ms":17}');
    },
    async (base) => {
      const c = new ApiClient(base);
      const r = await c.rebuildSearch();
      assert.equal(r.ok, true);
      assert.equal(r.pages, 42);
      assert.equal(r.ms, 17);
    },
  );
});

test('ApiClient.rebuildSearchCheck: GETs and parses staleness', async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.method, 'GET');
      assert.equal(req.url, '/api/search/rebuild');
      res.setHeader('content-type', 'application/json');
      res.end('{"stale":true}');
    },
    async (base) => {
      const c = new ApiClient(base);
      const r = await c.rebuildSearchCheck();
      assert.equal(r.stale, true);
    },
  );
});
```

- [ ] **Step 2: Run the tests, verify they fail.**

Run: `cd cli && npx tsx --test test/api-client.test.ts`
Expected: FAIL with "rebuildSearch is not a function" (or similar).

- [ ] **Step 3: Implement the methods.**

Add to `cli/src/api-client.ts`. After the existing `search` method (around line 88), add:
```typescript
  async rebuildSearch(): Promise<{ ok: true; pages: number; ms: number }> {
    return this.json('POST', '/api/search/rebuild');
  }

  async rebuildSearchCheck(): Promise<{ stale: boolean }> {
    return this.json('GET', '/api/search/rebuild');
  }
```

- [ ] **Step 4: Run the tests, verify they pass.**

Run: `cd cli && npx tsx --test test/api-client.test.ts`
Expected: PASS, all tests including the two new ones.

- [ ] **Step 5: Typecheck.**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit.**

```bash
git add cli/src/api-client.ts cli/test/api-client.test.ts
git commit -m "feat: add rebuildSearch ApiClient methods"
```

---

## Task 7: `wai rebuild-search` command runner

Pure runner function with `--check` support, mockable client, exit-code-via-throw on `--check stale`.

**Files:**
- Create: `cli/src/commands/rebuild-search.ts`
- Test: `cli/test/rebuild-search.test.ts`

- [ ] **Step 1: Write the failing tests.**

Create `cli/test/rebuild-search.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRebuildSearch } from '../src/commands/rebuild-search.js';

test('rebuild-search: prints rebuild summary on success', async () => {
  let out = '';
  await runRebuildSearch({
    check: false,
    client: { rebuildSearch: async () => ({ ok: true as const, pages: 107, ms: 23 }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /rebuilt 107 pages in 23ms/);
});

test('rebuild-search: --check fresh prints fresh and resolves', async () => {
  let out = '';
  await runRebuildSearch({
    check: true,
    client: { rebuildSearchCheck: async () => ({ stale: false }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /^fresh/);
});

test('rebuild-search: --check stale throws (so CLI exits non-zero)', async () => {
  let out = '';
  await assert.rejects(
    () => runRebuildSearch({
      check: true,
      client: { rebuildSearchCheck: async () => ({ stale: true }) } as any,
      write: (s) => { out += s; },
    }),
    /stale/i,
  );
  assert.match(out, /^stale/);
});
```

- [ ] **Step 2: Run tests, verify they fail.**

Run: `cd cli && npx tsx --test test/rebuild-search.test.ts`
Expected: FAIL with "Cannot find module '../src/commands/rebuild-search.js'".

- [ ] **Step 3: Implement the command runner.**

Create `cli/src/commands/rebuild-search.ts`:
```typescript
import type { ApiClient } from '../api-client.js';

export interface RebuildSearchOptions {
  check: boolean;
  client: Pick<ApiClient, 'rebuildSearch' | 'rebuildSearchCheck'>;
  write: (s: string) => void;
}

export async function runRebuildSearch(opts: RebuildSearchOptions): Promise<void> {
  if (opts.check) {
    const { stale } = await opts.client.rebuildSearchCheck();
    opts.write(stale ? 'stale\n' : 'fresh\n');
    if (stale) throw new Error('search index is stale');
    return;
  }
  const { pages, ms } = await opts.client.rebuildSearch();
  opts.write(`rebuilt ${pages} pages in ${ms}ms\n`);
}
```

The thrown `Error` on `--check stale` propagates to `main()` in `index.ts`, which writes to stderr and returns exit code 1 — matching the original sketch's "exits non-zero if the existing index is stale".

- [ ] **Step 4: Run tests, verify they pass.**

Run: `cd cli && npx tsx --test test/rebuild-search.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Typecheck.**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit.**

```bash
git add cli/src/commands/rebuild-search.ts cli/test/rebuild-search.test.ts
git commit -m "feat: add wai rebuild-search command runner"
```

---

## Task 8: Wire `rebuild-search` into the CLI entry

Add the import, the switch case, and the help text.

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Add the import.**

After the existing import line for `runSyncGedcom` (line 12 of `cli/src/index.ts`), add:
```typescript
import { runRebuildSearch } from './commands/rebuild-search.js';
```

- [ ] **Step 2: Add to the help text.**

In the `HELP` constant, find the GEDCOM block (around lines 36-39). After the `recite --apply` line, add a new block:
```
Search:
  rebuild-search              Rebuild the search index from disk
                                (use after editing pages outside the API)
  rebuild-search --check      Exit non-zero if the index is stale (no rebuild)
```

This goes between the existing `GEDCOM:` block and the `Server:` block. Adjust whitespace to match.

- [ ] **Step 3: Add the switch case.**

In `main()`, after the `case 'search':` block (around line 175) and before `case 'healthz':`, add:
```typescript
      case 'rebuild-search': {
        await runRebuildSearch({
          check: !!args.flags.check,
          client,
          write,
        });
        break;
      }
```

- [ ] **Step 4: Typecheck.**

Run: `cd cli && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Run the full CLI test suite.**

Run: `cd cli && npm test`
Expected: all pass (new tests + existing).

- [ ] **Step 6: Manual smoke test (skip if no dev server).**

If the frontend dev server is running:
```bash
cd cli
npx tsx src/index.ts rebuild-search --check
echo "exit code: $?"
npx tsx src/index.ts rebuild-search
npx tsx src/index.ts rebuild-search --check
echo "exit code: $?"
```

Expected:
- First `--check` prints `fresh` or `stale` and exits 0 or 1.
- The unconditional rebuild prints `rebuilt N pages in Tms`.
- Second `--check` prints `fresh`, exit code 0.

Skip if no dev server; e2e covered manually at the end.

- [ ] **Step 7: Commit.**

```bash
git add cli/src/index.ts
git commit -m "feat: wire rebuild-search into wai CLI"
```

---

## Task 9: Update docs

The contract belongs in `core/AGENTS.md` (the search module description) and `cli/AGENTS.md` (the commands table).

**Files:**
- Modify: `core/AGENTS.md`
- Modify: `cli/AGENTS.md`

- [ ] **Step 1: Update `core/AGENTS.md` — add the contract subsection.**

In `core/AGENTS.md`, find the `Modules` table (around lines 16-22). The `search/` row reads "FlexSearch index build + persist for wiki content."

After the `## Modules` table and before `## How tests work here`, insert a new section:

```markdown
## Search index rebuild contract

The search index lives at `~/whoami/data/search.idx.json` and is updated on
several paths:

- **Page write/delete via API** — incremental: the route calls
  `idx.upsert(...)` / `idx.remove(slug)` and persists. No manual action.
- **GEDCOM sync** — full rebuild from disk after derived YAMLs regenerate.
- **Direct edits to `~/whoami/pages/`** (text editor, git pull, schema
  migration) — the API never sees the write. Run `wai rebuild-search` to
  refresh, or `wai rebuild-search --check` to see if a rebuild is needed.
- **Dev mode** — `getSearchIndex()` checks page mtimes against the index
  mtime on each call and rebuilds before returning if stale. Off in prod
  to avoid request-path latency.

The "talks to disk" code lives in `core/src/search/rebuild.ts` (boundary
module). The contract above is implemented in `frontend/lib/server-services.ts`
and exposed via `POST /api/search/rebuild` and `wai rebuild-search`.
```

- [ ] **Step 2: Update `cli/AGENTS.md` — add to the commands table.**

In `cli/AGENTS.md`, find the `## Commands` table (around lines 11-23). After the `sync-gedcom` row and before the `recite` row, add:
```markdown
| `rebuild-search` | Rebuild the search index from disk (use after editing pages outside the API). `--check` exits non-zero if stale. |
```

- [ ] **Step 3: Spot-check the rendered tables.**

```bash
grep -A2 "rebuild-search" cli/AGENTS.md
grep -B1 -A2 "Search index rebuild contract" core/AGENTS.md
```
Expected: the new content appears in both files in the correct location.

- [ ] **Step 4: Commit.**

```bash
git add core/AGENTS.md cli/AGENTS.md
git commit -m "docs: document search index rebuild contract"
```

---

## Task 10: Final verification

Run typechecks and full test suites across the touched packages.

**Files:** N/A (verification only).

- [ ] **Step 1: Typecheck both packages.**

Run:
```bash
cd frontend && npx tsc --noEmit
cd ../cli && npm run typecheck
cd ../core && npx tsc --noEmit
```
Expected: no errors anywhere.

- [ ] **Step 2: Run all touched test suites.**

Run:
```bash
cd frontend && npm test
cd ../cli && npm test
cd ../core && npm test
```
Expected: all pass.

- [ ] **Step 3: Confirm git log shape.**

Run: `git log --oneline origin/main..HEAD`
Expected: ~7 commits, each one logical step (`feat: add isSearchIndexStale...`, `feat: rebuildSearchIndexFromDisk returns ...`, `feat: dev-mode auto-rebuild...`, `feat: add /api/search/rebuild route`, `feat: add rebuildSearch ApiClient methods`, `feat: add wai rebuild-search command runner`, `feat: wire rebuild-search into wai CLI`, `docs: document search index rebuild contract`).

- [ ] **Step 4: Update the original plan doc to mark it shipped.**

The current plan (this file) was a sketch. Now that it's a real plan and implemented, change the top-of-file `Status` line. The header that used to read:
```markdown
> **Status:** sketch — implementation deferred. Spawn a fresh session driven by this plan when search-index drift becomes a felt problem.
```
should now read:
```markdown
> **Status:** shipped 2026-05-03.
```

(If you've already replaced the whole file with this implementation plan, the header at the top of *this* file already won't have the `Status: sketch` line — skip this step.)

- [ ] **Step 5: Commit doc update if needed.**

```bash
git status
# If docs/superpowers/plans/2026-05-03-search-index-rebuild.md is modified, commit:
git add docs/superpowers/plans/2026-05-03-search-index-rebuild.md
git commit -m "docs: mark search-index-rebuild plan as shipped"
```

---

## Task 11: Hand off using finishing-a-development-branch

Per the executing-plans skill, after all tasks are complete:

- [ ] **Step 1: Announce and invoke the finishing skill.**

Announce: "I'm using the finishing-a-development-branch skill to complete this work."

Then invoke `superpowers:finishing-a-development-branch` and follow it to verify tests, present integration options (merge / PR / cleanup), and execute the user's choice.

---

## Out of scope (deferred)

These were called out as "open questions" in the original sketch and are intentionally **not** in this plan:

- **`wai migrate --rebuild-search` integration** — depends on the schema-migrations plan (`2026-05-03-schema-migrations.md`) actually shipping. When that lands, add a follow-on task there to call this rebuild route after migrations complete.
- **Cross-machine sync via post-merge git hook** — would auto-rebuild after `git pull` on a second machine. Possible follow-on, not blocking.
- **Partial rebuild (`--page <slug>`)** — full rebuild is fast at current scale. Revisit only if pages count exceeds ~10,000.
