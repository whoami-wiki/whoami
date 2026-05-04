# User-data schema migrations — design

> **Status:** approved design, ready for plan. Successor to the deferred sketch at `docs/superpowers/plans/2026-05-03-schema-migrations.md`.

## Context

Every field added to `PageMeta` so far has been optional, so existing
pages without the field still validate. That's a one-trick fix: the
moment a field becomes required, gets renamed, or moves to a different
shape, every existing page in `~/whoami/pages/` becomes invalid against
the new schema with no migration path.

The architecture audit (`do-an-architecture-audit-partitioned-cherny.md`,
Severity 5.1) flagged this as a contract gap. This design closes it.

**Scope: pure infrastructure.** V1 ships the schema-version field, the
migration registry, the read/write boundary changes, the `wai migrate`
runner, and a frontmatter-serializer fidelity fix — but **zero
migrations**. The first real migration ships when whoever needs it
next adds it.

## Strategic decisions

These were settled during brainstorming and frame everything below.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Hybrid: lenient read, strict write** | Wiki must keep rendering after `git pull`; explicit step required before persisting any write that would silently bump the on-disk version. Avoids both "it broke after upgrade" and "writes silently erased schemaVersion drift before migrate ever saw it." |
| 2 | **`wai migrate` walks all pages, including `_archived/`** | Archived pages are still in git, still recoverable. A future undelete should not silently fail validation. |
| 3 | **Missing `schemaVersion` in frontmatter defaults to `1`** | Zero-touch rollout. Existing pages keep working; explicit `schemaVersion` gets written into frontmatter on next save. |
| 4 | **YAGNI batch — out of V1:** `applyBody?` hook on `Migration`; per-page `migrationHistory` log in frontmatter; GEDCOM-derived YAML versioning | Each is easy to add the day a real case needs it; not worth carrying speculative surface area now. Git history covers the per-page log; `.ged` is the source of truth for derived YAML. |
| 5 | **Auto-trigger search index rebuild after `wai migrate` writes** | Migrations are exactly the kind of direct-edit-to-`pages/` that the existing rebuild contract requires. Skip the rebuild if zero pages migrated. |
| 6 | **Fix the `frontmatter.ts` `portrait`-drop bug as part of this work** | The migration runner round-trips every page through `parsePage` → mutate → `serializePage`. Any field the serializer drops gets destroyed on migrate. Serializer fidelity is a correctness precondition, not unrelated cleanup. |

## Architecture

Three layers, each with a single responsibility.

### Pure: migration definitions

`core/src/pages/migrations/`

- One file per migration: `001-<name>.ts`, `002-<name>.ts`, etc.
  V1 ships **no** migration files.
- `index.ts` is the registry: explicit imports (no auto-discovery),
  exposes `CURRENT_SCHEMA_VERSION`, the `Migration` interface, and a
  `migrate(meta, fromVersion)` composer that applies the chain.
- Pure functions only. No I/O. Testable with synthetic input.

### Boundary: read-time migration in the store

`core/src/pages/store.ts`

- `store.read()` parses the page, calls `migrate(meta, meta.schemaVersion)`
  to bring it up to `CURRENT_SCHEMA_VERSION` in memory, returns the
  migrated `Page`. The on-disk file is **not** touched.
- `store.write()` reads the existing on-disk file's `schemaVersion`
  (if any). If it is stale (`< CURRENT`), throws
  `StaleSchemaVersionError`. New pages (no existing file) skip the
  check.
- `store.migrateWrite()` — new method, the only path that may persist
  to a stale-version file. Used exclusively by the `wai migrate` runner.
- `parsePage` / `frontmatter.ts` stay version-naive. Schema awareness
  lives in the store, not the parser.

### Persist path: the CLI

`cli/src/commands/migrate.ts`

```
wai migrate              # walk all pages, apply pending migrations
wai migrate --dry-run    # print plan, no writes
wai migrate --page <slug># single-page migrate (also works with --dry-run)
```

