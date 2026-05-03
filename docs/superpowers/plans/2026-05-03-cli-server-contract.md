# CLI/server HTTP contract

> **Status:** sketch — implementation deferred. Spawn a fresh session driven by this plan when contract drift causes a real bug, or when the desktop → frontend migration removes the last reason to keep the contract loose.

**Goal:** Replace the hand-written request/response types in `cli/src/api-client.ts` with a single shared contract module that both the CLI and every wiki-host server compile against, so adding a flag to one side without the other becomes a type error rather than a silent runtime break.

## Why this exists

`cli/src/api-client.ts` defines `PageMeta`, `Page`, `SyncResult`,
`ReciteEntry`, `SearchResult` — all duplicates of what the server
returns. The duplicates were necessary at the time (cli/ doesn't import
from desktop/, and didn't import from core either), but:

- `PageMeta` here is a string-typed copy of `core/src/pages/types.ts`'s
  Zod-validated `PageMeta`. Any change in core/ silently makes the cli
  copy lie.
- The cli sends untyped JSON bodies and trusts the server's response.
  No request validation; no response validation.
- The desktop server (PHP) and the frontend server (Next API routes)
  each have their own implementations of these endpoints. They could
  diverge. Today they agree by convention.

The audit (Severity 5.3) flagged this as a contract gap. This is the
plan to close it.

## Sketch of the design

### One contract module

New: `core/src/api/` (or a sibling package `@whoami/api-types` if
that's cleaner). Exports Zod schemas for every endpoint:

```ts
// core/src/api/pages.ts
import { z } from 'zod';
import { PageMetaSchema } from '../pages/schema.ts';

export const ReadPageResponse = z.object({
  slug: z.string(),
  meta: PageMetaSchema,
  body: z.string(),
});
export type ReadPageResponse = z.infer<typeof ReadPageResponse>;

export const WritePageRequest = z.object({
  body: z.string(),
  summary: z.string().min(1),
  meta: PageMetaSchema.partial().optional(),
});
export type WritePageRequest = z.infer<typeof WritePageRequest>;
```

`PageMetaSchema` already exists in `core/src/pages/schema.ts`; the new
module reuses it directly. No more cli-side copy of `PageMeta`.

### CLI consumes the schemas

`cli/src/api-client.ts` imports the Zod schemas, validates outgoing
request bodies, and parses incoming responses through them. A drift
between cli's expected shape and what the server sends becomes a Zod
parse error with a precise field path — much better than a silent
`undefined` deep in the call chain.

Delete the duplicate type definitions in `api-client.ts` once the
imports land.

### Server consumes the schemas

`frontend/app/api/**/route.ts` route handlers parse `await req.json()`
through the matching `*Request` schema, and shape responses through the
matching `*Response` schema before returning. The desktop PHP server is
out of scope here — it's being phased out, and re-targeting PHP types
to TS-Zod is too much work for a path that's going away.

### Endpoint inventory (audit before writing schemas)

Before adding schemas, audit every route in `frontend/app/api/**` and
every method in `cli/src/api-client.ts`. Record them in a table here so
the plan has explicit coverage:

```
GET  /api/healthz                  → cli.healthz()
GET  /api/pages/:slug              → cli.read()
POST /api/pages/:slug              → cli.write() / cli.create()
DELETE /api/pages/:slug            → cli.delete()
POST /api/gedcom/sync              → cli.syncGedcom()
GET  /api/gedcom/recite            → cli.recite()
POST /api/gedcom/recite/apply      → cli.recite({apply: true})
GET  /api/search?q=...             → cli.search()
```

(Confirm this table when picking up the plan — it's from a quick scan,
not a comprehensive audit.)

### Versioning

The contract schemas live in core/, which means they version with the
code repo. A breaking endpoint change (rename, removed field, type
narrowed) means bumping a version constant: `export const API_VERSION = 2;`.
The CLI sends `X-Whoami-Api-Version: 2` on every request; the server
returns `400 api-version-mismatch` if it can only speak v1. This gives
agent harnesses in the wild a clean error rather than mystery breakage
when the server upgrades.

## Open questions

- **Should the `core/src/api/` schemas live in `core/` or a sibling
  package?** Lean: `core/`. The CLI already imports from core via the
  `@core/*` alias; another path would mean another tsconfig dance for
  no obvious benefit.
- **Do we validate responses on the cli side, or trust the server?**
  Lean: validate. The whole point is catching drift; a cli that trusts
  malformed responses defeats it.
- **Migration path for current cli usage** — every method in
  `ApiClient` that currently returns a hand-written type needs to start
  returning the Zod-inferred type. Some return shapes might shift
  (e.g. optional fields that are currently required). Do this method by
  method, not all at once.
- **PHP server compatibility during the desktop transition** — for as
  long as `desktop/`'s PHP server is the host, the cli has to remain
  compatible with whatever PHP returns. Adding response validation
  could break that today. Implementation order: bump frontend/ to use
  the schemas first (easy), then cli to send schemas (medium), then
  cli to validate responses (gated by desktop retirement).

## Trigger to execute

The first time a contract drift causes a real bug — most likely a flag
or field added to one side that the other doesn't know about.
Alternatively: when the desktop → frontend migration is far enough
along that the PHP server is no longer a constraint, this becomes
straightforward.

## References

- Audit finding: `~/.claude/plans/do-an-architecture-audit-partitioned-cherny.md` Severity 5.3
- Current duplicated types: `cli/src/api-client.ts:10-52`
- Authoritative `PageMeta`: `core/src/pages/types.ts`, `core/src/pages/schema.ts`
- Server route handlers: `frontend/app/api/**/route.ts`
- Eventual new module: `core/src/api/` with one file per endpoint family.
