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

Five components, each with a single responsibility — pure migration
definitions, the read seam (`parsePage`), the strict-write rule on the
store, the migrate runner (boundary module), and the CLI/API surface.

### Pure: migration definitions

`core/src/pages/migrations/`

- One file per migration: `001-<name>.ts`, `002-<name>.ts`, etc.
  V1 ships **no** migration files.
- `index.ts` is the registry: explicit imports (no auto-discovery),
  exposes `CURRENT_SCHEMA_VERSION`, the `Migration` interface, and a
  `migrate(meta, fromVersion)` composer that applies the chain.
- Pure functions only. No I/O. Testable with synthetic input.

### The read seam: `parsePage`

`core/src/pages/frontmatter.ts:parsePage` is updated to own the full
read chain:

```
parsePage(slug, raw)
  = let { data, content } = matter(raw)
    let fromVersion = (data.schemaVersion as number) ?? 1
    let migrated = migrate(data, fromVersion)
    let meta = parsePageMeta(migrated)        // Zod validates current shape
    return { slug, meta, body: content.trimStart() }
```

This makes `parsePage` the single integration point for migration:

- `store.read()` calls `parsePage`, gets a current-shape `Page` for free.
- `store.list()` calls `parsePage` (today via `try { parsePage(...) } catch { skip }`),
  gets migrated meta automatically.
- `core/src/search/rebuild.ts:22` already calls `parsePage`; the search
  index gets migration for free without any changes.

There is exactly one read seam. The "schema awareness lives in the
store, not the parser" framing was wrong in earlier drafts — the parser
is the right home because every reader composes from there.

### The strict-write rule: `store.write` and `store.softDelete`

`core/src/pages/store.ts:store.write` adds a peek before serialization:

- If the file exists, call `peekSchemaVersion(path)` (helper in
  `frontmatter.ts`).
- If `onDisk < CURRENT_SCHEMA_VERSION`, throw `StaleSchemaVersionError`.
- If `onDisk > CURRENT_SCHEMA_VERSION`, throw `FutureSchemaVersionError`.
- New pages (no existing file) skip the peek.
- Otherwise serialize, fsync, rename, git commit (unchanged).

`store.softDelete` gets the same peek at the *source* path
(`pages/<slug>.md`) before it reads. Without this, a soft-delete of a
stale page would silently re-serialize at `CURRENT` (because
`parsePage` migrates on read) and effectively perform an unannounced
migration as a side effect of archiving. Refusing the soft-delete and
asking the user to run `wai migrate` first keeps the strict-write
rule honest across every store method that writes.

`store.read` and `store.list` get migration for free from the
`parsePage` change — they are not writes and do not need the peek.

### The migrate runner: `core/src/pages/migrate-runner.ts` (new boundary module)

The runner is a dedicated boundary module — listed alongside `store.ts`,
`git.ts`, etc. in `core/AGENTS.md`'s table of allowed I/O modules. The
runner exists because the strict-write rule on `store.write` is exactly
the rule the migration must violate, and we want the bypass to be
contained in one explicit place rather than as a flag on the public
store API.

Public surface:

```ts
/** Result of a migration walk. One entry per file the runner touched. */
export interface MigrateReport {
  walked: number;
  migrated: { slug: string; from: number; to: number }[];
  skipped: { slug: string; version: number }[];
  failed: { slug: string; error: string }[];
}

export interface MigrateRunnerOptions {
  repoRoot: string;
  pagesDir: string;
  /** Migrate this slug only. Walks both dirs to find it. */
  page?: string;
  /** Compute report without writing. */
  dryRun?: boolean;
  /**
   * If true, allow running with uncommitted changes in repoRoot.
   * Default false: the runner refuses to operate on a dirty repo.
   */
  force?: boolean;
}

/** Migration commit author. Synthetic so commits are clearly tool-authored. */
export const MIGRATE_AUTHOR = {
  name: 'wai migrate',
  email: 'migrate@whoami.local',
} as const;

export async function runMigrate(opts: MigrateRunnerOptions): Promise<MigrateReport>;
```