- Walks `pages/*.md` and `pages/_archived/*.md`.
- For each file: parse, get current `schemaVersion` (default 1 if
  absent), apply chain, write back via `store.migrateWrite`, commit
  `chore: migrate <slug> from v<N> to v<M>`.
- Idempotent: skips files already at `CURRENT`.
- After the walk, if any writes happened, calls the existing
  rebuild-search runner.
- Per-page errors are caught and logged; one bad page does not block
  the rest. Exit code is non-zero if any page failed.

### Frontend integration

The frontend's API write route catches `StaleSchemaVersionError` and
returns HTTP 409 with `{ error: "stale-schema-version", slug, onDisk, current }`.
The editor renders a banner: *"This page is on schema vN; the code
expects vM. Run `wai migrate` to update."*

`FutureSchemaVersionError` (data ahead of code) renders as an error
page: *"This page was written by a newer version of the wiki. Pull
the latest code to read it."*

## Data flow

### Read

```
file on disk (vN)
  → parsePage()           // YAML → Record<string, unknown>
  → fromVersion = raw.schemaVersion ?? 1   // ← explicit default
  → migrate(meta, fromVersion)             // returns vCURRENT (no-op if equal)
  → parsePageMeta()       // Zod-validates the FINAL shape
  → Page { meta, body }   // returned to caller
```

Validation happens **after** migration. The Zod schema describes the
current shape only; older shapes are not Zod-typed — migrations
operate on `Record<string, unknown>` and we trust git history for
what the old shape looked like.

**Two defaults at two layers.** The read flow above does an explicit
`?? 1` *before* calling `migrate` — that is the rule for old pages on
disk. The Zod schema additionally has `.default(CURRENT_SCHEMA_VERSION)`
for *post-migration / new-page construction* contexts (e.g. a Page
object built in code with no `schemaVersion` set, then written). These
two defaults are not interchangeable: if the Zod default fired before
`migrate`, it would skip the chain on any v0 page in a build where
`CURRENT > 1`.

### Write

```
store.write(slug, page, ...)
  → if file exists, peekSchemaVersion(path)
  → if onDisk < CURRENT → throw StaleSchemaVersionError
  → otherwise serialize, fsync, rename, git commit
```

