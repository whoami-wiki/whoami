# whoami.wiki migration — Markdown-on-git + Next.js/shadcn (family-shared)

## Context

Today whoami.wiki is an Electron desktop app bundling PHP, MediaWiki 1.45.3, LuaJIT, ffmpeg, and Graphviz, hosting a single-user wiki at SQLite `wiki.sqlite` (~13 MB, 157 pages, 751 revisions). The wikitext is real but only lightly uses MediaWiki-specific features (a smoke-test Lua module is the only Scribunto use; ParserFunctions appear only in 2 seed templates; no transclusion of Lua from content). The custom `Cite_*` family of templates is referenced 90+ times but the templates themselves are red links — they exist only as a *convention*, not as defined templates.

The product is being repositioned:

- **Multi-user, family-shared** (not single-user).
- **Read-everywhere, write-by-owner** ACL model.
- **Hosted at home** on the user's Mac Studio. No cloud, no Electron.
- **Authoring stays single-headed**: the user runs CLI + agents over the shared vault; other family members are read-only with rare typo edits.
- **Vault is shared on the Mac Studio** (one server-side copy, ~72 GB).
- **UI requirement**: shadcn/ui via Next.js (React 19 + App Router). SSR for pages, client hydration for the family-tree visualization.
- **Content cutoff**: only post-`.ged`-import content migrates (cutoff `2026-04-29 14:06:53 UTC`, when `Barash_Family_Tree` first appeared). ~108 pages survive the filter; ~49 are dropped (trips, sources, friends/episodes, photos, seed scaffolding).

Wiki.js was considered as a backend earlier in the brainstorm and rejected: most of its surface (multi-author editor, real-time collab, plugin system) is unused at family-wiki scale, and Wiki.js 3 has been in protracted beta. The new direction is much smaller.

## Architecture — modular monolith with service-ready boundaries

A single Node process composed of typed modules. Modules expose interfaces (no shared state); the HTTP layer is the only place they wire together. Each module is a clean candidate for extraction to its own process when a real scaling trigger fires (e.g. search has to live on a different box because of memory) — a 1–2 day refactor, not a rewrite. **Microservices was rejected**: at one Mac Studio, splitting these six modules across separate processes would multiply complexity for zero scaling benefit (see Hardening for the actual scaling triggers).

```
core/                # platform-agnostic modules, no framework deps
├── pages/           # read/write markdown, git ops, slug sanitization, page schema validation
├── gedcom/          # .ged parse, derived/<record>.yml emit, snapshots manifest, recite
├── search/          # FlexSearch today; FTS5 tomorrow (same query interface)
├── auth/            # bcrypt + cookie sessions, owner/editors check, CSRF tokens, login rate-limit
├── render/          # markdown → remark pipeline → sanitized React tree
└── assets/          # upload, serve, GC

frontend/            # Next.js (App Router) — React + shadcn/ui + Tailwind
├── app/             # routes (RSC for pages; client components for tree viz, editor)
├── components/      # shadcn/ui + custom React components for directives
└── api/             # API routes; the only place modules compose at HTTP boundary
```

**Module contract**: each module exports one TypeScript interface describing its capabilities. API handlers receive module interfaces via dependency injection; tests substitute fakes. Example:

```ts
interface PageStore {
  read(slug: string): Promise<Page>;
  write(slug: string, page: Page, author: User, summary: string): Promise<void>;
  list(filter?: PageFilter): Promise<PageMeta[]>;
  history(slug: string, limit?: number): Promise<Revision[]>;
}
```

**Process model**: one Next.js process. React Server Components import `core/*` modules directly for SSR; API routes import the same modules and expose them over HTTP for the CLI. No internal HTTP hops. One `launchd` job; one log stream.

**Storage**: markdown in git (`pages/`), structured GEDCOM data in `genealogy/`, assets outside git (`assets/`), sessions and search index in `data/`.

