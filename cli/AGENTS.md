# cli/

The `wai` command-line tool — the surface agents use to interact with the
wiki. When an editor agent (Claude, Codex, etc.) writes a page, it does so
by shelling out to `wai write <slug>`. When it researches a topic, it runs
`wai read`, `wai search`, `wai source list`. Keeping the agent surface
behind a CLI (rather than an in-process library) means any harness can
drive it without specific bindings.

## Commands

| Command          | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `read`           | Read a page; body to stdout, `--json` for the full record.               |
| `write`          | Overwrite a page (idempotent); body from `--file`, `--stdin`, or positional. Requires `--summary`. |
| `create`         | Create a new page (refuses if exists).                                  |
| `edit`           | Open a page in `$EDITOR`.                                                |
| `delete`         | Soft-delete (moves to `_archived/`).                                     |
| `search`         | Search title/body/aliases/categories + GEDCOM-derived fields.            |
| `sync-gedcom`    | Re-derive `genealogy/derived/*.yml` from a `.ged` file.                  |
| `rebuild-search` | Rebuild the search index from disk (use after editing pages outside the API). `--check` exits non-zero if stale. |
| `recite`         | Report or advance stale snapshot pointers in pages.                      |
| `healthz`        | Ping the API.                                                            |
| `config server`  | Set the server URL in `~/.whoami/config.json`.                           |

The CLI is an HTTP client — it talks to whatever wiki host is configured
(the desktop app, the frontend's API routes, or a hosted instance). The
host runs locally; the CLI is agent-callable.

## Build and test

```bash
npm test                                  # tsx --test "test/**/*.test.ts"
npm run typecheck                         # tsc --noEmit
npm run dev -- read steven-barash         # iterate locally with tsx
npm run build                             # esbuild bundle → dist/wai.cjs
```

The published binary is a single CommonJS bundle. Keep dependencies thin
— `wai` ships as one file and gets installed onto users' machines via
the install script in the README.

## Conventions

- **Commands are one file each** under `src/commands/<name>.ts`,
  exporting a `run<Name>` function. Add a new command by adding a file
  + wiring it into `src/index.ts`.
- **Output to stdout is parseable** — agent harnesses pipe `wai`'s
  stdout into other tools. Don't decorate it with progress chatter
  (use stderr if you need that).
- **Exit codes matter** — non-zero on any failure, with a one-line
  human-readable error to stderr.
- **Don't break the existing flag surface** without bumping the major
  version. Agents in the wild are calling `wai` with specific flags;
  silent breakage is bad.

## Release

Release commits look like `release: cli-v1.1.0` and are typically
automated. Update `RELEASE_NOTES.md` ahead of the bump.

## Pitfalls

- The CLI is the **agent contract**. Anything that's hard to discover,
  that prints inconsistent output across versions, or that has
  ambiguous error messages will degrade eval scores in `evals/`.
- Don't let `wai` know about MediaWiki vs. Next-frontend specifics.
  The server's API surface should be the same shape across hosts;
  if it isn't, that's a server bug, not a CLI workaround.