**`peekSchemaVersion(path)`** is a small helper in
`core/src/pages/frontmatter.ts`: read the file, run `gray-matter` to
extract just the frontmatter, return `data.schemaVersion ?? 1` as a
number. It does not instantiate a `Page` and does not run Zod. Cheap
(single small file read, no body parse), and the caller is about to
overwrite the file anyway. New-page writes (file doesn't exist) skip
the peek entirely.

`store.write` and `store.migrateWrite` reuse the same atomic
write-tmp / rename / commit / restore-on-commit-failure pattern that
`store.write` uses today. A failure mid-write leaves the prior
on-disk content intact.

### `wai migrate`

```
for each *.md under pages/ (recursive, includes _archived/):
  read raw text
  parse frontmatter, default missing schemaVersion → 1
  if version > CURRENT → throw FutureSchemaVersionError, abort run
  if version === CURRENT → skip
  if --dry-run → log "would migrate <slug> v<N>→v<CURRENT>"
  else →
    apply chain → migrated meta
    store.migrateWrite(...) with author "wai migrate <noreply@...>"
    commit "chore: migrate <slug> from v<N> to v<M>"
after loop: if any writes → run rebuild-search
exit 0 on full success, 2 if any per-page failure
```

## Components and interfaces

### New files

```
core/src/pages/migrations/
└── index.ts          # CURRENT_SCHEMA_VERSION, Migration interface, migrate()
                      # V1 ships an empty MIGRATIONS array

cli/src/commands/migrate.ts   # wai migrate runner
```

### Modified files

```
core/src/pages/types.ts        # add schemaVersion: number to PageMeta
core/src/pages/schema.ts       # add schemaVersion to Zod, default to CURRENT_SCHEMA_VERSION
core/src/pages/frontmatter.ts  # render schemaVersion + portrait (fixes drop bug); add peekSchemaVersion()
core/src/pages/store.ts        # read-time migrate, strict write, migrateWrite, error class
cli/src/index.ts               # register the migrate command
```

### `core/src/pages/migrations/index.ts` — public surface

```ts
/**
 * The schema version this build of the code understands.
 * Bump this and add a Migration entry whenever PageMeta gets a
 * breaking change (rename, type change, removal, required field).
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * One step in the migration chain. Operates on raw frontmatter
 * objects, not typed PageMeta — older shapes don't conform.
 */
export interface Migration {
  readonly from: number;
  readonly to: number;
  readonly description: string;
  applyMeta(meta: Record<string, unknown>): Record<string, unknown>;
}

/** Thrown when the chain is missing a step between two versions. */
export class MissingMigrationError extends Error { /* ... */ }

/** Thrown when a page's schemaVersion is greater than CURRENT_SCHEMA_VERSION. */
export class FutureSchemaVersionError extends Error { /* ... */ }

/**
 * Apply migrations in order to bring a frontmatter object from
 * `fromVersion` up to CURRENT_SCHEMA_VERSION. No-op when already current.
 * Throws FutureSchemaVersionError when fromVersion > CURRENT_SCHEMA_VERSION.
 * Throws MissingMigrationError if a step is missing in the chain.
 *
 * `registry` is exposed for tests; production callers always use the
 * real MIGRATIONS array (the default).
 */
export function migrate(
  meta: Record<string, unknown>,
  fromVersion: number,
  registry?: readonly Migration[],
): Record<string, unknown>;
```

The registry runs a **module-load self-check** (one assertion at the
bottom of `index.ts` that runs the moment the module is imported):
walks `1..CURRENT_SCHEMA_VERSION`, asserts every step exists. A broken
release throws at startup rather than on a random page mid-walk.

### `core/src/pages/store.ts` — added surface

```ts
export interface PageStore {
  read(slug: string): Promise<Page>;
  write(slug: string, page: Page, author: AuthorIdentity, summary: string): Promise<void>;
  /**
   * Persist a migrated page. Bypasses the stale-version check that
   * `write` enforces — used only by `wai migrate`.
   */
  migrateWrite(slug: string, page: Page, author: AuthorIdentity, summary: string): Promise<void>;
  list(): Promise<PageMetaSummary[]>;
  history(slug: string, limit?: number): Promise<Revision[]>;
  softDelete(slug: string, author: AuthorIdentity): Promise<void>;
}

/** Thrown by store.write when on-disk schemaVersion is older than CURRENT. */
export class StaleSchemaVersionError extends Error {
  constructor(
    public readonly slug: string,
    public readonly onDisk: number,
    public readonly current: number,
  );
}
```

### Schema change — `PageMeta` and Zod

```ts
// types.ts
export interface PageMeta {
  schemaVersion: number;   // always present after parse
  title: string;
  // ... rest unchanged
}

// schema.ts — fragment
const PageMetaSchema = z.object({
  schemaVersion: z
    .number()
    .int()
    .positive()
    .default(CURRENT_SCHEMA_VERSION),
  // ... rest unchanged
});
```

The Zod `.default(CURRENT_SCHEMA_VERSION)` covers the missing-field case
at the type level. Combined with read-time migration, every `Page`
returned from `store.read` has `schemaVersion === CURRENT_SCHEMA_VERSION`.

## Error handling

| Condition | Read path | Write path | CLI |
|-----------|-----------|------------|-----|
| On-disk older than CURRENT | Migrate transparently in memory; no error. | Throw `StaleSchemaVersionError`; API returns 409; editor shows banner with `wai migrate` instruction. | `wai write`: print error, exit 2. `wai migrate`: applies the migration. |
| On-disk newer than CURRENT | Throw `FutureSchemaVersionError`; frontend renders "code is out of date — pull latest" page. | Same error class; editor refuses to save. | Both `wai write` and `wai migrate` refuse to operate. |
| Missing step in chain | `MissingMigrationError` from registry self-check at first call (fails fast at startup). | Same. | Same. |
| Migration function throws on a specific page | Error propagates; frontend renders "page failed to load" with slug + message. | Same. | `wai migrate`: caught per-page, logged, walk continues; non-zero exit at end. |

**Backout:** every successful `wai migrate` step is its own git commit,
so `git revert` on offending commits restores prior state. No special
revert tool needed.

## Testing

### Pure layer — `core/test/pages/migrations.test.ts`

- `migrate()` no-op when `from === CURRENT`
- `migrate()` throws `FutureSchemaVersionError` when `from > CURRENT`
- empty registry path (V1 ships this state)
- happy chain with a synthetic `1→2, 2→3` registry passed via the
  `migrate(meta, fromVersion, registry)` third-arg test injection
  point, so the test does not depend on the real `MIGRATIONS` array
- missing-step detection: synthetic registry with a gap, asserts
  `MissingMigrationError`
- registry self-check: asserts `1..CURRENT_SCHEMA_VERSION` is
  contiguous against the **real** registry

### Boundary layer — extend `core/test/pages/store.test.ts`

- `read()` returns a `Page` with `schemaVersion === CURRENT` even when
  the file on disk has no `schemaVersion` field
- `read()` returns migrated meta when the registry has migrations
  (test against an injected stub registry)
- `read()` re-throws `FutureSchemaVersionError` from a future-version file
- `write()` throws `StaleSchemaVersionError` when on-disk is at a
  lower version than the `Page` being written
- `write()` succeeds when on-disk and incoming both equal `CURRENT`
- `migrateWrite()` succeeds when on-disk is stale
- `migrateWrite()` does not bypass any check other than the
  stale-version one (e.g. still validates slug, still locks)

### Frontmatter renderer — `core/test/pages/frontmatter.test.ts` (new)

- **Round-trip property test:** for every field in a fully-populated
  `PageMeta` (including `portrait` and `schemaVersion`),
  `parsePage(serializePage(p)).meta` deep-equals `p.meta`. This is the
  regression net for the `portrait`-drop bug and the structural guard
  for any new field.
- Missing `schemaVersion` round-trips to `1`.
- Missing `portrait` stays absent.

### CLI runner — `cli/test/commands/migrate.test.ts` (new)

- dry-run prints plan and writes nothing (verify with mtime / `git status`)
- real run on a fixture pages dir with one stale file: writes correct
  migrated content, creates the expected `chore: migrate` commit,
  calls rebuild-search exactly once
- real run on an all-current dir: zero writes, zero commits, zero
  rebuild-search calls
- `--page <slug>` migrates only that file
- per-file error in one page does not block migration of others; exit
  code is non-zero
- Fixtures use a tmp dir + `git init` so commits work without touching
  real `~/whoami`.

### End-to-end smoke (manual, not committed)

Add a synthetic v1→v2 migration locally (do not commit it). Run:

```
wai migrate --dry-run    # against real ~/whoami/pages/
wai migrate              # apply
```

Then verify the wiki still renders in the frontend and `git log` looks
clean. Remove the synthetic migration before merging.

## Documentation comments

Per user direction, exported types and functions in this work get JSDoc
comments. The shapes shown in this spec already include them — the
implementation should preserve that style. Internal helpers do not need
doc comments unless the WHY is non-obvious.

## Open items deferred to first real migration

Carry-overs from the original sketch, intentionally not solved by V1:

- **Body-touching migrations** — the `applyBody?` hook lands when a
  case actually appears.
- **Migration history per page** — git history covers it for now;
  re-evaluate if a use case needs structured access.
- **GEDCOM-derived YAML versioning** — out of scope; `.ged` re-derive
  via `wai sync-gedcom` covers drift.

## References

- Original sketch: `docs/superpowers/plans/2026-05-03-schema-migrations.md`
- Audit finding: `~/.claude/plans/do-an-architecture-audit-partitioned-cherny.md` Severity 5.1
- Current schema: `core/src/pages/types.ts:PageMeta`, `core/src/pages/schema.ts`
- Page reader: `core/src/pages/store.ts`, `core/src/pages/frontmatter.ts`
- Search index rebuild contract: `core/AGENTS.md`
- Eventual CLI command: new file at `cli/src/commands/migrate.ts`
