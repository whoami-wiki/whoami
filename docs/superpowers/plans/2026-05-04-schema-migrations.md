# User-Data Schema Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land schema-versioning + a `wai migrate` runner so breaking changes to `PageMeta` don't silently break existing user pages. Pure infrastructure — V1 ships zero migrations.

**Architecture:** A new `migrations/` module in `core/` defines the registry and `migrate(meta, fromVersion)` composer (pure). `parsePage` becomes the single read seam — it parses, runs `migrate`, and Zod-validates. `store.write` and `store.softDelete` peek the on-disk version and refuse stale or future writes. A new boundary module `core/src/pages/migrate-runner.ts` walks the pages dir and persists migrations as `chore: migrate <slug>` commits, bypassing the strict-write rule because it lives in its own explicit place. Frontend integration: a new `POST /api/migrate` route invokes the runner via `frontend/lib/server-services.ts:runMigrateOnDisk`, which also kicks the search-index rebuild after successful writes.

**Tech Stack:** TypeScript everywhere; `tsx --test` + `node:assert/strict`; Zod for schema validation; `gray-matter` for YAML frontmatter; `simple-git` via `core/src/pages/git.ts:addAndCommit` for commits; Next 16 App Router for the API route.

**Spec:** `docs/superpowers/specs/2026-05-04-schema-migrations-design.md`

---

## File Structure

### New

| Path | Responsibility |
|---|---|
| `core/src/pages/migrations/index.ts` | `Migration` interface, `CURRENT_SCHEMA_VERSION`, `migrate()` composer, `validateRegistry()`, `MissingMigrationError`, `FutureSchemaVersionError`. V1 ships an empty `MIGRATIONS` array. |
| `core/src/pages/migrate-runner.ts` | Boundary module. `runMigrate(opts)` walks `pages/`, applies migrations, writes via atomic tmp+rename, commits via `addAndCommit`. Exports `MIGRATE_AUTHOR`, `DirtyRepoError`, `MigrateReport`. |
| `cli/src/commands/migrate.ts` | Parses argv, calls `client.migrate({ page, dryRun, force })`, prints report. |
| `frontend/app/api/migrate/route.ts` | `POST /api/migrate` → calls `runMigrateOnDisk` from server-services. |
| `core/test/pages/migrations.test.ts` | Tests for `migrate()` composer + `validateRegistry()`. |
| `core/test/pages/migrate-runner.test.ts` | Tests for `runMigrate` against tmp-dir fixtures. |
| `cli/test/migrate.test.ts` | Tests for the CLI translation layer (mocked API client). |
| `frontend/lib/server-services.test.ts` | Tests for `runMigrateOnDisk` orchestration (mocked runner + rebuild). |

### Modified

| Path | Change |
|---|---|
| `core/src/pages/types.ts` | Add `schemaVersion: number` to `PageMeta`. |
| `core/src/pages/schema.ts` | Add `schemaVersion` to Zod with `.default(CURRENT_SCHEMA_VERSION)`. |
| `core/src/pages/frontmatter.ts` | `parsePage` runs parse → migrate → validate. `serializePage` emits `schemaVersion` and `portrait` (fixes drop bug). New helper `peekSchemaVersion(path)`. |
| `core/src/pages/store.ts` | `write` peeks on-disk version; `softDelete` peeks the source path; both throw `StaleSchemaVersionError` / `FutureSchemaVersionError`. |
| `core/src/pages/index.ts` | Re-export from `migrations/` and `migrate-runner.ts`. |
| `core/AGENTS.md` | Add `migrate-runner.ts` to the boundary modules table. |
| `core/test/pages/frontmatter.test.ts` | Add round-trip test, `parsePage` migration tests, `peekSchemaVersion` tests. |
| `core/test/pages/store.test.ts` | Tests for stale/future peek on `write` and `softDelete`. |
| `cli/src/api-client.ts` | Add `MigrateReport` types and `migrate(opts)` method. |
| `cli/src/index.ts` | Register the `migrate` command + help text. |
| `frontend/lib/server-services.ts` | Add `runMigrateOnDisk(opts)` wrapper. |
| `frontend/app/api/pages/[slug]/route.ts` | Catch `StaleSchemaVersionError` / `FutureSchemaVersionError`, return HTTP 409. |

---

## Conventions for every task

- **TDD:** write the failing test first, run it, then implement, then run again.
- **Doc comments:** every exported type, function, class, and constant in new files gets a JSDoc block. The spec's code shapes already include these — preserve that style.
- **Tests:** `node:test` + `node:assert/strict`. No Jest, no Vitest, no Bun.
- **Run tests from the package root**, e.g. `cd core && npx tsx --test test/pages/migrations.test.ts`.
- **Commit per task** with a conventional-commits subject (`feat:`, `fix:`, `chore:`, `test:`).
- **Never use `git add -u`** — the user's data repo at `~/whoami` is separate; stage only files in this code repo.

---

## Task 1: Add `schemaVersion` field to `PageMeta` type

**Files:**
- Modify: `core/src/pages/types.ts`

- [ ] **Step 1: Add the field**

In `core/src/pages/types.ts`, change the `PageMeta` interface so the **first** field is `schemaVersion`:

```ts
export interface PageMeta {
  /**
   * Schema version of this page's frontmatter. Always present after
   * parse — readers that encounter pages with no on-disk schemaVersion
   * field default it to 1 before validation.
   */
  schemaVersion: number;
  title: string;
  owner: string;
  editors: string[];
  type: PageType;
  aliases: string[];
  categories: string[];
  gedcom?: GedcomRef;
  portrait?: string;
  created: string;
  deletedAt?: string;
}
```

- [ ] **Step 2: Run typecheck — expect failures**

Run: `cd core && npm run typecheck`

