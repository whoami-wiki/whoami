# User-data schema migrations

> **Status:** sketch — implementation deferred. Spawn a fresh session driven by this plan when a breaking schema change needs to ship.

**Goal:** Give wiki page metadata a versioned schema and a migration path so that breaking changes to `PageMeta` don't silently break existing user pages.

## Why this exists

Today every field added to `PageMeta` (e.g. the recent `portrait?: string`)
has been optional, so existing pages without the field still validate.
That's worked, but it's a one-trick fix: the moment a field becomes
required, gets renamed, or moves to a different shape, every existing
page in the user's `~/whoami/pages/` becomes invalid against the new
schema with no migration path.

The audit (`do-an-architecture-audit-partitioned-cherny.md`, Severity
5.1) flagged this as a contract gap. This is the plan to close it.

## Sketch of the design

### Versioned schema

Add `schemaVersion: number` (default `1`) to `PageMeta` in
`core/src/pages/types.ts` and the matching Zod validator in
`core/src/pages/schema.ts`. Bumped each time a breaking change lands.

```ts
export interface PageMeta {
  schemaVersion: number;
  title: string;
  // ...
}
```

The current code's expected version becomes a constant in
`core/src/pages/schema.ts`:

```ts
export const CURRENT_SCHEMA_VERSION = 1;
```

### Migration registry

New directory `core/src/pages/migrations/` with one file per migration:

```
core/src/pages/migrations/
├── index.ts                           // registry: from-version → migration
├── 001-add-portrait-field.ts          // example
└── 002-rename-categories-to-tags.ts   // example
```

Each migration exports:

```ts
export interface Migration {
  from: number;
  to: number;
  /** Apply to the parsed frontmatter object. */
  applyMeta(meta: Record<string, unknown>): Record<string, unknown>;
  /** Optional: transform the page body. */
  applyBody?(body: string): string;
  /** One-line description for the migration log. */
  description: string;
}
```

Migrations are pure functions — input data, output data, no I/O. Easy to
test inline against synthetic inputs.

### CLI surface

New command `wai migrate` in `cli/src/commands/migrate.ts`:

```
wai migrate [--dry-run] [--page <slug>]
```

Walks `~/whoami/pages/`, reads each page, checks `schemaVersion`, and:

- If `version >= CURRENT_SCHEMA_VERSION` → no-op for that page.
- If `version < CURRENT_SCHEMA_VERSION` → apply each migration in
  sequence (`from === version` then `from === version+1` etc.) until
  caught up.
- `--dry-run` prints what *would* change without writing.
- `--page <slug>` migrates one page (used for repair / spot fixes).
- Each successful migration writes a git commit:
  `chore: migrate <slug> from v<N> to v<M>` so the history shows
  schema-driven edits separately from authorship edits.

Idempotent: re-running with no pending migrations is a clean no-op.

### Frontend safety

The frontend reads pages via `core/src/pages/store.ts`. When a page's
`schemaVersion` is *newer* than the running code's `CURRENT_SCHEMA_VERSION`
(user upgraded data, downgraded code), the store should refuse to render
and surface a clear "code is out of date — pull latest" message rather
than rendering with a corrupt-looking page.

When older (code expects newer than the page has), the store can either
(a) refuse with "run `wai migrate`" guidance, or (b) apply migrations
in-memory transparently. Option (b) is friendlier but hides the
migration; option (a) forces an explicit step. **Decision deferred until
the first real migration ships** — try (a) first, switch to (b) if the
friction is too high.

## Open questions

- **Where to store version history per page?** Just the current
  `schemaVersion` in frontmatter, or a `migrationHistory: [v1→v2 at
  <date>]` log? Lean: just current version. Git history covers the rest.
- **Migrations that touch the body, not just frontmatter** — e.g.
  upgrading a custom directive's syntax. The `applyBody?` hook is there
  for it, but no concrete case yet.
- **GEDCOM-derived YAML** in `~/whoami/genealogy/derived/*.yml` is
  separate from `PageMeta`. Does it need its own version stream? Today
  it's regenerated from `.ged` via `wai sync-gedcom`, so probably not —
  the `.ged` is the source of truth and re-derive solves drift.

## Trigger to execute

The first time a breaking change to `PageMeta` is needed — likely either
when an experimental field gets promoted to required, or when a v2
infobox shape replaces a v1 directive. At that point this plan moves
from sketch to task list.

## References

- Audit finding: `~/.claude/plans/do-an-architecture-audit-partitioned-cherny.md` Severity 5.1
- Current schema: `core/src/pages/types.ts:PageMeta`, `core/src/pages/schema.ts`
- Page reader: `core/src/pages/store.ts`, `core/src/pages/frontmatter.ts`
- Eventual CLI command: new file at `cli/src/commands/migrate.ts`