**Auth**: bcrypt (cost 12) for 3–5 family members; passwords in `data/users.json` (mode 0600). Cookie sessions (`SameSite=Strict`, `HttpOnly`, `Secure`) in `data/sessions.sqlite`. Per-IP login rate limit (5/min, lockout after 10 failures with backoff). CSRF tokens (double-submit) on every state-changing request. Tailscale fronts everything (LAN by default, mesh-VPN for remote) — defense in depth, not the only defense.

**Search**: FlexSearch persisted to `data/search.idx`; loaded at startup, updated incrementally on commit, rebuilt only if missing or corrupt. Indexes page body + frontmatter (title, categories, aliases) + structured fields from `genealogy/derived/` (so "Squirrel Hill" hits person pages whose residence is Squirrel Hill, even when not in narrative).

**Render**: remark + remark-directive + remark-wiki-link + remark-gfm → rehype → **`rehype-sanitize` with a tightened schema (allow tables/td/th attrs; deny `<script>`, `<iframe>`, `on*` handlers)** → React. Custom directives (`:::infobox-person`, `:::cite-vault`, etc.) map to React components.

**Assets**: served statically from `assets/`. Backed up nightly via rsync to a second drive **and** rclone to an encrypted off-site target — see Hardening row #6.

**Authoring**: CLI (`wai`, retained) is a pure HTTP client against API routes. Agents run server-side or remotely via Tailscale.

**Observability**: structured JSON logs (Pino) to stderr; `launchd` redirects to `~/whoami/data/server.log` with daily rotation. `/healthz` endpoint returns 200 with `{ commit, started, pages, lastIndexed }`. A startup line records corpus size, search RSS, and wikilink-rebuild time so soft-spot triggers fire loudly when reached.

**Performance budget** (enforced in Phase 5 evals): page render p95 ≤ 100ms; search p95 ≤ 100ms; write+commit p95 ≤ 500ms.

**Extraction trigger** (deferred): if a module's resource profile diverges enough to need its own process, in-process imports become HTTP clients with no interface change.

## Phase 0 — Backup with verified restore (gate)

Today there is no automatic backup. `wai export` exists (`cli/src/commands/export.ts`) but always bundles the ~72 GB vault into the tarball.

1. **Cold copy** the small irreplaceable bits before any migration:
   - `~/Library/Application Support/whoami/data/` (~24 MB — `wiki.sqlite`, `LocalData.php`, `images/`)
   - `~/.whoami/credentials.json`
   Stash in a dated directory outside the project.