Expected: errors in `schema.ts` (missing `schemaVersion` in Zod object) and `frontmatter.ts` (renderFrontmatter doesn't write it). These are wired up in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add core/src/pages/types.ts
git commit -m "feat: add schemaVersion field to PageMeta type"
```

---

## Task 2: Migration registry — `migrate()` composer and registry self-check

**Files:**
- Create: `core/src/pages/migrations/index.ts`
- Create: `core/test/pages/migrations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `core/test/pages/migrations.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  migrate,
  validateRegistry,
  type Migration,
  MissingMigrationError,
  FutureSchemaVersionError,
} from '../../src/pages/migrations/index.ts';

test('CURRENT_SCHEMA_VERSION is a positive integer', () => {
  assert.equal(typeof CURRENT_SCHEMA_VERSION, 'number');
  assert.ok(Number.isInteger(CURRENT_SCHEMA_VERSION));
  assert.ok(CURRENT_SCHEMA_VERSION >= 1);
});

test('migrate is a no-op when fromVersion equals CURRENT_SCHEMA_VERSION', () => {
  const meta = { title: 'x', schemaVersion: CURRENT_SCHEMA_VERSION };
  const out = migrate(meta, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(out, meta);
});

test('migrate throws FutureSchemaVersionError when fromVersion > CURRENT', () => {
  assert.throws(
    () => migrate({}, CURRENT_SCHEMA_VERSION + 1),
    FutureSchemaVersionError,
  );
});

test('migrate composes a synthetic chain in order', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'add foo', applyMeta: (m) => ({ ...m, foo: 1 }) },
    { from: 2, to: 3, description: 'add bar', applyMeta: (m) => ({ ...m, bar: 2 }) },
  ];
  const out = migrate({ title: 'x' }, 1, synth, /* targetVersion */ 3);
  assert.deepEqual(out, { title: 'x', foo: 1, bar: 2 });
});

test('migrate throws MissingMigrationError when the chain has a gap', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'add foo', applyMeta: (m) => m },
    // gap: no 2→3
    { from: 3, to: 4, description: 'add baz', applyMeta: (m) => m },
  ];
  assert.throws(
    () => migrate({}, 1, synth, 4),
    MissingMigrationError,
  );
});

test('validateRegistry passes for a contiguous registry', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'a', applyMeta: (m) => m },
    { from: 2, to: 3, description: 'b', applyMeta: (m) => m },
  ];
  assert.doesNotThrow(() => validateRegistry(synth, 3));
});

test('validateRegistry throws on a gap', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'a', applyMeta: (m) => m },
    { from: 3, to: 4, description: 'b', applyMeta: (m) => m },
  ];
  assert.throws(() => validateRegistry(synth, 4), MissingMigrationError);
});

test('the real registry is contiguous up to CURRENT_SCHEMA_VERSION', () => {
  assert.doesNotThrow(() => validateRegistry(MIGRATIONS, CURRENT_SCHEMA_VERSION));
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/migrations.test.ts`

Expected: all tests fail with module-not-found (the file doesn't exist yet).

- [ ] **Step 3: Implement the registry module**

Create `core/src/pages/migrations/index.ts`:

```ts
/**
 * The schema version this build of the code understands.
 * Bump this and add a Migration entry whenever PageMeta gets a
 * breaking change (rename, type change, removal, required field).
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * One step in the migration chain. Operates on raw frontmatter
 * objects, not typed PageMeta — older shapes don't conform to the
 * current Zod schema.
 */
export interface Migration {
  readonly from: number;
  readonly to: number;
  readonly description: string;
  applyMeta(meta: Record<string, unknown>): Record<string, unknown>;
}

/** Thrown when a chain step is missing between two versions. */
export class MissingMigrationError extends Error {
  constructor(public readonly from: number, public readonly to: number) {
    super(`missing migration step from v${from} to v${to}`);
    this.name = 'MissingMigrationError';
  }
}

/**
 * Thrown when a page's schemaVersion is greater than
 * CURRENT_SCHEMA_VERSION. Indicates the running code is older than
 * the data on disk — pull the latest code.
 */
export class FutureSchemaVersionError extends Error {
  constructor(public readonly fromVersion: number, public readonly current: number) {
    super(`schema v${fromVersion} is newer than this build's v${current} — pull the latest code`);
    this.name = 'FutureSchemaVersionError';
  }
}

/**
 * The migration registry. V1 ships empty; future migrations are
 * imported here in numeric order.
 */
export const MIGRATIONS: readonly Migration[] = [
  // e.g. import { Migration001 } from './001-...'; then add it here.
];

/**
 * Apply migrations in order to bring `meta` from `fromVersion` up to
 * `targetVersion` (default: CURRENT_SCHEMA_VERSION). No-op when already
 * at the target.
 *
 * `registry` is exposed for tests; production callers always use the
 * real MIGRATIONS array.
 *
 * Throws FutureSchemaVersionError when fromVersion > targetVersion.
 * Throws MissingMigrationError if a step is missing in the chain.
 */
export function migrate(
  meta: Record<string, unknown>,
  fromVersion: number,
  registry: readonly Migration[] = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  if (fromVersion > targetVersion) {
    throw new FutureSchemaVersionError(fromVersion, targetVersion);
  }
  let current = fromVersion;
  let result = meta;
  while (current < targetVersion) {
    const step = registry.find((m) => m.from === current);
    if (!step) throw new MissingMigrationError(current, current + 1);
    result = step.applyMeta(result);
    current = step.to;
  }
  return { ...result, schemaVersion: targetVersion };
}

/**
 * Walks 1..targetVersion and asserts that the registry has a
 * contiguous step for every transition. Used at module load and in
 * tests to catch broken releases before any page is touched.
 */
export function validateRegistry(
  registry: readonly Migration[],
  targetVersion: number,
): void {
  for (let v = 1; v < targetVersion; v++) {
    if (!registry.find((m) => m.from === v)) {
      throw new MissingMigrationError(v, v + 1);
    }
  }
}

// Module-load self-check. A broken release fails loudly here, not on
// a random page mid-walk.
validateRegistry(MIGRATIONS, CURRENT_SCHEMA_VERSION);
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test test/pages/migrations.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/migrations/index.ts core/test/pages/migrations.test.ts
git commit -m "feat: add page-meta migration registry and composer"
```

---

## Task 3: Add `schemaVersion` to the Zod schema

**Files:**
- Modify: `core/src/pages/schema.ts`
- Modify: `core/test/pages/schema.test.ts`

- [ ] **Step 1: Read the existing schema test to match style**

Run: `cd core && cat test/pages/schema.test.ts | head -40`

(You'll mimic the existing test layout in step 2.)

- [ ] **Step 2: Write a failing test**

Append to `core/test/pages/schema.test.ts`:

```ts
import { CURRENT_SCHEMA_VERSION } from '../../src/pages/migrations/index.ts';
// (add this import next to the existing imports at the top of the file)