Behavior:

- Pre-flight: unless `force`, run `git status --porcelain` in `repoRoot`.
  If non-empty, throw `DirtyRepoError`. The runner must not interleave
  its commits with the user's in-progress edits.
- Walk `pages/*.md` (recursive — picks up `pages/_archived/*.md`).
- For each file: read raw, parse with `gray-matter` to get rawMeta and
  body. The runner does **not** call `parsePage` here, because parsePage
  would migrate the meta in-memory and discard the on-disk version
  before we got to compare against it.
- `fromVersion = rawMeta.schemaVersion ?? 1`.
- If `fromVersion > CURRENT` → throw `FutureSchemaVersionError` for the
  whole run (it's a code-out-of-date condition; abort, don't continue).
- If `fromVersion === CURRENT` → record in `report.skipped`, continue.
- Otherwise:
  - Apply the migration chain to get migrated rawMeta.
  - `parsePageMeta(migrated)` to validate the result against the
    current Zod schema. Failure here means the migration produced
    invalid output (a bug in the migration); message: *"migration of
    `<slug>` from v<N> to v<M> produced invalid frontmatter: <zod err>"*.
    Treat as per-file failure (`report.failed`) so the rest of the walk
    proceeds.
  - If `dryRun`: record in `report.migrated`, do not write.
  - Else: serialize via `serializePage`, atomic tmp+rename, then
    `addAndCommit(repoRoot, [absPath], MIGRATE_AUTHOR, "chore: migrate <slug> from v<N> to v<M>")`.

The runner does **not** call `rebuildSearchIndexFromDisk()` itself —
that function lives in `frontend/lib/server-services.ts` and `core/`
cannot import from `frontend/` (layer violation). Instead, the
orchestrating wrapper `runMigrateOnDisk` in server-services.ts
inspects the returned `MigrateReport` and calls
`rebuildSearchIndexFromDisk()` when `!opts.dryRun &&
report.migrated.length > 0`. This keeps the runner pure of frontend
deps and gives the wrapper one obvious place to compose the two.

Body is **not** touched in V1. The runner copies body verbatim; the
schema-version field is the only thing that changes in frontmatter for
a no-op-shape migration. (Body-touching support arrives with the
`applyBody?` hook the day a real case appears.)

### CLI / API surface

To match the existing CLI pattern (every command — `read`, `write`,
`rebuild-search` — calls the API), `wai migrate` follows suit:

| Layer | File | Role |
|---|---|---|
| CLI command | `cli/src/commands/migrate.ts` | Parse argv, call `client.migrate({ page, dryRun, force })`, format and print the `MigrateReport`. |
| API client | `cli/src/api-client.ts` (extend) | `migrate(opts)` posts to `/api/migrate`. |
| API route | `frontend/app/api/migrate/route.ts` (new) | POSTs only; calls `runMigrate` from server-services. |
| Server-side wiring | `frontend/lib/server-services.ts` (extend) | `runMigrateOnDisk(opts)` thin wrapper that injects `WHOAMI_ROOT` / `PAGES_DIR` and calls `runMigrate`. |
| Boundary | `core/src/pages/migrate-runner.ts` | Walks files, applies migrations, writes, commits. |

```
wai migrate              # walk all pages, apply pending migrations
wai migrate --dry-run    # print plan, no writes
wai migrate --page <slug># single-page migrate (also works with --dry-run)
wai migrate --force      # run even with a dirty data repo (use with care)
```

Output: human-readable summary + counts, matching the rebuild-search
output style. `--json` flag for machine-readable.

### Frontend integration

`frontend/app/api/pages/[slug]/route.ts` (the existing page-write
route) catches `StaleSchemaVersionError` and `FutureSchemaVersionError`
from the store and translates them into HTTP 409 responses:

```json
{ "error": "stale-schema-version", "slug": "...", "onDisk": 1, "current": 2 }
{ "error": "future-schema-version", "slug": "...", "onDisk": 3, "current": 2 }
```