2. **Locate and copy the canonical `.ged`** — the GEDCOM file referenced by `{{Cite vault|note=Barash Family Tree.ged record I…}}` lives somewhere on disk today (likely under `~/Library/Application Support/whoami/vault/` or in the user's MyHeritage download folder; the user identifies the exact path at the start of Phase 0). Copy it to a staging location. It will be installed at `genealogy/barash-tree.ged` in Phase 1 and hashed for the initial snapshots manifest in Phase 2.
3. **Verified restore** on a scratch machine: `wai import` (or manual file drop) → desktop app boots and renders pages. Restore must be *proven*, not assumed.
4. **Add `--no-vault` to `wai export`** for future practical use.
5. **Tailscale ACLs** — confirm Mac Studio is on the family tailnet, family members' devices are joined, and a Tailscale ACL restricts the wiki host's port 443 (or whichever) to the family tag only. Without this, the auth layer is the only thing standing between the wiki and the open internet.
6. **Off-site git mirror (soft-spot #6 mitigation)** — once the new repo exists, set up a `launchd` cron job that bundles + encrypts the repo and pushes off-site every 15 min if there are unpushed commits. Specifically: `git bundle create out.bundle <last-pushed>..HEAD` → `age -r <recipient> -o out.bundle.age out.bundle` → upload to a private remote (B2/S3/Forgejo). Survives Mac Studio loss with no plaintext on the off-site target. (Avoid `git-crypt`: known weaknesses around nonce reuse.)

Do not start Phase 1 until restore is signed off **and** the `.ged` is staged **and** Tailscale ACLs are in place.

## Phase 1 — Repo & schema (target shape)

```
~/whoami/                               # git repo root
├── pages/                              # narrative layer (markdown)
│   ├── steven-barash.md
│   ├── steven-barash.talk.md
│   ├── barash-family-tree.md
│   ├── wartime-catastrophe-in-the-barash-family-tree.md
│   ├── wartime-catastrophe-in-the-barash-family-tree.talk.md
│   ├── abby-rickelman.md
│   ├── sofia-koffman.md
│   ├── … (~100 other slug-named .md files)
│   ├── _meta/
│   │   ├── site.yml                    # nav order, dark-mode default, category list
│   │   └── redirects.yml               # redirects that aren't pages
│   └── _archived/                      # soft-deleted pages with `deleted_at` frontmatter
├── genealogy/                          # structural layer (canonical truth)
│   ├── barash-tree.ged                 # authoritative source-of-truth GEDCOM
│   ├── snapshots.yml                   # manifest of .ged versions over time
│   └── derived/                        # auto-generated structured data per individual
│       └── I28906361734.yml
├── assets/                             # NOT in git; rsync nightly + rclone off-site
└── data/                               # NOT in git
    ├── users.json                      # bcrypt'd family-member credentials (mode 0600)
    ├── sessions.sqlite                 # cookie sessions
    └── search.idx                      # FlexSearch persisted; rebuilt only if missing or corrupt
```

No namespace subfolders inside `pages/` — the wiki is family genealogy only, so trip/source/task subdirs are dropped as YAGNI. The only folders are `_meta/` (site config) inside `pages/` and the sibling `genealogy/` (structural layer).

Frontmatter:

```yaml
---
title: Abby Rickelman
owner: steven                # only this user can edit; checked at write time
editors: []                  # additional editors (forward-compat; empty today)
type: person                 # person | family | event | tree | meta
aliases: []                  # optional redirect titles
categories: [Family, People] # validated against _meta/site.yml category list
gedcom:                      # links page to its canonical GEDCOM record (optional — wiki-only people omit)
  file: barash-tree.ged
  record: I28906361734
  snapshot: a1a48f25952a3294 # hash of the .ged at citation time; survives re-imports
created: 2026-04-29
---
```

The seven categories that survive the strict `.ged` cutoff (and exhaust what's actually in use): **Family**, **People**, **Surname**, **World_War_II**, **Unconfirmed**, **Open_editorial_questions**, **Genealogy**. All genealogy-coherent.

Components (rendered as React components via `remark-directive`). Usage counts are over the entire DB (pre-cutoff included) — they show the converter's required surface, not the post-migration count.

| Today                                      | Tomorrow                                          |
|--------------------------------------------|---------------------------------------------------|
| `{{Infobox person\|…}}` (91 uses)          | `:::infobox-person` block                         |
| `{{Cite vault\|type=… snapshot=… note=…}}` (90) | `:::cite-vault{…}:::`                        |
| `{{Open}}` / `{{Closed}}` / `{{Superseded}}` (13/4/2) | admonition directives                   |
| `{{Blockquote\|…}}` (3)                    | `:::blockquote{by="…"}` block                     |
| `{{Cite message\|…}}` (2)                  | `:::cite-message{…}:::`                           |
| `{{Infobox company}}` (1)                  | `:::infobox-company` block                        |
| `{{Columns-list}}` (1)                     | `:::columns-list` block (CSS columns)             |
| `{{Dialogue\|…}}`, `{{Gap\|…}}` (defined)  | `:::dialogue{speaker="…"}`, `:::gap`              |
| `<ref>…</ref>` + `<references />`          | Markdown footnotes (`[^id]`)                      |
| `[[Page]]`, `[[Page#Section\|alt]]`        | preserved via `remark-wiki-link`                  |
| Wiki tables (`{\| … \|}`)                   | Markdown tables; raw HTML for cell-merging cases  |

## Phase 2 — Migration converter

Build `tools/wikitext-to-md/` (new package). Drains `wiki.sqlite`, applies the strict `.ged` cutoff, emits Markdown into `pages/`.

Cutoff rule: page included iff `MIN(rev_timestamp) >= 20260429140653` AND `page_namespace NOT IN (828)` (Module: namespace dropped — Scribunto removed). ~107 pages pass; ~50 drop (trip pages, source pages, photo files, friend/partner/colleague pages, episode pages, seed scaffolding, the `Module:UpgradeTest` Scribunto smoke test).

Specific transformations:

- `{{Infobox person|…}}` → `:::infobox-person` block with YAML body.
- `{{Cite vault|type=… snapshot=… note=…}}` → `:::cite-vault{type=… snapshot=… note=…}:::`.
- `{{Cite message|…}}` → `:::cite-message{…}:::`.
- `{{Open}}`, `{{Closed}}`, `{{Superseded}}`, `{{Blockquote|t|by}}`, `{{Dialogue|sp|t}}`, `{{Gap|n}}` → matching directives.
- `<ref>X</ref>` → `[^autoid]` with content moved to bottom; `<ref name="x">…</ref>` → `[^x]`.
- `[[A]]`, `[[A|B]]`, `[[A#S]]`, `[[A#S|B]]` → preserved.
- `{| … |}` tables → Markdown pipe tables when simple; raw HTML otherwise.
- `[[Category:Family]]` → frontmatter `categories: [Family]`.
- `#REDIRECT [[X]]` → frontmatter `aliases:` on the target page.
- Slugify titles for filenames; keep human title in frontmatter.
- **Install the staged `.ged`** at `genealogy/barash-tree.ged` (from Phase 0) and **compute its SHA-256 hash once**; this hash becomes the initial entry in `genealogy/snapshots.yml`. Every migrated page's `gedcom.snapshot` field gets this hash. Existing wikitext labels like `snapshot=barash-tree` (a string identifier, not a hash) are discarded — replaced with the computed hash. This is what makes `wai recite` work later. **GEDCOM compatibility constraint: only GEDCOM 5.5.1 UTF-8 is accepted.** The converter rejects ANSEL-encoded files and GEDCOM 7.0 with a clear error and exits non-zero — converting older or newer dialects is out of scope for this migration.
- **Lift GEDCOM record IDs from `{{Cite vault|note=…ged record I…}}`** → frontmatter `gedcom: { file: barash-tree.ged, record: <id>, snapshot: <initial-hash> }`. The `note=` field today carries strings like `Barash Family Tree.ged record I28906361734`; the converter parses these out. **Malformed `note=` (no `record I…` pattern)**: skip the `gedcom:` field, log a warning to a `migration-warnings.log` for review.
- After conversion, `wai sync-gedcom` runs once to populate `genealogy/derived/` — the structural sidecars referenced by person pages.

Validate against ground truth: every file in fixtures plus a sampled 20 pages from the real DB. Round-trip must produce sensible Markdown.

## Phase 3 — Web app (Next.js + shadcn/ui)

Next.js App Router. React Server Components for content; client components only where they need interactivity (editor, tree viz). All write paths are CSRF-token gated. All read paths sanitize-render the markdown.

**Public routes (read):**

- `app/[slug]/page.tsx` (RSC) — render page. Composes `pages.read(slug)` + (if `gedcom.record`) `gedcom.derive(record)` → `render.toReact(...)`. `pages` rejects slugs not matching `^[a-z0-9][a-z0-9-]*(\.talk)?$` with 400.
- `app/category/[name]/page.tsx` (RSC) — index of pages with that frontmatter category.
- `app/[slug]/history/page.tsx` (RSC) — git log for the file.
- `app/tree/[record]/page.tsx` (server shell + client component) — family-tree visualization rooted at a GEDCOM record. Reads `derived/` only.
- `app/search/page.tsx` (RSC) — `?q=…`; index covers body, frontmatter (title, categories, aliases, type), and `derived/` structured fields.

**Auth routes:**

- `app/login/page.tsx` (form posts to `/api/login`). Per-IP rate limit (5/min, lockout 10 failures). Sets `SameSite=Strict; HttpOnly; Secure` session cookie + a CSRF cookie.
- Logout via `POST /api/logout`.

**Authoring (gated by `auth.requireOwnerOrEditor(slug)`):**

- `app/[slug]/edit/page.tsx` (client component) — **Markdown body editor only**, frontmatter hidden from non-owners. CodeMirror with markdown grammar + live preview. Submits to `PUT /api/pages/[slug]`.
- `app/[slug]/settings/page.tsx` (client, **owner-only**) — frontmatter editor (categories, aliases, editors[], gedcom.{file,record,snapshot}). Validates categories against `_meta/site.yml`.
- `POST /api/pages/[slug]` — create. `PUT /api/pages/[slug]` — update. `DELETE /api/pages/[slug]` — soft-delete (moves file to `pages/_archived/<slug>.md`, sets `deleted_at` frontmatter; wikilinks pointing to it render as red after rebuild).
- `POST /api/upload` — owner-or-editor; validates MIME + size (≤25 MB); stores under `assets/<yyyy>/`; returns canonical URL.

**Trust boundary:** every write API route reads the **on-disk** frontmatter to determine the current owner before authorizing. The submitted body never authorizes itself. A malicious editor cannot escalate by editing `owner:` in their submission.

**Atomic write protocol** (in `pages` module): write to `<file>.tmp`, `fsync`, atomic `rename` over the target, `git add <file>`, `git commit`. On commit failure: `git checkout HEAD -- <file>` (restore previous content from index, or `rm` the file if it was a create). Wraps the whole sequence in a per-file mutex so concurrent edits to the same path serialize. Tested directly in Phase 5 evals.

**Wikilink resolution rule**: link target normalized by lowercase + `[\s_]+→-` before lookup. Same normalization for filenames. So `[[Steven Barash]]`, `[[steven_barash]]`, `[[Steven  Barash]]` all resolve to `pages/steven-barash.md`.

## Phase 4 — CLI changes

The CLI is **a pure HTTP client** against the modular-monolith server. The CLI never touches the filesystem or runs git directly — that's the server's job. This matters because the CLI runs both server-side (on the Mac Studio) and on remote machines over Tailscale; only the server has authoritative access to `pages/`, `genealogy/`, and the git index.

| Command | HTTP endpoint | Server-side action |
|---|---|---|
| `wai write` / `wai create` / `wai edit` | `PUT /api/pages/<slug>` | `pages` writes file (atomic temp + rename), runs `git add` + `git commit` with `--author=<owner>` |
| `wai read` | `GET /api/pages/<slug>` | `pages` reads file, returns frontmatter + body |
| `wai delete` (NEW) | `DELETE /api/pages/<slug>` | `pages` soft-deletes (moves to `_archived/`, sets `deleted_at`) |
| `wai search` | `GET /api/search?q=…` | `search` queries the index |
| `wai changes` | `GET /api/changes` | `pages` returns recent commits across `pages/` |
| `wai upload` | `POST /api/upload` | `assets` validates MIME + size, writes file outside git |
| `wai auth` | `POST /api/login` | `auth` returns bearer token (rate-limited) |
| `wai lint` | `GET /api/lint` | `pages` walks the slug index server-side, returns red links / orphans / bad anchors |
| `wai gc-assets` | `GET /api/gc-assets` | `assets` returns the orphan + broken-ref symmetric difference |
| `wai sync-gedcom` | `POST /api/gedcom/sync` | `gedcom` re-parses .ged, rewrites `derived/`, returns diff |
| `wai recite` (`--apply`) | `GET /api/gedcom/recite` (`POST` to apply) | `gedcom` reports drift; optional pointer advance |

Day-1 commands new to this migration: `wai lint` (soft-spot #4), `wai gc-assets` (soft-spot #3), `wai sync-gedcom`, `wai recite` (both GEDCOM-coupling). Existing CLI command shapes are preserved so existing skills and agents don't break.

`cli/src/wiki-client.ts` is rewritten as a thin HTTP client (axios/fetch + bearer-token cookie); it loses its MediaWiki-specific surface entirely.

## Phase 5 — Eval rewrite

Replace `evals/src/wiki.ts` (PHP-built-in-server bootstrap) with a per-test temp git repo + the Next.js server bound to a random port. `evals/src/runner/e2e.ts` calls the same `wai` commands; only the harness changes.

New eval coverage:

- **GEDCOM**: synthetic .ged → confirm `wai sync-gedcom` produces expected `derived/`; mutate the .ged → confirm `wai recite` identifies the right drift.
- **Security**: CSRF, XSS sanitization, slug rejection, login rate-limit, frontmatter trust boundary (see Verification).
- **Atomic write**: simulated `git commit` failure → working tree clean.
- **Performance**: assert p95 budgets on the migrated corpus.

## Phase 6 — Retirement

Once parity is proven:

- Delete `desktop/` entirely; `desktop/scripts/bundle-*.sh`; `desktop/resources/`; `desktop/electron-builder.yml`.
- Delete `desktop/resources/templates/*.wiki`, `wiki-theme.css`, `infobox-styles.css`.
- Update `README.md` and `CLAUDE.md` to drop Electron / PHP / MediaWiki references.
- Final `release: desktop-v1.x.x` "EOL" build, then archive the desktop release flow.

## Critical files

Modify:
- `cli/src/wiki-client.ts` — full rewrite of API layer (pure HTTP client against the Next.js API routes)
- `cli/src/auth.ts` — credential schema (bearer token instead of MediaWiki password)
- `evals/src/wiki.ts`, `evals/src/runner/e2e.ts` — swap test wiki to spawn the new server against a temp git repo
- `plugins/whoami/skills/editorial-guide/**` — drop wikitext examples, replace with Markdown + component examples

New (project repo, top-level packages):
- `tools/wikitext-to-md/` — migration converter (Phase 2)
- `core/` — platform-agnostic modules (`pages/`, `gedcom/`, `search/`, `auth/`, `render/`, `assets/`); pure TypeScript, no framework deps
- `frontend/` — Next.js (App Router) + React + shadcn/ui + Tailwind. Imports from `core/*` for SSR; exposes API routes for the CLI

Untouched:
- `web/` (the existing Next.js public site at whoami.wiki) — out of scope for this migration. Decoupled from the family wiki; nothing in the new system depends on it.

Runtime data root (on the Mac Studio, NOT in the project repo):
- `~/whoami/` — `pages/`, `genealogy/`, `assets/`, `data/` as defined in Phase 1

Delete (Phase 6):
- `desktop/` (entire dir)
- All `desktop/scripts/bundle-*.sh`
- `desktop/resources/templates/*.wiki`, `wiki-theme.css`, `infobox-styles.css`

Reuse:
- `plugins/whoami/skills/editorial-guide/references/page-conventions.md` as the spec for the converter and component contracts.
- `cli/src/commands/*.ts` — keep as-is; only `wiki-client.ts` they import changes.

## Hardening — soft-spot mitigations

For each soft spot found in design review: trigger condition (when it bites), mitigation, and whether it's day-1 or deferred.

| # | Soft spot | Trigger | Mitigation | When |
|---|---|---|---|---|
| 1 | In-memory search ceiling | corpus exceeds ~5k pages OR Node RSS > ~500 MB during search | swap FlexSearch backend for SQLite FTS5 (disk-backed, same query interface) | **Deferred** — track corpus size in a startup log line; switch when triggered |
| 2 | Wikilink-map rebuild cost | corpus exceeds ~5k pages OR rebuild >100 ms | replace startup-and-on-commit full rebuild with incremental update via `chokidar` file watcher | **Deferred** — same trigger; current cost is microseconds |
| 3 | Asset/page drift | first orphan or first broken asset link | `wai gc-assets` reports orphans + broken refs (already in Phase 4) | **Day-1** — see Phase 4 |
| 4 | Broken wikilink accumulation | first red link; ongoing | `wai lint` reports red links / orphan pages / bad anchors (already in Phase 4) | **Day-1** — see Phase 4 |
| 5 | Concurrent-write contention | scope changes (multi-author, agents writing in parallel from different processes) | upgrade per-file mutex to a process-level git index lock with retry; activate `editors: []` frontmatter field; add WYSIWYG (Milkdown/Tiptap) + soft-lock UI when the first non-technical co-author joins (see GEDCOM section, Authoring evolution path) | **Document now**, build only if ownership opens up |
| 6 | Single-machine SPOF | Mac Studio loss / disk failure / OS reinstall | off-site git push every 15 min via `launchd` cron (already in Phase 0); assets nightly via rsync to a second drive **and** rclone to an encrypted off-site target (B2/S3 with client-side encryption); off-site git uses `age`-encrypted bundles pushed to a private remote (avoids `git-crypt`'s known weaknesses); **weekly automated restore-test** that clones git + pulls assets to a scratch dir and asserts a sentinel page checksum, alerting via local `osascript` notification on failure | **Day-1** — see Phase 0 |

Day-1 work goes into Phase 0 (off-site backup) and Phase 4 (`wai lint`, `wai gc-assets`). Deferred items get a startup metric so the trigger fires loudly when reached, not silently degrades.

## GEDCOM as canonical truth (genealogy structural commitments)

The wiki is a *narrative layer over the GEDCOM*, not a replacement for it. This single design decision resolves four product-shape concerns: (1) canonical truth, (2) multi-tree households, (3) citation provenance over time, (4) authoring evolution path.

### The two-layer person page

Every person page has two parallel sources of content rendered together:

1. **Structural data** — auto-derived from `genealogy/<file>.ged`, written to `genealogy/derived/<record-id>.yml`, never hand-edited. Holds: birth/death dates and places, parents, spouses, children, marriages, occupations, sources within the GEDCOM. The web app reads this to render the Infobox and family-tree fragments. **Discoverability of structural facts ("Squirrel Hill," "1920s") goes through the search index**, which indexes `derived/` fields alongside narrative — so search hits include people whose Squirrel Hill residence is in their record but not their prose. A first-class structured query language (e.g. "born between X and Y") is future work; not built now.
2. **Narrative** — the markdown body of `pages/<slug>.md`, hand- or agent-authored. Tells the story.

A person page links to its structural data via `gedcom: { file, record, snapshot }` in frontmatter. Pages without a `gedcom:` field are wiki-only (e.g., recent arrivals not in the .ged, mentioned-only people, non-genealogy synthesis pages).

`derived/<record>.yml` schema (sketched here; finalized at the end of Phase 1):

```yaml
record: I28906361734
name: Abby Rickelman
birth: { date: 1991, place: null }
death: null
parents:
  - { record: I123, name: Yaroslav Steven Rickelman }
  - { record: I456, name: Irene Burmenko }
spouses:
  - { record: I789, name: Thomas Vincent Campanella, married: null }
children:
  - { record: I999, name: Noah Llewyn Campanella, born: 2024-07-14 }
residences: []          # GEDCOM RESI events when present
occupations: []         # OCCU events
sources: []             # provenance from the .ged file (SOUR records)
```

### Snapshot manifest — citation provenance over time

`genealogy/snapshots.yml`:

```yaml
- hash: a1a48f25952a3294
  date: 2026-04-29T14:06:53Z
  file: barash-tree.ged
  source: MyHeritage export
  notes: Initial import after .ged rebuild
```

Each `.ged` re-import appends a row. Pages cite by `snapshot.hash`, so the historical linkage survives forever — even after the file is re-saved with corrections. `wai recite` walks pages on stale snapshots, diffs the relevant records between cited snapshot and current, reports drift, and (optionally) advances the pointer once you've reviewed.

### Multi-tree households — forward-compatible schema

Today's frontmatter `gedcom: { file, record, snapshot }` is singular — one tree, one record per person. When a second tree is added (intermarriage, second family imports their own .ged), the schema migrates to a list:

```yaml
gedcom:
  - { file: barash-tree.ged, record: I123, snapshot: … }
  - { file: somek-tree.ged, record: I456, snapshot: … }
```

The web app's reader handles both shapes (object or array). No second tree exists today, so we don't build the merge UX — but the schema accommodates it without rewriting pages.

### Authoring evolution path

`editors: []` in frontmatter is forward-compat for additional editors per page. The owner-check becomes "owner OR editors[]." Empty for all pages today (single-author scope).

When the first non-technical co-author joins (the trigger), two upgrades happen:

- **WYSIWYG editor** — Milkdown or Tiptap on top of the markdown source. Source-of-truth stays markdown; the editor is just a friendly skin.
- **Soft-lock UI on simultaneous edit attempts** — show "Steven is editing" when the file's mtime moved within the last few minutes. Cheaper than full presence; sufficient at family scale.

Until triggered, neither is built. Both are documented as triggers in the Hardening table.

### Why this fixes the structural weakness

Without these commitments, the markdown-on-disk design is a one-way door for genealogy: you flatten a graph database into prose and lose the structure forever. With them:

- **The GEDCOM stays authoritative.** Re-imports produce diffs, not rewrites.
- **Family-tree visualization, place queries, date-range queries** all become possible — they read structured data, not narrative.
- **Citations remain valid** across re-imports because they hash-pin the source.
- **The narrative is the editorial layer**, separate from facts. You can rewrite a person's story without touching their birth date.

This is the difference between "a wiki about a family" and "a usable genealogy database with a wiki on top."

## Verification

- **Converter**: golden-file tests against fixtures + sampled real pages.
- **GEDCOM round-trip**: re-running `wai sync-gedcom` against the same `.ged` produces an empty diff in `genealogy/derived/`.
- **GEDCOM rejection**: converter and `wai sync-gedcom` reject GEDCOM ANSEL and 7.0 files with non-zero exit and a clear error message.
- **`wai recite` on stale snapshot**: synthetically-modify the .ged; confirm `recite` reports the exact set of changed records, offers to advance the pointer, and never auto-edits narrative bodies.
- **Atomic write under failure**: inject a `git commit` failure mid-edit; confirm working tree is clean (no orphan file) and the page reads as it did pre-edit.
- **Slug rejection**: requests for `/../etc/passwd`, `/_archived/foo`, `/UPPERCASE`, etc. return 400 from `pages.read`.
- **XSS sanitization**: `<script>alert(1)</script>` and `<img onerror=…>` in markdown body are stripped by `rehype-sanitize`; raw `<table>` with a `class` attribute survives.
- **CSRF**: `PUT /api/pages/<slug>` without a matching CSRF cookie returns 403; same for `POST /api/login`, `DELETE /api/pages/...`, `POST /api/upload`.
- **Login rate limit**: 6th failed login from a single IP within a minute is rejected; 10th triggers exponential backoff.
- **Frontmatter trust boundary**: a logged-in editor submits a page write that changes `owner:` to themselves; the server preserves the on-disk owner and rejects with 403 if the editor is not in the on-disk `editors[]`.
- **Module boundaries**: each module has its interface mocked in unit tests for the others. No module imports another module's internals.
- **CLI parity**: existing `cli/test/` extended with a mode that runs against the Next.js server. Both modes pass.
- **Frontend smoke**: render every migrated page; visually diff against MediaWiki rendering — major regressions block Phase 6.
- **Performance budget**: page render p95 ≤ 100ms, search p95 ≤ 100ms, write+commit p95 ≤ 500ms (measured against the migrated corpus).
- **Self-host**: from clean state, follow setup, install CLI, write a page, see it render. Final gate before deleting `desktop/`.
- **Backup restore**: weekly automated test (Hardening row #6) green for at least four consecutive weeks before Phase 6.
