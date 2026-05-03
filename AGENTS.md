# whoami.wiki

> A personal encyclopedia written by AI agents — for the person whose life it is.

## What this project is

whoami.wiki turns your digital archives (photos, chats, location history,
transactions, social media exports, family trees) into a structured wiki
about your life. The wiki is **private**, **local-first**, and **agent-authored**.

The flow:

1. You snapshot personal data into a content-addressed vault (one file per
   hash, deduplicated, immutable).
2. Wiki pages exist in a `Source:` namespace describing each data source —
   what it is, how to query it.
3. An agent (Claude Code, Codex, OpenCode) reads the source pages, queries
   the vault, and writes encyclopedia pages — `Person:`, `Place:`, `Event:`,
   `Family:` — citing back to vault hashes for provenance.
4. The wiki UI renders the pages for you to browse.

The design hypothesis is that LLMs already know the wiki form deeply
(Wikipedia is in their training data), so the format is a natural medium
for organizing personal knowledge that an agent can produce well and a
human can browse intuitively.

## Repository layout

This is a monorepo with several packages, each with its own `AGENTS.md`
covering local conventions:

| Package          | What it is                                                                       |
| ---------------- | -------------------------------------------------------------------------------- |
| `core/`          | Platform-agnostic logic. Page parsing, GEDCOM ingestion, family graph, search. Pure TypeScript, no React, no I/O above the function boundary. |
| `frontend/`      | Next.js 16 (App Router) renderer for the wiki — slug pages, search, family tree. The active path; serves the wiki UI from local data. |
| `desktop/`       | Electron app bundling MediaWiki + PHP. The original wiki host; being phased out in favor of `frontend/`. |
| `cli/`           | The `wai` CLI — the surface agents use to interact with the wiki (snapshot, list pages, write pages, list sources). |
| `plugins/whoami/`| The agent extension. Skills, agent definitions, editorial guides that load when an agent is doing wiki work. |
| `web/`           | The whoami.wiki marketing site (docs, blog). Separate Next app from `frontend/`. |
| `evals/`         | Eval suite for benchmarking agent harness × model quality on wiki authoring tasks. |
| `tools/`         | One-off migration helpers (wikitext-to-md, wiki-preview). |
| `pages/`         | Sample/demo wiki pages checked into the repo. |
| `docs/`          | Design notes, plans, and superpowers plan documents. |

## Where the data lives

The wiki's actual content is **outside this repo**, in `$WHOAMI_ROOT`
(default: `~/whoami`). That directory is its own git repo and contains:

```
~/whoami/
├── pages/                   wiki pages (markdown + frontmatter)
├── genealogy/
│   ├── derived/             one .yml per individual, derived from GEDCOM
│   ├── places-coords.yml    curated lat/lon for birthplaces map
│   └── *.ged                GEDCOM source files
├── data/                    runtime state (search index, sessions)
├── assets/                  user-side binary blobs (rsync-backed)
└── research-plans/          open research questions for the agent / user
```

When you're editing code in this repo, **don't `git add -u`** — there is
almost always in-progress data work in the user's checkout that shouldn't
be swept into a code commit. Stage specific files explicitly.

The data repo is separate from this code repo. They evolve independently.

### User data vs. project data — the stranger test

Whether something belongs in this code repo or in `$WHOAMI_ROOT` isn't
a question of "what kind of data" — it's a privacy question. Apply the
**stranger test**: *could I show this file to a stranger without
revealing anything about the user?*

If the file's contents, structure, or the *fact that particular entries
exist* would tell a stranger about the user's life, family, places, or
relationships — it's user data. Stays in `$WHOAMI_ROOT`, even if every
individual value is impersonal.

The canonical example is `genealogy/places-coords.yml`. Every coordinate
is universal geography (Kyiv is at 50.45, 30.52 regardless of whose
family is from there), but the *list* of which places appear is "places
this user's ancestors lived." The file as a whole reveals user-life
information. It's user data.

Project-data candidates are things that aren't keyed on the user at all:
synthetic test fixtures (an invented family used by unit tests), schema
definitions, default UI strings, taxonomy definitions that aren't
user-derived.

When in doubt, lean towards user data. The cost of two-repo coordination
is the price of an honest privacy boundary.

## Tech and conventions

### Tests run via `tsx --test`

All packages use Node's built-in test runner via the `tsx` loader:

```bash
cd core && npm test          # tsx --test "test/**/*.test.ts"
cd frontend && npm test      # tsx --test "lib/**/*.test.ts"
```

Targeted run for one file: `npx tsx --test path/to/file.test.ts`.
Tests use `node:test` and `node:assert/strict` — not Jest, Vitest, or Bun.

### Code style

- **TypeScript everywhere**, with `tsc --noEmit` as the typecheck gate.
- **Pure logic in `core/`**: no React, no I/O above the function boundary.
  Tests pass in `Map<string, DerivedRecord>` rather than reading files.
- **Frontend is Next 16** with breaking changes from earlier versions —
  read `frontend/AGENTS.md` and `node_modules/next/dist/docs/` before
  writing Next code from training-data instinct.
- **No auth in `frontend/`** — Tailscale ACLs are the access layer for
  the personal-wiki use case.
- **Information density preferred** in UI — the wiki audience is people
  scanning and comparing; Apple-style sparseness is wrong here.

### Commit messages

Conventional commits, lowercase subject after the type prefix, no scope,
imperative mood, under ~72 chars, no trailing period.

```
type: short description (#PR)
```

Types: `feat`, `fix`, `chore`, `release`.

```
feat: support inline audio/video players (#29)
fix: harden write command and improve cli error reporting (#30)
chore: improve desktop release flow (#14)
release: cli-v1.0.6
```

Release commits use `release: <product>-v<semver>` — e.g.
`release: cli-v1.1.0`, `release: desktop-v1.0.5`. Squash-merged PRs end
with `(#N)`.

### Plans live in `docs/superpowers/plans/`

For multi-step features, write a plan document at
`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` before touching
code. Update the roadmap entry when each plan ships. The plan format
(task list with checkboxes, exact code in each step) is the project's
convention.

### What's in motion

The MediaWiki-based desktop app (`desktop/`) is being phased out in favor
of the Next.js frontend (`frontend/`). When in doubt, treat `frontend/` as
the active path and `desktop/` as legacy. The CLI (`cli/`) bridges both
during the transition.

## Most common pitfalls

- **`git add -u`** — sweeps the user's in-progress data work into your
  commit. Always stage specific files.
- **Assuming the test runner** — it's `tsx --test`, not Bun or Jest.
- **Importing into `core/` from React/Next** — `core/` is platform-
  agnostic on purpose. Frontend joins happen in `frontend/lib/`.
- **Editing `~/whoami/` from this repo** — the data repo is separate;
  changes there should be committed there.
- **Cross-origin dev requests** — `frontend/` is browsed via Tailscale.
  See `frontend/next.config.ts` for the `allowedDevOrigins` config.

## Where to look for more

- Design philosophy: `web/content/docs/design.mdx`
- Setup walkthrough: `web/content/docs/installation.mdx`
- Editorial standards (page conventions, citations): `web/content/docs/editorial-standards.mdx`
- Eval suite protocol: `web/content/docs/evals-suite.mdx`
- Live docs site: <https://whoami.wiki/docs>