The editor (TBD which component owns the save call — confirm during
implementation; likely whatever wraps the markdown textarea) reads the
error code and renders a banner:

- `stale-schema-version` → *"This page is on schema vN; the code
  expects vM. Run `wai migrate` to update."*
- `future-schema-version` → *"This page was written by a newer version
  of the wiki. Pull the latest code."*

The same `future-schema-version` condition can also surface during a
read (a page on disk is ahead of the code). The page route handler for
SSR should render an error page in that case rather than crashing.

## Data flow

### Read

All read-side work happens inside `parsePage` (see "The read seam"
above). Sequence inside `parsePage`:

```
raw markdown
  → matter(raw)                            // YAML + body
  → fromVersion = data.schemaVersion ?? 1  // explicit default
  → migrate(data, fromVersion)             // returns vCURRENT (no-op if equal)
  → parsePageMeta(migrated)                // Zod validates the FINAL shape
  → Page { meta, body }                    // returned to caller
```

Validation happens **after** migration. The Zod schema describes the
current shape only; older shapes are not Zod-typed — migrations
operate on `Record<string, unknown>` and we trust git history for
what the old shape looked like.

**Two defaults at two layers.** `parsePage` does an explicit `?? 1`
*before* calling `migrate` — that is the rule for old pages on disk.
The Zod schema additionally has `.default(CURRENT_SCHEMA_VERSION)`
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
  → if onDisk > CURRENT → throw FutureSchemaVersionError
  → otherwise serialize, fsync, rename, git commit
```

**`peekSchemaVersion(path)`** is a small helper in
`core/src/pages/frontmatter.ts`: read the file, run `gray-matter` to
extract just the frontmatter, return `data.schemaVersion ?? 1` as a
number. It does not instantiate a `Page` and does not run Zod. Cheap
(single small file read, no body parse), and the caller is about to
overwrite the file anyway. New-page writes (file doesn't exist) skip
the peek entirely.

The store keeps its existing atomic write-tmp / rename / commit /
restore-on-commit-failure pattern unchanged. A failure mid-write
leaves the prior on-disk content intact.

### `wai migrate`

The runner (in `core/src/pages/migrate-runner.ts`) drives the walk
itself; it does **not** route through `store.write` (which would
refuse the very situation the runner exists to handle).

```
preflight: if not opts.force, git status --porcelain in repoRoot
           → if dirty, throw DirtyRepoError before any walk
for each *.md under pages/ (recursive, includes _archived/):
  read raw text
  matter() → rawMeta + body
  fromVersion = rawMeta.schemaVersion ?? 1
  if fromVersion > CURRENT → throw FutureSchemaVersionError, abort run
  if fromVersion === CURRENT → report.skipped, continue
  apply chain → migratedMeta
  parsePageMeta(migratedMeta)
    → if Zod fails: report.failed with "migration produced invalid output", continue
  if dryRun → report.migrated += {slug, from, to}; do not write
  else →
    serialize + atomic tmp/rename to original path
    addAndCommit(repoRoot, [absPath], MIGRATE_AUTHOR,
                 "chore: migrate <slug> from v<N> to v<M>")
    report.migrated += ...
return report
// (server-services.ts:runMigrateOnDisk calls rebuildSearchIndexFromDisk
//  when report.migrated.length > 0 and not dryRun — see Architecture)
```

The CLI translates the report to a non-zero exit if `report.failed`
is non-empty, zero otherwise. Dirty-repo refusal exits 3 with the
"run with `--force` if you mean it" message.

## Components and interfaces

### New files

```
core/src/pages/migrations/
└── index.ts                         # CURRENT_SCHEMA_VERSION, Migration interface,
                                      # migrate(), MissingMigrationError,
                                      # FutureSchemaVersionError. V1 ships empty MIGRATIONS.

core/src/pages/migrate-runner.ts     # boundary module: walk, apply, write, commit
                                      # exports runMigrate(), MIGRATE_AUTHOR,
                                      # DirtyRepoError, MigrateReport

