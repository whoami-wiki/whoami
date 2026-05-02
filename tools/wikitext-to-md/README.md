# wikitext-to-md

One-shot converter from the legacy MediaWiki SQLite database to Markdown for
the whoami.wiki family-wiki migration. See
`docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md`.

## Usage

    npx tsx src/index.ts \
      --db ~/Library/Application\ Support/whoami/data/wiki.sqlite \
      --ged path/to/barash-tree.ged \
      --out ~/whoami/pages \
      --genealogy ~/whoami/genealogy

`--dry-run` prints what would be written without touching disk.

## Tests

    npm test                       # synthetic fixtures only
    WIKI_SQLITE=path npm test      # also runs e2e against the real DB