test('parsePageMeta defaults missing schemaVersion to CURRENT_SCHEMA_VERSION', () => {
  const out = parsePageMeta({
    title: 'Test',
    owner: 'me',
    editors: [],
    type: 'person',
    aliases: [],
    categories: [],
    created: '2026-05-01',
  });
  assert.equal(out.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('parsePageMeta accepts an explicit schemaVersion', () => {
  const out = parsePageMeta({
    schemaVersion: 1,
    title: 'Test',
    owner: 'me',
    editors: [],
    type: 'person',
    aliases: [],
    categories: [],
    created: '2026-05-01',
  });
  assert.equal(out.schemaVersion, 1);
});

test('parsePageMeta rejects non-integer schemaVersion', () => {
  assert.throws(() =>
    parsePageMeta({
      schemaVersion: 1.5,
      title: 'Test',
      owner: 'me',
      editors: [],
      type: 'person',
      aliases: [],
      categories: [],
      created: '2026-05-01',
    }),
  );
});
```

- [ ] **Step 3: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/schema.test.ts`

Expected: the new tests fail (output type doesn't have `schemaVersion`).

- [ ] **Step 4: Add the field to the Zod schema**

In `core/src/pages/schema.ts`, import `CURRENT_SCHEMA_VERSION` and add the field at the top of the object:

```ts
import { z } from 'zod';
import type { PageMeta } from './types.ts';
import { CURRENT_SCHEMA_VERSION } from './migrations/index.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GedcomRefSchema = z.object({
  file: z.string().min(1),
  record: z.string().regex(/^I\d+$/),
  snapshot: z.string().min(1),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PageMetaSchema: z.ZodType<PageMeta, any, any> = z.object({
  schemaVersion: z.number().int().positive().default(CURRENT_SCHEMA_VERSION),
  title: z.string().min(1),
  owner: z.string().min(1),
  editors: z.array(z.string()),
  type: z.enum(['person', 'family', 'event', 'tree', 'meta']),
  aliases: z.array(z.string()),
  categories: z.array(z.string()),
  gedcom: GedcomRefSchema.optional(),
  portrait: z.string().min(1).optional(),
  created: z.union([
    z.string().regex(ISO_DATE, 'expected YYYY-MM-DD'),
    z.date().transform(d => d.toISOString().slice(0, 10))
  ]),
  deletedAt: z.union([
    z.string(),
    z.date().transform(d => d.toISOString().slice(0, 10))
  ]).optional(),
});

/**
 * Validate a raw frontmatter object against the current PageMeta
 * schema. Callers that read pages from disk must run frontmatter
 * through `migrate(...)` first — the schema describes the current
 * shape only.
 */
export function parsePageMeta(input: unknown): PageMeta {
  return PageMetaSchema.parse(input);
}
```

- [ ] **Step 5: Run tests — expect pass**

Run: `cd core && npx tsx --test test/pages/schema.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add core/src/pages/schema.ts core/test/pages/schema.test.ts
git commit -m "feat: add schemaVersion to page meta zod schema"
```

---

## Task 4: Frontmatter renderer — emit `schemaVersion` + `portrait`, fix drop bug

**Files:**
- Modify: `core/src/pages/frontmatter.ts`
- Modify: `core/test/pages/frontmatter.test.ts`

- [ ] **Step 1: Write a failing round-trip test**

Append to `core/test/pages/frontmatter.test.ts`:

```ts
import { CURRENT_SCHEMA_VERSION } from '../../src/pages/migrations/index.ts';
// (add to the existing import block at the top)

test('serializePage round-trips every PageMeta field including portrait and schemaVersion', () => {
  const page = {
    slug: 'sample',
    meta: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: 'Sample',
      owner: 'me',
      editors: ['a', 'b'],
      type: 'person' as const,
      aliases: ['Sam'],
      categories: ['demo'],
      gedcom: { file: 'tree.ged', record: 'I42', snapshot: 'abc123' },
      portrait: 'sha256:deadbeef',
      created: '2026-05-01',
    },
    body: 'Body text\n',
  };

  const serialized = serializePage(page);
  const round = parsePage(page.slug, serialized);

  assert.deepEqual(round.meta, page.meta);
});

test('serializePage omits portrait when not set (no empty/null emission)', () => {
  const page = {
    slug: 'sample',
    meta: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: 'Sample',
      owner: 'me',
      editors: [],
      type: 'person' as const,
      aliases: [],
      categories: [],
      created: '2026-05-01',
    },
    body: 'x',
  };
  const serialized = serializePage(page);
  assert.ok(!/^portrait:/m.test(serialized), `expected no portrait line, got:\n${serialized}`);
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/frontmatter.test.ts`

Expected: the round-trip test fails because `portrait` and `schemaVersion` are not emitted by the current `renderFrontmatter`.

- [ ] **Step 3: Update the renderer**

In `core/src/pages/frontmatter.ts`, replace `renderFrontmatter` so it emits every field. (Don't touch `parsePage` yet — that's Task 6.)

```ts
function renderFrontmatter(meta: PageMeta): string {
  const lines: string[] = ['---'];
  lines.push(`schemaVersion: ${meta.schemaVersion}`);
  lines.push(`title: ${yamlScalar(meta.title)}`);
  lines.push(`owner: ${meta.owner}`);
  lines.push(`editors: ${flowArray(meta.editors)}`);
  lines.push(`type: ${meta.type}`);
  lines.push(`aliases: ${flowArray(meta.aliases)}`);
  lines.push(`categories: ${flowArray(meta.categories)}`);
  if (meta.gedcom) {
    lines.push('gedcom:');
    lines.push(`  file: ${meta.gedcom.file}`);
    lines.push(`  record: ${meta.gedcom.record}`);
    lines.push(`  snapshot: ${meta.gedcom.snapshot}`);
  }
  if (meta.portrait) lines.push(`portrait: ${yamlScalar(meta.portrait)}`);
  lines.push(`created: ${meta.created}`);
  if (meta.deletedAt) lines.push(`deletedAt: ${yamlScalar(meta.deletedAt)}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test test/pages/frontmatter.test.ts`

Expected: round-trip + omit-portrait tests pass. (The "missing schemaVersion defaults to 1" round-trip will pass after Task 6 — skip if it's not in the test file yet.)

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/frontmatter.ts core/test/pages/frontmatter.test.ts
git commit -m "fix: emit portrait and schemaVersion in page frontmatter renderer"
```

---

## Task 5: Add `peekSchemaVersion` helper

**Files:**
- Modify: `core/src/pages/frontmatter.ts`
- Modify: `core/test/pages/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `core/test/pages/frontmatter.test.ts`:

```ts
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { peekSchemaVersion } from '../../src/pages/frontmatter.ts';
// (extend the existing imports rather than adding duplicate `from 'node:fs'` lines)

test('peekSchemaVersion returns 1 when frontmatter has no schemaVersion', () => {
  const dir = mkdtempSync(join(tmpdir(), 'peek-'));
  const file = join(dir, 'p.md');
  writeFileSync(file, '---\ntitle: x\n---\nbody');
  assert.equal(peekSchemaVersion(file), 1);
});

test('peekSchemaVersion returns the explicit value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'peek-'));
  const file = join(dir, 'p.md');
  writeFileSync(file, '---\nschemaVersion: 7\ntitle: x\n---\nbody');
  assert.equal(peekSchemaVersion(file), 7);
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/frontmatter.test.ts`

Expected: import fails (`peekSchemaVersion` not exported).

- [ ] **Step 3: Implement the helper**

In `core/src/pages/frontmatter.ts`, add the helper after `serializePage`:

```ts
import { readFileSync } from 'node:fs';
// (add this to the imports at the top of the file if not already present)

/**
 * Read just the on-disk schemaVersion of a page file, defaulting to 1
 * when the field is absent. Used by store.write / store.softDelete to
 * enforce the strict-write rule without instantiating a full Page or
 * running Zod validation.
 */
export function peekSchemaVersion(path: string): number {
  const raw = readFileSync(path, 'utf-8');
  const { data } = matter(raw);
  const v = (data as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return v;
  return 1;
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test test/pages/frontmatter.test.ts`

Expected: peek tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/frontmatter.ts core/test/pages/frontmatter.test.ts
git commit -m "feat: add peekSchemaVersion helper"
```

---

## Task 6: `parsePage` owns parse → migrate → validate

**Files:**
- Modify: `core/src/pages/frontmatter.ts`
- Modify: `core/test/pages/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `core/test/pages/frontmatter.test.ts`:

```ts
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from '../../src/pages/migrations/index.ts';
// (extend the existing import block)

test('parsePage defaults missing schemaVersion to CURRENT_SCHEMA_VERSION', () => {
  const raw = `---
title: Sample
owner: me
editors: []
type: person
aliases: []
categories: []
created: 2026-05-01
---
body`;
  const page = parsePage('sample', raw);
  assert.equal(page.meta.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test('parsePage throws FutureSchemaVersionError for too-new pages', () => {
  const raw = `---
schemaVersion: ${CURRENT_SCHEMA_VERSION + 1}
title: Sample
owner: me
editors: []
type: person
aliases: []
categories: []
created: 2026-05-01
---
body`;
  assert.throws(() => parsePage('sample', raw), FutureSchemaVersionError);
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/frontmatter.test.ts`

Expected: the future-version test fails (current `parsePage` ignores `schemaVersion` and never throws).

- [ ] **Step 3: Wire migration into `parsePage`**

In `core/src/pages/frontmatter.ts`, change `parsePage`:

```ts
import { migrate, CURRENT_SCHEMA_VERSION } from './migrations/index.ts';
// (add to imports)

/**
 * Parse a page from raw markdown text. Owns the full read chain:
 *
 *   parse YAML → migrate (no-op when current) → Zod-validate → Page
 *
 * Pages without an on-disk schemaVersion field default to v1 before
 * migration. Throws FutureSchemaVersionError if the page is on a
 * version newer than this build supports.
 */
export function parsePage(slug: string, raw: string): Page {
  const { data, content } = matter(raw);
  const fromVersion = ((data as { schemaVersion?: unknown }).schemaVersion as number | undefined) ?? 1;
  const migrated = migrate(data as Record<string, unknown>, fromVersion);
  const meta: PageMeta = parsePageMeta(migrated);
  return { slug, meta, body: content.trimStart() };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test`

Expected: full `core` suite still passes (parsePage migration is a no-op at V1 since `MIGRATIONS` is empty; behavior changes only for the Future error path).

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/frontmatter.ts core/test/pages/frontmatter.test.ts
git commit -m "feat: parsePage owns migration chain"
```

---

## Task 7: Strict-write peek on `store.write` and `store.softDelete`

**Files:**
- Modify: `core/src/pages/store.ts`
- Modify: `core/test/pages/store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `core/test/pages/store.test.ts`:

```ts
import { writeFileSync } from 'node:fs';
import {
  StaleSchemaVersionError,
} from '../../src/pages/store.ts';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from '../../src/pages/migrations/index.ts';
// (extend the existing import block; do not duplicate)

test('store.write throws StaleSchemaVersionError when on-disk version is below CURRENT', async () => {
  // For V1 (CURRENT === 1) this case can't naturally occur. Skip
  // this assertion when CURRENT === 1; it activates the day a
  // breaking change bumps the version.
  if (CURRENT_SCHEMA_VERSION === 1) return;

  const { store, repoRoot, pagesDir, author } = await makeFixtureStore(); // helper from this test file
  const slug = 'p1';
  // Hand-write a v(CURRENT-1) page on disk
  writeFileSync(`${pagesDir}/${slug}.md`,
    `---\nschemaVersion: ${CURRENT_SCHEMA_VERSION - 1}\ntitle: P\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nbody`);

  await assert.rejects(
    () => store.write(slug, { slug, meta: makeMeta(slug), body: 'b' }, author, 'msg'),
    StaleSchemaVersionError,
  );
});

test('store.write throws FutureSchemaVersionError when on-disk version exceeds CURRENT', async () => {
  const { store, pagesDir, author } = await makeFixtureStore();
  const slug = 'p2';
  writeFileSync(`${pagesDir}/${slug}.md`,
    `---\nschemaVersion: ${CURRENT_SCHEMA_VERSION + 1}\ntitle: P\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nbody`);

  await assert.rejects(
    () => store.write(slug, { slug, meta: makeMeta(slug), body: 'b' }, author, 'msg'),
    FutureSchemaVersionError,
  );
});

test('store.write succeeds when on-disk equals CURRENT', async () => {
  const { store, author } = await makeFixtureStore();
  const slug = 'p3';
  // Create at CURRENT, then overwrite — both writes must succeed
  await store.write(slug, { slug, meta: makeMeta(slug), body: 'b1' }, author, 'create');
  await store.write(slug, { slug, meta: makeMeta(slug), body: 'b2' }, author, 'update');
});

test('store.softDelete throws StaleSchemaVersionError on stale page', async () => {
  if (CURRENT_SCHEMA_VERSION === 1) return;
  const { store, pagesDir, author } = await makeFixtureStore();
  const slug = 'p4';
  writeFileSync(`${pagesDir}/${slug}.md`,
    `---\nschemaVersion: ${CURRENT_SCHEMA_VERSION - 1}\ntitle: P\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nbody`);
  await assert.rejects(() => store.softDelete(slug, author), StaleSchemaVersionError);
});
```

If `makeFixtureStore` and `makeMeta` don't exist in this file, factor them into `core/test/pages/helpers.ts` (the test dir already has `helpers.ts`) — see what's already there and extend rather than duplicate. A minimal `makeFixtureStore` does:

```ts
// in core/test/pages/helpers.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { createPageStore } from '../../src/pages/store.ts';
import { CURRENT_SCHEMA_VERSION } from '../../src/pages/migrations/index.ts';
import type { PageMeta, AuthorIdentity } from '../../src/pages/types.ts';

export async function makeFixtureStore() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'store-'));
  const pagesDir = join(repoRoot, 'pages');
  await import('node:fs').then(({ mkdirSync }) => mkdirSync(pagesDir, { recursive: true }));
  const git = simpleGit(repoRoot);
  await git.init();
  await git.addConfig('user.name', 'Test', false, 'local');
  await git.addConfig('user.email', 'test@example.com', false, 'local');
  await git.commit('init', undefined, { '--allow-empty': null });
  const store = createPageStore({ repoRoot, pagesDir });
  const author: AuthorIdentity = { name: 'Test', email: 'test@example.com' };
  return { store, repoRoot, pagesDir, author };
}

export function makeMeta(slug: string): PageMeta {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: slug,
    owner: 'me',
    editors: [],
    type: 'person',
    aliases: [],
    categories: [],
    created: '2026-05-01',
  };
}
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/store.test.ts`

Expected: future-version test fails (write doesn't peek yet); softDelete stale test would fail when activated; CURRENT-equality test should already pass.

- [ ] **Step 3: Add the peek to `store.write` and `store.softDelete`**

In `core/src/pages/store.ts`, import the helpers and the migrations module:

```ts
import { peekSchemaVersion } from './frontmatter.ts';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from './migrations/index.ts';
```

Add the error class export at the top of the file (above `createPageStore`):

```ts
/**
 * Thrown by store.write / store.softDelete when the on-disk page is
 * at a schemaVersion below CURRENT_SCHEMA_VERSION. Run `wai migrate`
 * to update before retrying the write.
 */
export class StaleSchemaVersionError extends Error {
  constructor(
    public readonly slug: string,
    public readonly onDisk: number,
    public readonly current: number,
  ) {
    super(`page ${slug} on disk is schema v${onDisk}; current is v${current}. run \`wai migrate\`.`);
    this.name = 'StaleSchemaVersionError';
  }
}

function assertPeekSchemaCurrent(slug: string, path: string): void {
  if (!existsSync(path)) return;
  const onDisk = peekSchemaVersion(path);
  if (onDisk < CURRENT_SCHEMA_VERSION) {
    throw new StaleSchemaVersionError(slug, onDisk, CURRENT_SCHEMA_VERSION);
  }
  if (onDisk > CURRENT_SCHEMA_VERSION) {
    throw new FutureSchemaVersionError(onDisk, CURRENT_SCHEMA_VERSION);
  }
}
```

In the `write` method, call the peek before `withLock`:

```ts
async write(slug, page, author, summary) {
  assertValidSlug(slug);
  const target = pathFor(slug);
  assertPeekSchemaCurrent(slug, target);   // ← new
  const tmp = `${target}.tmp`;
  const content = serializePage(page);
  await withLock(slug, async () => {
    // ... rest unchanged
  });
},
```

In the `softDelete` method, call the peek on the source path before reading:

```ts
async softDelete(slug, author) {
  assertValidSlug(slug);
  const src = pathFor(slug);
  if (!existsSync(src)) throw new Error(`page not found: ${slug}`);
  assertPeekSchemaCurrent(slug, src);     // ← new
  const archivedDir = join(cfg.pagesDir, '_archived');
  // ... rest unchanged
},
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test`

Expected: full suite passes.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/store.ts core/test/pages/store.test.ts core/test/pages/helpers.ts
git commit -m "feat: enforce strict schema-version write rule in page store"
```

---

## Task 8: Migrate runner — `runMigrate` boundary module

**Files:**
- Create: `core/src/pages/migrate-runner.ts`
- Create: `core/test/pages/migrate-runner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `core/test/pages/migrate-runner.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import {
  runMigrate,
  MIGRATE_AUTHOR,
  DirtyRepoError,
} from '../../src/pages/migrate-runner.ts';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from '../../src/pages/migrations/index.ts';

async function makeRepo(): Promise<{ repoRoot: string; pagesDir: string }> {
  const repoRoot = mkdtempSync(join(tmpdir(), 'mig-'));
  const pagesDir = join(repoRoot, 'pages');
  mkdirSync(pagesDir, { recursive: true });
  const git = simpleGit(repoRoot);
  await git.init();
  await git.addConfig('user.name', 'Test', false, 'local');
  await git.addConfig('user.email', 'test@example.com', false, 'local');
  await git.commit('init', undefined, { '--allow-empty': null });
  return { repoRoot, pagesDir };
}

function writePage(pagesDir: string, slug: string, schemaVersion: number | null): void {
  const versionLine = schemaVersion === null ? '' : `schemaVersion: ${schemaVersion}\n`;
  writeFileSync(
    join(pagesDir, `${slug}.md`),
    `---\n${versionLine}title: ${slug}\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nbody`,
  );
}

test('runMigrate refuses to run on a dirty repo', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION);
  // Make the repo dirty by leaving the new file uncommitted

  await assert.rejects(
    () => runMigrate({ repoRoot, pagesDir }),
    DirtyRepoError,
  );
});

test('runMigrate with force: true skips the dirty preflight', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION);
  const report = await runMigrate({ repoRoot, pagesDir, force: true });
  assert.equal(report.migrated.length, 0);
  assert.equal(report.skipped.length, 1);
});

test('runMigrate aborts on a future-version page', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION + 1);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  await assert.rejects(
    () => runMigrate({ repoRoot, pagesDir }),
    FutureSchemaVersionError,
  );
});

test('runMigrate skips already-current pages', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'a', CURRENT_SCHEMA_VERSION);
  writePage(pagesDir, 'b', CURRENT_SCHEMA_VERSION);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const report = await runMigrate({ repoRoot, pagesDir });
  assert.equal(report.migrated.length, 0);
  assert.equal(report.failed.length, 0);
  assert.equal(report.skipped.length, 2);
});

test('runMigrate walks _archived/ subdirectory', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  mkdirSync(join(pagesDir, '_archived'), { recursive: true });
  writePage(pagesDir, 'live', CURRENT_SCHEMA_VERSION);
  writeFileSync(
    join(pagesDir, '_archived', 'old.md'),
    `---\nschemaVersion: ${CURRENT_SCHEMA_VERSION}\ntitle: old\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nx`,
  );
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const report = await runMigrate({ repoRoot, pagesDir });
  assert.equal(report.walked, 2, `expected 2 files walked, got ${report.walked}`);
});