cli/src/commands/migrate.ts          # wai migrate CLI (parses argv, calls API client)
frontend/app/api/migrate/route.ts    # POST /api/migrate; calls server-services
```

### Modified files

```
core/src/pages/types.ts        # add schemaVersion: number to PageMeta
core/src/pages/schema.ts       # add schemaVersion to Zod with .default(CURRENT)
core/src/pages/frontmatter.ts  # parsePage owns parse→migrate→validate;
                                # serializePage emits schemaVersion + portrait (fixes drop);
                                # add peekSchemaVersion()
core/src/pages/store.ts        # store.write peeks on-disk version, throws
                                # StaleSchemaVersionError / FutureSchemaVersionError;
                                # export StaleSchemaVersionError class
core/src/pages/index.ts        # re-export from migrations/, migrate-runner
core/AGENTS.md                 # add migrate-runner.ts to the boundary modules table
cli/src/index.ts               # register the migrate command
cli/src/api-client.ts          # add migrate(opts) method
frontend/lib/server-services.ts # add runMigrateOnDisk(opts) wrapper
frontend/app/api/pages/[slug]/route.ts  # catch StaleSchemaVersionError /
                                          # FutureSchemaVersionError, return 409
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
// PageStore interface is unchanged in shape — only the contract of
// store.write tightens (peek and reject stale-or-future on-disk version).

/** Thrown by store.write when on-disk schemaVersion is older than CURRENT. */
export class StaleSchemaVersionError extends Error {
  constructor(
    public readonly slug: string,
    public readonly onDisk: number,
    public readonly current: number,
  );
}
```

The migrate runner is the only path that writes to a stale-version
file, and it lives in its own module (`migrate-runner.ts`) — it does
not touch `PageStore`. Strict-write enforcement therefore stays a
single rule on a single method, with no opt-out flag on the public
store API.

### `core/src/pages/index.ts` — barrel additions

```ts
export * from './migrations/index.ts';   // CURRENT_SCHEMA_VERSION, Migration,
                                          // migrate, MissingMigrationError,
                                          // FutureSchemaVersionError
export * from './migrate-runner.ts';     // runMigrate, MIGRATE_AUTHOR,
                                          // DirtyRepoError, MigrateReport
// existing re-exports of types/slug/frontmatter/schema/store unchanged;
// StaleSchemaVersionError flows out via the store re-export.
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

| Condition | Read path | Write / softDelete path | CLI |
|-----------|-----------|------------|-----|
| On-disk older than CURRENT | Migrate transparently in memory; no error. | Throw `StaleSchemaVersionError`; API returns 409; editor shows banner with `wai migrate` instruction. | `wai write` / `wai delete`: print error, exit 2. `wai migrate`: applies the migration. |
| On-disk newer than CURRENT | Throw `FutureSchemaVersionError`; frontend renders "code is out of date — pull latest" page. | Same error class; editor / soft-delete refuses to operate. | Both `wai write` / `wai delete` and `wai migrate` refuse to operate. |
| Missing step in chain | `MissingMigrationError` at module load (fails fast on first import of `core/src/pages/migrations/index.ts`). | Same. | Same. |
| Migration function throws on a specific page | Error propagates; frontend renders "page failed to load" with slug + message. | Same. | `wai migrate`: caught per-page, recorded in `report.failed`, walk continues; non-zero exit at end. |
| Migration produces output that fails Zod validation | `parsePage` re-throws the Zod error; frontend renders error page. | Same — but in practice this only manifests when the runner's post-migrate validation fails (writes never get this far). | `wai migrate`: per-file failure with message *"migration of `<slug>` from v<N> to v<M> produced invalid frontmatter: <zod err>"*; on-disk file unchanged. |
| Data repo has uncommitted changes | n/a | n/a | `wai migrate`: throws `DirtyRepoError` before walking; exit 3; `--force` to bypass. |

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

### `parsePage` integration — extend `core/test/pages/frontmatter.test.ts`

