# evals/

The eval suite that benchmarks agent harness × model combinations on the
core editorial task: read personal archives, produce encyclopedic wiki
pages, follow the editorial guide. Results show up at
[whoami.wiki/docs/choosing-harness-and-model](https://whoami.wiki/docs/choosing-harness-and-model)
and inform the project's recommended setup.

The README (`evals/README.md`) has the full operational walkthrough —
that file is the source of truth for running evals. This document is for
agents working on the eval framework itself.

## What the suite does

For each fixture × harness × model combination:

1. Provision a fresh isolated MediaWiki instance using `desktop/`'s
   bundled resources.
2. Hand the agent a task prompt, a vault directory, and the wiki API.
3. Let it run through the editorial workflow checkpoints.
4. Grade the output with rubrics (completeness, citation density,
   reference accuracy, factual accuracy, editorial quality, cross-
   linking, integrity) plus a similarity comparison to a human
   reference.

## Layout

| Path             | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `src/index.ts`   | CLI entry — `run`, `grade`, `batch`, `report`.                     |
| `src/runner/`    | E2E orchestration: provision wiki, invoke harness, capture output. |
| `src/graders/`   | One module per grader (completeness, citations, etc.).             |
| `src/harnesses/` | Per-harness drivers (Claude Code, Codex, Cursor, OpenCode).        |
| `fixtures/`      | Eval fixtures — gitignored except `fixtures/examples/`. Real fixtures are personal data. |
| `test/`          | Unit tests (`npm test`) and integration tests (`npm run test:integration`). |

## Build and run

```bash
pnpm install
npm test                                  # unit tests
npm run test:integration                  # integration tests (concurrency 1)
npm run typecheck

npm run run -- <fixture> <harness> <model>     # full e2e
npm run grade -- <output-dir>                  # grade an existing run
npm run batch -- <config>                      # multi-run sweep
npm run report -- <results-dir>                # render score tables
```

## Conventions

- **Graders are pure functions** of `(output, reference, rubric) →
  score + breakdown`. Adding a grader is one new file in
  `src/graders/<name>.ts` plus wiring in the rubric weight table.
- **Harnesses are drivers** that translate between the eval runner's
  interface and the harness's actual CLI/API. Adding a harness means
  one new module in `src/harnesses/<name>.ts`.
- **Fixtures are data, not code** — don't commit real fixtures. The
  `fixtures/examples/` directory has lightweight examples for testing
  the framework itself.
- **Integration tests are serial** (`--test-concurrency=1`) because
  they spin up MediaWiki processes and grab ports; parallel runs flake.

## Pitfalls

- **Bumping desktop bundles without re-running evals** — the eval
  runner uses `desktop/`'s bundled MediaWiki/PHP. If you change those
  bundles, prior eval runs aren't comparable.
- **Grader weight changes silently invalidating reported scores** —
  the score tables in `web/content/docs/choosing-harness-and-model.mdx`
  reference specific runs. Bumping a grader weight changes everything.
  Bump deliberately and re-run + update the docs.
- **Trusting graders blindly** — graders are heuristics, not ground
  truth. Spot-check actual outputs when scores look odd.
- **Forgetting that real fixtures are gitignored** — `npm run run`
  needs at least one fixture in `fixtures/`. The `/create-fixture`
  Claude Code skill builds one from a personal archive.