test('runMigrate dry-run reports without writing or committing', async () => {
  // V1 ships empty MIGRATIONS, so dry-run on stale isn't reachable
  // in tests today. Document this assertion as a placeholder until
  // the first real migration ships:
  //   when a migration exists, dry-run should report.migrated.length > 0
  //   and yet leave file mtimes and `git log` unchanged.
  // For now, at least exercise the dry-run code path on a current dir:
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const before = statSync(join(pagesDir, 'p.md')).mtimeMs;
  await runMigrate({ repoRoot, pagesDir, dryRun: true });
  const after = statSync(join(pagesDir, 'p.md')).mtimeMs;
  assert.equal(before, after);
});

test('runMigrate respects the page filter', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'a', CURRENT_SCHEMA_VERSION);
  writePage(pagesDir, 'b', CURRENT_SCHEMA_VERSION);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const report = await runMigrate({ repoRoot, pagesDir, page: 'a' });
  assert.equal(report.walked, 1);
  assert.equal(report.skipped[0].slug, 'a');
});
```

(Tests for the actual migrate-and-commit happy path require at least one real migration. Document this in the test file as a comment near the placeholder dry-run test, and wire it in when the first migration is added.)

- [ ] **Step 2: Run tests — expect failures**

Run: `cd core && npx tsx --test test/pages/migrate-runner.test.ts`

Expected: import errors (the runner module doesn't exist yet).

- [ ] **Step 3: Implement the runner**

Create `core/src/pages/migrate-runner.ts`:

```ts
import { readFileSync, writeFileSync, fsyncSync, openSync, closeSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { simpleGit } from 'simple-git';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
  migrate,
} from './migrations/index.ts';
import { parsePageMeta } from './schema.ts';
import { serializePage } from './frontmatter.ts';
import { addAndCommit } from './git.ts';
import type { Page, PageMeta, AuthorIdentity } from './types.ts';