- `parsePage` returns a `Page` with `schemaVersion === CURRENT` when
  the input frontmatter has no `schemaVersion` field
- `parsePage` returns migrated meta when the registry has migrations
  (the registry is the real one; tests pre-arrange `CURRENT` and a
  synthetic chain via the test injection point on `migrate`)
- `parsePage` re-throws `FutureSchemaVersionError` for input where
  `schemaVersion > CURRENT`

### Store layer — extend `core/test/pages/store.test.ts`

- `read()` reads a stale-version page transparently (proxy test:
  on-disk schemaVersion remains stale; returned Page is at CURRENT)
- `write()` throws `StaleSchemaVersionError` when the on-disk file
  is at a lower version than CURRENT
- `write()` throws `FutureSchemaVersionError` when on-disk is higher
- `write()` succeeds when on-disk equals CURRENT
- `write()` succeeds for new pages (no on-disk file)
- `softDelete()` peeks the source path and throws
  `StaleSchemaVersionError` when on-disk is below CURRENT, matching
  `write()`'s behavior (no silent side-effect migration on archive)

### Migrate runner — `core/test/pages/migrate-runner.test.ts` (new)

Fixtures use a tmp dir with `git init` plus seed pages at known
schemaVersions. Test cases:

- Dirty preflight: tmp repo with an uncommitted change → throws
  `DirtyRepoError` before walking; `force: true` skips the preflight.
- Future-version page in repo → throws `FutureSchemaVersionError`,
  no commits made.
- All-current dir: zero entries in `report.migrated` and
  `report.failed`; no commits.
- Mixed dir (one stale, one current, one in `_archived/`): exactly
  the stale ones are migrated, each in its own commit, archived
  files are walked too.
- `dryRun: true`: report has expected `migrated` entries; zero git
  commits and zero file mtime changes.
- `page: <slug>`: only that file is touched.
- A page where the migration produces output that fails Zod →
  `report.failed` includes it with a "produced invalid frontmatter"
  message; other pages still proceed; the bad page's on-disk file
  is unchanged.
- Commit author of every migration commit equals `MIGRATE_AUTHOR`.

### Frontmatter renderer — `core/test/pages/frontmatter.test.ts` (new)

- **Round-trip property test on `meta`:** for every field in a
  fully-populated `PageMeta` (including `portrait` and `schemaVersion`,
  with and without optional fields set),
  `parsePage(slug, serializePage(p)).meta` deep-equals `p.meta`. This
  is the regression net for the `portrait`-drop bug and the structural
  guard for any new field. (Body is **not** part of the round-trip
  property — `parsePage` and `serializePage` both trim leading body
  whitespace, which is preexisting behavior unrelated to this work.)
- `parsePage` of frontmatter without `schemaVersion` returns a `Page`
  whose `meta.schemaVersion === 1`.
- Missing `portrait` stays absent (not serialized as `portrait: ""`
  or `portrait: null`).
- `peekSchemaVersion` returns `1` for a file without the field;
  returns the explicit value otherwise.

### Server-services orchestration — extend `frontend/test/server-services.test.ts` (or equivalent)

If a server-services test file does not yet exist for this kind of
unit-level test, add one. Otherwise extend the existing one.

- `runMigrateOnDisk` calls `rebuildSearchIndexFromDisk` exactly once
  when the runner reports `migrated.length > 0` and `dryRun` is false.
- `runMigrateOnDisk` does **not** call `rebuildSearchIndexFromDisk`
  when the runner returned zero migrated entries.
- `runMigrateOnDisk` does **not** call `rebuildSearchIndexFromDisk`
  when `dryRun` is true (even if `migrated` is non-empty).

### CLI runner — `cli/test/commands/migrate.test.ts` (new)

These cover the CLI translation layer only — runner behavior is
covered above. Mock the API client to return canned `MigrateReport`s.

- prints summary + counts as expected for happy / dry-run / failed reports
- `--json` prints the report verbatim
- exit code is 0 on full success, 2 if any `failed`, 3 if `DirtyRepoError`

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
