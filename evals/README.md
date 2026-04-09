# evals

Evaluation toolkit for ProjectWiki editorial agents. Measures how well an AI agent can read construction contract documents (drawings, specifications, RFIs, submittals) and produce encyclopedic wiki pages following the [editorial guide](https://projectwiki.dev/docs/editorial-standards).

## Quick start

```bash
cd evals
pnpm install
```

### Prerequisites

The e2e runner spins up an isolated MediaWiki instance using the desktop app's bundled resources. Build them first:

```bash
cd ../desktop
./scripts/build-php.sh
./scripts/bundle-mediawiki.sh
./scripts/bundle-lua.sh
```

You also need at least one fixture. Real fixtures are gitignored — create your own with `/create-fixture` in Claude Code or copy from `fixtures/examples/`.

## Running an eval

### End-to-end run

The `run` command provisions a fresh wiki, invokes the agent harness, and grades the output:

```bash
# Run all cases in a suite
pnpm run run --suite incremental --harness claude-code

# Run a specific case
pnpm run run --suite incremental --case 001-area --harness claude-code

# Specify a model
pnpm run run --suite incremental --case 001-area --harness claude-code --model claude-opus-4-6
```

Each run gets a clean wiki — no cross-contamination between runs.

#### Run flags

| Flag | Description |
|------|-------------|
| `--suite <name>` | **Required.** Suite to run (directory name under `fixtures/`). |
| `--harness <name>` | **Required.** Agent harness: `claude-code`, `codex`, or `opencode`. |
| `--case <id>` | Run only this case (matches `id` field in `case.json`). |
| `--model <name>` | Model to use (passed to the harness). |
| `--external-wiki` | Use your running ProjectWiki instance instead of spinning up an isolated one. Uses existing `wai` credentials. |
| `--inspect` | Pause after grading so you can browse the wiki before teardown. |
| `--checkpoint-threshold <n>` | Override the per-checkpoint gate score (default: from `case.json` or `0.7`). |
| `--from-result <path>` | Resume from a previous result JSON — restores all passing checkpoints and skips them. Useful for iterating on later checkpoints without re-running expensive early ones. |

#### What happens during a run

For incremental suite fixtures (the primary workflow):

1. **For each checkpoint** in the fixture's `checkpoints` array:
   - The agent receives the checkpoint description as a task prompt
   - New document volumes (if any) are introduced for the agent to ingest
   - The agent reads/creates/updates wiki pages using `wai` commands
   - Target pages are discovered and graded against the configured graders
   - If the score falls below the checkpoint's `threshold`, the run stops early
2. **Results** are written to `results/<case-id>-<harness>-<timestamp>.json`
3. **The wiki is torn down** (unless `--inspect` is set)

#### Resuming from a previous run

The `--from-result` flag lets you skip checkpoints that already passed:

```bash
# First run — might take 30+ minutes for all 6 checkpoints
pnpm run run --suite incremental --case 001-area --harness claude-code

# Resume from checkpoint 4 onward (reuses pages from checkpoints 1-3)
pnpm run run --suite incremental --case 001-area --harness claude-code \
  --from-result results/001-area-claude-code-2026-03-19T10-30-00-000Z.json
```

The runner restores all wiki pages from passing checkpoints, re-ingests document volumes into the vault, and picks up where it left off.

### Grading existing output

The `grade` command scores wikitext without running an agent:

```bash
# Grade a single page
pnpm run grade fixtures/incremental/001-area --page output.wikitext

# Grade a directory of pages (area.wikitext, talk.wikitext, etc.)
pnpm run grade fixtures/incremental/001-area --pages output/

# Re-grade a previous result with all graders
pnpm run grade fixtures/incremental/001-area --result results/001-area-claude-code-2026-03-19.json

# Re-grade only specific graders (merges with existing scores)
pnpm run grade fixtures/incremental/001-area --result results/001-area-claude-code-2026-03-19.json --graders accuracy,editorial

# Rule-based graders only (no API key needed)
pnpm run grade fixtures/incremental/001-area --page output.wikitext --rule-based-only

# With vault path for citation verification
pnpm run grade fixtures/incremental/001-area --page output.wikitext --vault-path ~/.projectwiki/vault
```

#### Grade flags

| Flag | Description |
|------|-------------|
| `--page <file>` | Path to a single `.wikitext` file to grade. |
| `--pages <dir>` | Path to a directory of `.wikitext` files (classified by filename: `area.wikitext`, `talk.wikitext`, `drawing-*.wikitext`, etc.). |
| `--result <file>` | Path to a previous result JSON to re-grade. |
| `--graders <list>` | Comma-separated grader names to run (merges with existing scores from `--result`). |
| `--rule-based-only` | Skip LLM-assisted graders (completeness and citations only). No API key needed. |
| `--vault-path <path>` | Path to the vault for citation-based accuracy verification. |

### Comparing harnesses

Run the same fixture with different harnesses, then generate a comparison report:

```bash
pnpm run run --suite incremental --harness claude-code --model claude-opus-4-6
pnpm run run --suite incremental --harness codex --model gpt-5.3
pnpm run run --suite incremental --harness opencode --model claude-opus-4-6

pnpm run report results/
```

The report aggregates scores by harness/model/suite into a markdown table.

### Parallel batch runs

Run multiple harness/model combinations at once:

```bash
# All combos in parallel — each gets its own wiki on an auto-assigned port
pnpm run batch --suite incremental \
  --runs "claude-code:claude-opus-4-6,codex:gpt-5.3,opencode:claude-opus-4-6"

# Limit concurrency to 3 parallel runs
pnpm run batch --suite incremental --case 001-area --jobs 3 \
  --runs "claude-code:claude-opus-4-6,codex:gpt-5.2,codex:gpt-5.3,cursor"

# Model is optional (uses harness default)
pnpm run batch --suite incremental --runs "claude-code,codex,opencode"
```

Each run provisions its own isolated wiki and writes results independently to `results/`. A summary table is printed when all runs complete.

#### Batch flags

| Flag | Description |
|------|-------------|
| `--suite <name>` | **Required.** Suite to run. |
| `--runs <list>` | **Required.** Comma-separated `harness:model` pairs (model optional). |
| `--case <id>` | Run only this case. |
| `--jobs <n>` | Max parallel runs (default: all at once). |
| `--checkpoint-threshold <n>` | Override per-checkpoint gate score. |
| `--from-result <path>` | Resume all runs from a previous result JSON. |

### Output

Results are written to `results/` as JSON files named `<case-id>-<harness>-<timestamp>.json`. Each result contains:

- Per-checkpoint scores and pass/fail status
- Per-page wikitext and grader breakdown
- Composite score (weighted average across pages)
- Wall-clock duration
- Agent session transcript

The console output shows a score progression chart for incremental runs:

```
  Score progression:
     1. ingest       [######..............] 0.300  2m15s
     2. analyze      [##########..........] 0.512  8m42s
     3. cross-ref    [#############.......] 0.671  12m8s
     4. construction [###############.....] 0.745  6m33s
     5. verify       [################....] 0.812  4m17s
     6. review       [##################..] 0.891  3m45s
```

## Wiki isolation

The e2e runner reuses the desktop app's bundled resources (`desktop/resources/`):

- PHP 8.3 built-in server
- MediaWiki 1.43 with SQLite
- Extensions: Cite, CiteThisPage, ParserFunctions, Scribunto, TemplateData, TemplateStyles, TimedMediaHandler
- Custom namespaces: Drawing (100), Spec (102), Construction (104), Issue (106), Task (108)
- Templates: Verification, Verbatim, Infobox Area, Infobox Equipment, Infobox Drawing, Infobox Spec, Infobox Construction, Infobox Issue, Infobox Task
- Vector skin

Each run creates a temp directory with its own SQLite database, generates a `LocalSettings.php` matching the desktop config, imports templates, starts PHP's built-in server on a random port, and tears everything down in `finally`. No state leaks between runs.

Use `--external-wiki` to skip isolation and run against your live ProjectWiki instance instead (uses your existing `wai` credentials).

## Graders

Six graders score each page output on a 0–1 scale:

| Grader | Type | What it checks |
|---|---|---|
| **Completeness** | Rule-based | Lead paragraph, infobox, body sections, references, bibliography, categories |
| **Citations** | Rule-based | Template validity, required fields, uncited factual claims |
| **Editorial** | Rule-based | Encyclopedic tone, third-person voice, observations-before-interpretation protocol |
| **Reference** | Rule-based | Similarity to gold-standard reference pages (section headings, infobox fields, categories) |
| **Accuracy** | LLM-assisted | Factual claims verified against source documents via citation manifest; fabrications penalized 2x |
| **Cross-referencing** | LLM-assisted | Facts combining 2+ document types (drawings + specs, specs + RFIs, etc.) |

The composite score per page is the arithmetic mean of all non-skipped graders. The overall composite weights pages by role (configurable via `weights` in `case.json`).

## Fixtures

Fixtures define what an agent should produce and how to score it. Each fixture lives in its own directory under `fixtures/<suite>/<case-id>/`.

**Real fixtures are gitignored** because they contain project-specific contract documents. See `fixtures/examples/` for the format, or use `/create-fixture` in Claude Code to generate one interactively.

### Fixture structure

```
001-area/
├── case.json              # Test case definition (required)
└── references/            # Gold-standard reference pages for grading (optional)
    ├── area-03.wiki
    ├── talk-area-03.wiki
    ├── drawing-c-301.wiki
    └── spec-03-30-00.wiki
```

### case.json schema

The main fixture file defines the eval case, its data sources, and the checkpoint sequence.

```jsonc
{
  "id": "001-area",                // Unique case identifier
  "suite": "incremental",          // Suite name (matches parent directory)
  "description": "Build wiki...",  // Human-readable task description
  "pageType": "Area",              // "Area", "Equipment", "Drawing", "Spec"
  "subject": "Area 03 — Primary Clarifiers",  // Primary subject

  // Document sources — absolute paths on your machine
  "sources": [
    { "path": "/path/to/project/drawings/civil", "type": "drawings", "snapshotId": "" },
    { "path": "/path/to/project/specs", "type": "specs", "snapshotId": "" }
  ],

  // Map page titles to reference wikitext files (relative to fixture dir)
  "references": {
    "Area 03 — Primary Clarifiers": "references/area-03.wiki",
    "Talk:Area 03 — Primary Clarifiers": "references/talk-area-03.wiki",
    "Drawing:C-301": "references/drawing-c-301.wiki"
  },

  // Optional: override default content weights for composite scoring
  "weights": {
    "primary": 0.50,   // Main area page weight
    "equipment": 0.30,  // Equipment page weight
    "talk": 0.20        // Talk page weight
  },

  // Ordered checkpoint sequence
  "checkpoints": [
    {
      "id": "ingest",                       // Checkpoint identifier
      "description": "Task for agent...",    // Instructions given to the agent
      "sources": [{ ... }],                 // Documents to introduce at this step
      "grade": [                            // Pages to grade after this step
        { "pattern": "Drawing:*", "role": "drawing" }
      ],
      "threshold": 0.3,                     // Min score to proceed (optional)
      "skipReference": false,               // Skip reference grader (optional)
      "produceManifest": true               // Expect citation manifest (optional)
    }
  ]
}
```

### Source types

| Type | Description | Typical tools |
|------|-------------|---------------|
| `drawings` | Contract drawing PDFs/images | `pdftk`, image viewers |
| `specs` | Specification documents (PDF/Word) | `pdftotext`, `pandoc` |
| `rfis` | RFI documents with questions and responses | `pdftotext` |
| `submittals` | Manufacturer data, shop drawings | `pdftotext` |
| `geotech` | Geotechnical investigation reports | `pdftotext` |
| `field_directives` | Field directive documents | `pdftotext` |
| `change_orders` | Change order documents | `pdftotext` |

### Grade target roles

| Role | Graders applied | Description |
|------|----------------|-------------|
| `area` | completeness, citations, editorial, reference, cross-ref | Process area page |
| `equipment` | completeness, citations, editorial, reference, cross-ref | Equipment page |
| `drawing` | completeness, citations, editorial, reference | Drawing analysis page |
| `spec` | completeness, citations, editorial, reference | Specification section page |
| `construction` | completeness, citations, editorial, reference | RFI/submittal/field directive page |
| `issue` | completeness, editorial, reference | Project issue page |
| `talk` | completeness, editorial, reference | Talk/verification page |

### Creating fixtures

Use the Claude Code skill to create fixtures interactively:

```
/create-fixture
/create-fixture area
/create-fixture drawing
```

Or copy and modify the examples in `fixtures/examples/`.

## Project structure

```
src/
  index.ts              CLI entry point (grade | run | report)
  types.ts              Shared interfaces
  llm.ts                Anthropic SDK wrapper for LLM-assisted graders
  wiki.ts               Isolated MediaWiki instance lifecycle
  graders/              Six grader implementations + registry
  runner/
    grade.ts            Grade a wikitext file against a fixture
    e2e.ts              End-to-end: provision wiki + agent + grade
  harnesses/            Agent harness integrations (claude-code, codex, opencode)
  reporter.ts           Markdown/JSON result aggregation
fixtures/
  examples/             Example fixtures with synthetic data (committed)
    construction/       Construction project examples
  incremental/          Real fixtures with project data (gitignored)
test/                   Unit tests for rule-based graders
results/                Grading output (gitignored)
```

## Tests

```bash
pnpm tsx --test test/*.test.ts
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | For LLM graders | API key for accuracy, structure, and cross-ref graders |
| `WIKI_PORT` | No | Port for eval wiki (default: `8081`) |