/**
 * Synthetic commit author for migration commits — distinguishes
 * tool-authored schema migrations from user authorship in `git log`.
 */
export const MIGRATE_AUTHOR: AuthorIdentity = {
  name: 'wai migrate',
  email: 'migrate@whoami.local',
};

/** Result of one walk; one entry per file the runner touched. */
export interface MigrateReport {
  walked: number;
  migrated: { slug: string; from: number; to: number }[];
  skipped: { slug: string; version: number }[];
  failed: { slug: string; error: string }[];
}

/**
 * Thrown by runMigrate when the data repo has uncommitted changes
 * and `force: true` was not supplied. The runner does not interleave
 * its commits with in-progress user edits unless explicitly told to.
 */
export class DirtyRepoError extends Error {
  constructor(public readonly repoRoot: string) {
    super(`data repo at ${repoRoot} has uncommitted changes — commit, stash, or rerun with --force`);
    this.name = 'DirtyRepoError';
  }
}

export interface MigrateRunnerOptions {
  repoRoot: string;
  pagesDir: string;
  /** Migrate this slug only; walks both dirs to find it. */
  page?: string;
  /** Compute report without writing. */
  dryRun?: boolean;
  /** Bypass the dirty-repo preflight. */
  force?: boolean;
}

interface WalkedFile {
  absPath: string;
  slug: string;
}

/**
 * Walks pages dir (recursively, picks up `_archived/`), applies any
 * pending migrations, writes each migrated page back atomically and
 * commits it as `chore: migrate <slug> from v<N> to v<M>`.
 *
 * The runner does not enforce the strict-write rule that
 * `store.write` does — that is precisely the rule it must violate.
 * Strict-write callers continue to throw StaleSchemaVersionError
 * until the user runs this.
 */
export async function runMigrate(opts: MigrateRunnerOptions): Promise<MigrateReport> {
  if (!opts.force) {
    const status = await simpleGit(opts.repoRoot).status();
    if (!status.isClean()) throw new DirtyRepoError(opts.repoRoot);
  }

  const files = walk(opts.pagesDir, opts.page);
  const report: MigrateReport = { walked: files.length, migrated: [], skipped: [], failed: [] };

  for (const f of files) {
    const raw = readFileSync(f.absPath, 'utf-8');
    const { data, content } = matter(raw);
    const fromVersion = ((data as { schemaVersion?: unknown }).schemaVersion as number | undefined) ?? 1;

    if (fromVersion > CURRENT_SCHEMA_VERSION) {
      // Whole-run condition: code older than data. Abort; do not
      // touch any files.
      throw new FutureSchemaVersionError(fromVersion, CURRENT_SCHEMA_VERSION);
    }
    if (fromVersion === CURRENT_SCHEMA_VERSION) {
      report.skipped.push({ slug: f.slug, version: fromVersion });
      continue;
    }

    let migratedMeta: PageMeta;
    try {
      const migratedRaw = migrate(data as Record<string, unknown>, fromVersion);
      migratedMeta = parsePageMeta(migratedRaw);
    } catch (err) {
      report.failed.push({
        slug: f.slug,
        error: `migration of ${f.slug} from v${fromVersion} to v${CURRENT_SCHEMA_VERSION} produced invalid frontmatter: ${(err as Error).message}`,
      });
      continue;
    }

    if (opts.dryRun) {
      report.migrated.push({ slug: f.slug, from: fromVersion, to: CURRENT_SCHEMA_VERSION });
      continue;
    }

    try {
      const page: Page = { slug: f.slug, meta: migratedMeta, body: content.trimStart() };
      atomicWrite(f.absPath, serializePage(page));
      await addAndCommit(
        opts.repoRoot,
        [f.absPath],
        MIGRATE_AUTHOR,
        `chore: migrate ${f.slug} from v${fromVersion} to v${CURRENT_SCHEMA_VERSION}`,
      );
      report.migrated.push({ slug: f.slug, from: fromVersion, to: CURRENT_SCHEMA_VERSION });
    } catch (err) {
      report.failed.push({ slug: f.slug, error: (err as Error).message });
    }
  }

  return report;
}

