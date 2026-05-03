# web/

The whoami.wiki marketing site — `whoami.wiki/docs`, blog, eval results,
download links. **Not** the wiki itself; that's `frontend/`.

This is a separate Next.js app deployed independently. The two share no
code today — `web/` is content-shaped (MDX docs, blog posts, design
essays), `frontend/` is data-shaped (renders user content).

## Layout

| Path                | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `app/`              | Next App Router pages.                                          |
| `content/docs/`     | MDX documentation pages — design, installation, data sources, editorial standards, evals suite, glossary. |
| `content/blog/`     | Blog posts (essays).                                            |
| `components/`       | Marketing components — hero, scene, fixtures, score tables.     |
| `lib/`, `utils/`    | Build helpers — image generation, MDX processing.               |

## Build and run

```bash
npm run dev                  # next dev
npm run build                # next build
npm run generate-images      # tsx scripts/generate-images.ts
npm run lint                 # eslint
```

## Conventions

- **Docs are MDX** with custom components like `<FixtureOverview>`,
  `<ScoreTable>`, `<ArchOverview>`, `<Note>`. New components go in
  `components/` and get imported in MDX files.
- **Eval result tables** in `choosing-harness-and-model.mdx` are
  hand-written from `evals/` outputs. When `evals/` produces new
  results, the score tables here need updating manually (today).
- **Eval fixtures and grader rubrics** are documented at length in
  `content/docs/evals-suite.mdx` — keep that in sync with the actual
  eval suite when grader weights or fixtures change.
- **Don't put product code here** — anything that runs against user
  data belongs in `frontend/` or `core/`.

## Pitfalls

- **Stale doc-vs-code drift** — design docs and evals docs are
  user-facing claims about how the system works. When you change the
  system, check whether the docs still match.
- **Breaking links to the live site** — paths under
  `whoami.wiki/docs/<slug>` are referenced from the desktop app, the
  CLI's help text, and external posts. Don't rename without redirects.
