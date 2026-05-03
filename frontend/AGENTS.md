<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure
may all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.
<!-- END:nextjs-agent-rules -->

## What this package is

The Next.js (App Router) renderer for the wiki. This is the active path
that's replacing `desktop/`'s Electron + MediaWiki host. It reads the
markdown pages and GEDCOM-derived data directly from `$WHOAMI_ROOT` and
serves a browseable wiki UI:

- `/` — index of all pages
- `/[slug]` — render a wiki page from `pages/<slug>.md`
- `/family` — family-line summary
- `/family/tree` — interactive family browser (siblings, cousins,
  descendants, lineage, lifespans, places-of-birth map, coverage prompts,
  shareable relationship links)
- `/search` — text + facet search across pages

## Layout

| Path                              | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `app/`                            | App Router pages.                                        |
| `components/family/`              | Family-tree UI primitives (tile, row, monogram, lifespan bar, map). |
| `components/family/sections/`     | One file per section on the `/family/tree` page; the page itself is just composition. |
| `components/directives/`          | Markdown directive renderers (infobox-person, infobox-company, etc.). |
| `components/ui/`                  | shadcn-derived UI primitives. |
| `lib/family.ts`                   | The orchestration layer — joins `core/family/*` graph computations with wiki page metadata for slugs and portraits. |
| `lib/env.ts`                      | Environment surface: `WHOAMI_ROOT`, `SELF_RECORD`, `DERIVED_DIR`, `PLACES_COORDS_FILE`. |
| `lib/server-services.ts`          | Server-side caches (page list, search index). |
| `lib/render.tsx`                  | Markdown → React rendering with directive support. |
| `lib/wikilinks.ts`                | `[[double-bracket]]` link resolution. |

## Tests

```bash
npm test                              # tsx --test "lib/**/*.test.ts"
npx tsx --test lib/family.test.ts     # one file
npx tsc --noEmit                      # typecheck gate
```

## Conventions

- **Server components by default**, `"use client"` only when you need
  client-side state, browser APIs, or third-party libraries that touch
  `window`. Map components (Leaflet) are the prototypical client island.
- **Pure data crosses the server/client boundary** — function props
  can't pass to client components in this Next version, so precompute
  hrefs and other strings on the server. (See `birthplaces-map.tsx`.)
- **Page sections are extracted** — `app/family/tree/page.tsx` is
  intentionally thin; each section is one file under
  `components/family/sections/`. When adding a new section, follow the
  pattern: `MySection({ view })` returns null when its slice of the
  view is empty.
- **No auth** — Tailscale ACLs are the access layer. Don't add login
  screens, sessions, or auth headers.
- **Information density** is preferred over Apple-style sparseness.
  The audience is people scanning and comparing genealogy data; show
  more per screen. Avoid page-bg tints, drop caps, parchment textures.

## Dev access via Tailscale

The dev server runs on `localhost:3001` but is browsed through Tailscale
(100.x.x.x range). Next 16 blocks cross-origin requests to dev resources
by default, which silently breaks dynamic chunk loading (the Leaflet map
hangs at "Loading map…").

`next.config.ts` has `allowedDevOrigins` configured with the project
owner's Tailscale node as a default and `WHOAMI_ALLOWED_DEV_ORIGINS`
(comma-separated) as an override. If you change the IP, restart
`next dev` — `next.config.ts` doesn't hot-reload.

## Pitfalls

- **Importing leaflet at module top-level** — Leaflet references
  `window` at import. Use `dynamic(() => import(...), { ssr: false })`.
  See `components/family/birthplaces-map.tsx` for the wrapper pattern.
- **Passing functions across the server/client boundary** — Next will
  throw `Functions cannot be passed directly to Client Components`.
  Precompute the value on the server; pass strings/numbers/plain
  objects only.
- **Reading data files on every request without caching** — use the
  TTL+mtime caches in `lib/family.ts` as the model (`getCachedDerivedRecords`,
  `getCachedCoords`).
- **Adding business logic in components** — graph operations belong in
  `core/family/*`; page joins belong in `lib/family.ts`; components
  should consume already-shaped view data.