function walk(pagesDir: string, onlySlug?: string): WalkedFile[] {
  const out: WalkedFile[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      const isTalk = entry.name.endsWith('.talk.md');
      const slug = isTalk
        ? entry.name.slice(0, -'.talk.md'.length) + '.talk'
        : entry.name.slice(0, -'.md'.length);
      if (onlySlug && slug !== onlySlug) continue;
      out.push({ absPath: abs, slug });
    }
  };
  visit(pagesDir);
  return out;
}

function atomicWrite(target: string, content: string): void {
  const tmp = `${target}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, target);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd core && npx tsx --test test/pages/migrate-runner.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Update barrel and AGENTS.md**

In `core/src/pages/index.ts`, add:

```ts
export * from './migrations/index.ts';
export * from './migrate-runner.ts';
```

In `core/AGENTS.md`, add a row to the boundary modules table:

```
| `pages/migrate-runner.ts` | Walks pages dir, applies pending migrations, writes + commits per page. |
```

Place it next to `pages/store.ts` and `pages/git.ts` — grep for `pages/git.ts` in the file to find the table.

- [ ] **Step 6: Run full core suite**

Run: `cd core && npm test && npm run typecheck`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add core/src/pages/migrate-runner.ts core/src/pages/index.ts core/test/pages/migrate-runner.test.ts core/AGENTS.md
git commit -m "feat: add migrate-runner boundary module for wai migrate"
```

---

## Task 9: Server-services orchestration — `runMigrateOnDisk`

**Files:**
- Modify: `frontend/lib/server-services.ts`
- Create: `frontend/lib/server-services.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/lib/server-services.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MigrateReport } from '@core/pages/migrate-runner.ts';

// Use a thin wrapper that takes the runner + rebuild as injected
// dependencies so we don't shell out or touch real state.

import {
  orchestrateMigrate,   // ← unit-testable extract from runMigrateOnDisk
} from './server-services';

test('orchestrateMigrate calls rebuildSearchIndex when migrated.length > 0', async () => {
  let rebuilds = 0;
  const fakeRunner = async (): Promise<MigrateReport> => ({
    walked: 1,
    migrated: [{ slug: 'p', from: 1, to: 2 }],
    skipped: [],
    failed: [],
  });
  const fakeRebuild = async () => { rebuilds++; };
  const report = await orchestrateMigrate(
    { repoRoot: '/', pagesDir: '/p' },
    fakeRunner,
    fakeRebuild,
  );
  assert.equal(rebuilds, 1);
  assert.equal(report.migrated.length, 1);
});

test('orchestrateMigrate does not rebuild when zero pages migrated', async () => {
  let rebuilds = 0;
  const fakeRunner = async (): Promise<MigrateReport> => ({
    walked: 0, migrated: [], skipped: [], failed: [],
  });
  await orchestrateMigrate({ repoRoot: '/', pagesDir: '/p' }, fakeRunner, async () => { rebuilds++; });
  assert.equal(rebuilds, 0);
});

test('orchestrateMigrate does not rebuild on dryRun even with migrated entries', async () => {
  let rebuilds = 0;
  const fakeRunner = async (): Promise<MigrateReport> => ({
    walked: 1,
    migrated: [{ slug: 'p', from: 1, to: 2 }],
    skipped: [],
    failed: [],
  });
  await orchestrateMigrate(
    { repoRoot: '/', pagesDir: '/p', dryRun: true },
    fakeRunner,
    async () => { rebuilds++; },
  );
  assert.equal(rebuilds, 0);
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd frontend && npx tsx --test lib/server-services.test.ts`

Expected: import error (`orchestrateMigrate` doesn't exist).

- [ ] **Step 3: Add the orchestration to `server-services.ts`**

In `frontend/lib/server-services.ts`, add near the rebuild-search exports:

```ts
import { runMigrate, type MigrateRunnerOptions, type MigrateReport } from '@core/pages/migrate-runner.ts';
// (extend imports)

/**
 * Pure orchestration: run the migrate runner, then trigger the
 * rebuild only when at least one page was actually migrated and we
 * are not in dry-run. Pulled out for unit testing without touching
 * real disk or the real rebuild path.
 */
export async function orchestrateMigrate(
  opts: MigrateRunnerOptions,
  runner: (o: MigrateRunnerOptions) => Promise<MigrateReport>,
  rebuild: () => Promise<unknown>,
): Promise<MigrateReport> {
  const report = await runner(opts);
  if (!opts.dryRun && report.migrated.length > 0) {
    await rebuild();
  }
  return report;
}

/**
 * Server-side wrapper that wires runMigrate to the real
 * rebuildSearchIndexFromDisk and the real WHOAMI_ROOT / PAGES_DIR.
 */
export async function runMigrateOnDisk(
  opts: Pick<MigrateRunnerOptions, 'page' | 'dryRun' | 'force'>,
): Promise<MigrateReport> {
  return orchestrateMigrate(
    { repoRoot: WHOAMI_ROOT, pagesDir: PAGES_DIR, ...opts },
    runMigrate,
    rebuildSearchIndexFromDisk,
  );
}
```

(Confirm `rebuildSearchIndexFromDisk` is exported from this file — it already is per the existing usage.)

- [ ] **Step 4: Run tests — expect pass**

Run: `cd frontend && npx tsx --test lib/server-services.test.ts`

Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/server-services.ts frontend/lib/server-services.test.ts
git commit -m "feat: add runMigrateOnDisk orchestration to server-services"
```

---

## Task 10: API route — `POST /api/migrate`

**Files:**
- Create: `frontend/app/api/migrate/route.ts`

- [ ] **Step 1: Read an existing API route for the pattern**

Run: `cat /Users/nyetwork/dev/whoami/frontend/app/api/search/rebuild/route.ts`

Expected: `POST` handler that calls a `server-services` function and returns JSON.

- [ ] **Step 2: Write the route**

Create `frontend/app/api/migrate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { runMigrateOnDisk } from '@/lib/server-services';
import { DirtyRepoError } from '@core/pages/migrate-runner.ts';
import { FutureSchemaVersionError } from '@core/pages/migrations/index.ts';

interface MigrateRequest {
  page?: string;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * POST /api/migrate — invokes the migration runner on the configured
 * data repo. Body shape: { page?, dryRun?, force? }. Returns the
 * MigrateReport on success; HTTP 409 with `error: "dirty-repo"` when
 * the repo has uncommitted changes and `force` is false; HTTP 409
 * with `error: "future-schema-version"` when the data is ahead of
 * this build.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: MigrateRequest = {};
  try {
    body = (await req.json()) as MigrateRequest;
  } catch {
    /* allow empty body */
  }
  try {
    const report = await runMigrateOnDisk({
      page: body.page,
      dryRun: !!body.dryRun,
      force: !!body.force,
    });
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof DirtyRepoError) {
      return NextResponse.json(
        { error: 'dirty-repo', detail: err.message },
        { status: 409 },
      );
    }
    if (err instanceof FutureSchemaVersionError) {
      return NextResponse.json(
        { error: 'future-schema-version', detail: err.message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'migrate-failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run typecheck`

Expected: passes. (No dedicated test for the route — the orchestration is covered in Task 9; the route is a thin translation layer.)

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/migrate/route.ts
git commit -m "feat: add POST /api/migrate route"
```

---

## Task 11: API write route — return 409 for stale/future schema-version + fix `defaultMeta`

**Files:**
- Modify: `frontend/app/api/pages/[slug]/route.ts`

The existing `PUT` handler has a try/catch at `route.ts:65-69` that maps any error to a generic `write-failed` 500. The `DELETE` handler has the same shape at `route.ts:84-88`. Both need extending. The same file also has a `defaultMeta(slug)` helper at `route.ts:15-25` that constructs a `PageMeta` for new-page upserts — once `schemaVersion` becomes required on `PageMeta`, that helper won't typecheck.

- [ ] **Step 1: Add the imports**

At the top of `frontend/app/api/pages/[slug]/route.ts`, add:

```ts
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from '@core/pages/migrations/index.ts';
import { StaleSchemaVersionError } from '@core/pages/store.ts';
```

- [ ] **Step 2: Fix `defaultMeta` to set `schemaVersion`**

Update `defaultMeta` (currently `route.ts:15-25`) so the new required field is populated:

```ts
function defaultMeta(slug: string): PageMeta {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: titleCaseFromSlug(slug),
    owner: DEFAULT_AUTHOR.name,
    editors: [],
    type: 'meta',
    aliases: [],
    categories: [],
    created: new Date().toISOString().slice(0, 10),
  };
}
```

- [ ] **Step 3: Extend the `PUT` catch block**

Replace the catch block currently at `route.ts:67-69`:

```ts
} catch (err) {
  if (err instanceof StaleSchemaVersionError) {
    return NextResponse.json(
      { error: 'stale-schema-version', slug: err.slug, onDisk: err.onDisk, current: err.current },
      { status: 409 },
    );
  }
  if (err instanceof FutureSchemaVersionError) {
    return NextResponse.json(
      { error: 'future-schema-version', detail: err.message },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: 'write-failed', detail: (err as Error).message }, { status: 500 });
}
```

- [ ] **Step 4: Extend the `DELETE` catch block**

Replace the catch block currently at `route.ts:86-88` with the same shape, but using `delete-failed` for the unknown fallback to match the existing string:

```ts
} catch (err) {
  if (err instanceof StaleSchemaVersionError) {
    return NextResponse.json(
      { error: 'stale-schema-version', slug: err.slug, onDisk: err.onDisk, current: err.current },
      { status: 409 },
    );
  }
  if (err instanceof FutureSchemaVersionError) {
    return NextResponse.json(
      { error: 'future-schema-version', detail: err.message },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: 'delete-failed', detail: (err as Error).message }, { status: 500 });
}
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run typecheck`

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add 'frontend/app/api/pages/[slug]/route.ts'
git commit -m "feat: surface schema-version write errors as 409 in pages api"
```

---

## Task 12: CLI — `api-client.ts` adds `migrate(opts)`

**Files:**
- Modify: `cli/src/api-client.ts`
- Modify: `cli/test/api-client.test.ts`

- [ ] **Step 1: Write a failing test**

The existing `cli/test/api-client.test.ts` uses a `withServer(handler, fn)` helper that spins up a real `node:http` server bound to a random port. Use the same harness — do NOT introduce a new fetch-mocking style.

Append to `cli/test/api-client.test.ts`:

```ts
test('ApiClient.migrate POSTs to /api/migrate with the body', async () => {
  let receivedUrl = '';
  let receivedMethod = '';
  let receivedBody = '';
  await withServer(
    (req, res) => {
      receivedUrl = req.url ?? '';
      receivedMethod = req.method ?? '';
      let chunks = '';
      req.on('data', (c: Buffer) => { chunks += c.toString(); });
      req.on('end', () => {
        receivedBody = chunks;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ walked: 0, migrated: [], skipped: [], failed: [] }));
      });
    },
    async (base) => {
      const client = new ApiClient(base);
      const report = await client.migrate({ dryRun: true });
      assert.equal(report.walked, 0);
      assert.equal(receivedUrl, '/api/migrate');
      assert.equal(receivedMethod, 'POST');
      assert.deepEqual(JSON.parse(receivedBody), { dryRun: true });
    },
  );
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd cli && npx tsx --test test/api-client.test.ts`

Expected: import error (`migrate` is not on `ApiClient`).

- [ ] **Step 3: Add the method and types**

In `cli/src/api-client.ts`, add the report types near the top (next to the other type exports):

```ts
/** Mirror of core's MigrateReport — the wire format. */
export interface MigrateReport {
  walked: number;
  migrated: { slug: string; from: number; to: number }[];
  skipped: { slug: string; version: number }[];
  failed: { slug: string; error: string }[];
}

export interface MigrateOptions {
  page?: string;
  dryRun?: boolean;
  force?: boolean;
}
```

Inside the `ApiClient` class, add the method:

```ts
/**
 * Trigger a migration walk on the server.
 *
 * The server returns 409 with `error: "dirty-repo"` if the data
 * repo is dirty (rerun with `force: true` after committing or
 * stashing); 409 with `error: "future-schema-version"` if the data
 * is ahead of the running build.
 */
async migrate(opts: MigrateOptions = {}): Promise<MigrateReport> {
  return this.json<MigrateReport>('POST', '/api/migrate', opts);
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `cd cli && npx tsx --test test/api-client.test.ts`

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add cli/src/api-client.ts cli/test/api-client.test.ts
git commit -m "feat: add migrate method to wai api client"
```

---

## Task 13: CLI command — `wai migrate`

**Files:**
- Create: `cli/src/commands/migrate.ts`
- Modify: `cli/src/index.ts`
- Create: `cli/test/migrate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `cli/test/migrate.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMigrate, type MigrateRunnerCli } from '../src/commands/migrate.js';
import type { MigrateReport } from '../src/api-client.js';

function makeFakeClient(report: MigrateReport): { migrate: () => Promise<MigrateReport> } {
  return { migrate: async () => report };
}

test('runMigrate prints summary for happy path', async () => {
  const out: string[] = [];
  const opts: MigrateRunnerCli = {
    client: makeFakeClient({
      walked: 3,
      migrated: [{ slug: 'a', from: 1, to: 2 }],
      skipped: [{ slug: 'b', version: 2 }, { slug: 'c', version: 2 }],
      failed: [],
    }),
    write: (s) => out.push(s),
    json: false,
    dryRun: false,
    force: false,
  };
  const code = await runMigrate(opts);
  assert.equal(code, 0);
  const printed = out.join('');
  assert.match(printed, /walked 3/);
  assert.match(printed, /migrated 1/);
  assert.match(printed, /skipped 2/);
});

test('runMigrate exits non-zero on per-page failures', async () => {
  const out: string[] = [];
  const code = await runMigrate({
    client: makeFakeClient({
      walked: 1, migrated: [], skipped: [],
      failed: [{ slug: 'x', error: 'boom' }],
    }),
    write: (s) => out.push(s),
    json: false, dryRun: false, force: false,
  });
  assert.equal(code, 2);
});

test('runMigrate --json prints the raw report', async () => {
  const out: string[] = [];
  const report: MigrateReport = { walked: 0, migrated: [], skipped: [], failed: [] };
  await runMigrate({
    client: makeFakeClient(report),
    write: (s) => out.push(s),
    json: true, dryRun: false, force: false,
  });
  const parsed = JSON.parse(out.join(''));
  assert.deepEqual(parsed, report);
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `cd cli && npx tsx --test test/migrate.test.ts`

Expected: import errors (file doesn't exist yet).

- [ ] **Step 3: Implement the command**

Create `cli/src/commands/migrate.ts`:

```ts
import type { ApiClient, MigrateReport } from '../api-client.js';
import { ApiError } from '../api-client.js';

/** Inputs for the migrate command runner — exposed for testing. */
export interface MigrateRunnerCli {
  client: Pick<ApiClient, 'migrate'>;
  write: (s: string) => void;
  page?: string;
  dryRun: boolean;
  force: boolean;
  json: boolean;
}

/**
 * Run the migrate CLI subcommand. Returns the desired process exit
 * code: 0 on success, 2 on per-page failures, 3 on dirty-repo refusal.
 */
export async function runMigrate(opts: MigrateRunnerCli): Promise<number> {
  let report: MigrateReport;
  try {
    report = await opts.client.migrate({
      page: opts.page,
      dryRun: opts.dryRun,
      force: opts.force,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.detail?.includes('dirty-repo')) {
      opts.write(`error: data repo has uncommitted changes — commit, stash, or rerun with --force\n`);
      return 3;
    }
    if (err instanceof ApiError) {
      opts.write(`error: ${err.message}\n`);
      return 2;
    }
    opts.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  if (opts.json) {
    opts.write(JSON.stringify(report));
    return report.failed.length > 0 ? 2 : 0;
  }

  opts.write(
    `walked ${report.walked}, migrated ${report.migrated.length}, skipped ${report.skipped.length}, failed ${report.failed.length}\n`,
  );
  for (const m of report.migrated) {
    opts.write(`  migrated ${m.slug} v${m.from} → v${m.to}\n`);
  }
  for (const f of report.failed) {
    opts.write(`  failed   ${f.slug}: ${f.error}\n`);
  }
  return report.failed.length > 0 ? 2 : 0;
}
```

(The exact `err.detail` check above depends on the body shape of 409 responses from the API client; cross-check against `api-client.ts`'s `json` private method, which extracts `parsed.error` into `detail`. If the `dirty-repo` discriminator isn't in `detail`, switch to inspecting the raw response. Adjust the test in step 1 accordingly if needed.)

- [ ] **Step 4: Run tests — expect pass**

Run: `cd cli && npx tsx --test test/migrate.test.ts`

Expected: all three tests pass.

- [ ] **Step 5: Wire into `cli/src/index.ts`**

`cli/src/index.ts` uses a `parseArgs(argv)` returning `{cmd, positional, flags}` and a `switch (args.cmd)` in `main()`. Existing commands like `rebuild-search` show the integration pattern.

Add the import alongside the others:

```ts
import { runMigrate } from './commands/migrate.js';
```

Inside the `switch (args.cmd)` block (next to the existing `case 'rebuild-search'`), add:

```ts
case 'migrate': {
  const code = await runMigrate({
    client,
    write,
    page: typeof args.flags.page === 'string' ? args.flags.page : undefined,
    dryRun: !!args.flags['dry-run'],
    force: !!args.flags.force,
    json: !!args.flags.json,
  });
  return code;
}
```

`runMigrate` returns the desired exit code; the surrounding `main()` already does `process.exit(code)` at the bottom.

In the `HELP` constant, add a line under the "Search:" section near `rebuild-search`:

```
Migrations:
  migrate [--dry-run] [--page <slug>] [--force]
                              Apply pending schema migrations to all pages.
                              Use after pulling a code update that bumps
                              CURRENT_SCHEMA_VERSION.
```

- [ ] **Step 6: Build smoke**

Run: `cd cli && npm run build && node dist/wai.cjs migrate --help 2>&1 | head -5`

Expected: help text shown without error.

- [ ] **Step 7: Commit**

```bash
git add cli/src/commands/migrate.ts cli/src/index.ts cli/test/migrate.test.ts
git commit -m "feat: add wai migrate command"
```

---

## Task 14: Manual end-to-end smoke

**Files:** none (manual procedure)

This task is a sanity check, not committed code. It exercises the full path against the user's real `~/whoami` once with a synthetic migration, then reverts.

- [ ] **Step 1: Add a synthetic v1→v2 migration locally — DO NOT COMMIT**

Create `core/src/pages/migrations/002-test-no-op.ts`:

```ts
import type { Migration } from './index.ts';

export const Migration002: Migration = {
  from: 1,
  to: 2,
  description: 'test-only no-op',
  applyMeta: (m) => ({ ...m }),
};
```

Edit `core/src/pages/migrations/index.ts` temporarily:
- Bump `CURRENT_SCHEMA_VERSION` to `2`.
- Import and register `Migration002` in `MIGRATIONS`.

- [ ] **Step 2: Build and run dry-run**

```bash
cd cli && npm run build
node /Users/nyetwork/dev/whoami/cli/dist/wai.cjs migrate --dry-run
```

Expected: report shows ~107 pages migrated v1 → v2 (count matches `~/whoami/pages/`); `git status` in `~/whoami` is unchanged.

- [ ] **Step 3: Run for real**

```bash
node /Users/nyetwork/dev/whoami/cli/dist/wai.cjs migrate
```

Expected: same migrated count; `git log --oneline | head -10` in `~/whoami` shows fresh `chore: migrate <slug> from v1 to v2` commits authored by `wai migrate <migrate@whoami.local>`.

- [ ] **Step 4: Verify the wiki still renders**

Open the frontend in a browser; spot-check 3-4 pages including a person page, family page, and an archived page (via direct slug if possible).

Expected: pages render normally.

- [ ] **Step 5: Revert the synthetic migration**

```bash
cd /Users/nyetwork/whoami
git log --oneline | head -120  # find first migrate commit
git reset --hard <commit-before-first-migrate>
```

(Verify with the user before running the reset; this is destructive on the data repo. Ask them what to revert to and run it together.)

In the code repo, delete `core/src/pages/migrations/002-test-no-op.ts` and revert the `CURRENT_SCHEMA_VERSION = 2` bump back to 1. Do **not** commit these reverts — the working tree should be clean.

- [ ] **Step 6: Final clean state check**

```bash
cd /Users/nyetwork/dev/whoami && git status
cd /Users/nyetwork/whoami && git status
```

Expected: both clean (or only intentional unrelated changes in the data repo).

---

## Verification

- [ ] **Run the full test suite**

```bash
cd /Users/nyetwork/dev/whoami/core && npm test && npm run typecheck
cd /Users/nyetwork/dev/whoami/cli && npm test && npm run typecheck
cd /Users/nyetwork/dev/whoami/frontend && npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Confirm spec coverage**

Re-read `docs/superpowers/specs/2026-05-04-schema-migrations-design.md` and check each section against committed code. Anything missing → file a follow-up.

- [ ] **Update plan status**

Mark this plan as shipped in any roadmap doc (per the project convention of "update the roadmap entry when each plan ships").

---

## Out of scope (deferred per spec)

- `applyBody?` hook on `Migration` — added when first body-touching migration appears.
- Per-page `migrationHistory` log in frontmatter — git history covers it.
- GEDCOM-derived YAML versioning — handled by `wai sync-gedcom` re-derive.

## References

- Spec: `docs/superpowers/specs/2026-05-04-schema-migrations-design.md`
- Original sketch: `docs/superpowers/plans/2026-05-03-schema-migrations.md`
- Audit finding: `~/.claude/plans/do-an-architecture-audit-partitioned-cherny.md` Severity 5.1
