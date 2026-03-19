# evals

Evaluation toolkit for whoami.wiki editorial agents. Measures how well an AI agent can read personal archives (chat logs, photos, location history, transactions) and produce encyclopedic wiki pages following the [editorial guide](https://whoami.wiki/docs/editorial-guide).

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
pnpm run run --suite incremental --case 001-person --harness claude-code

# Specify a model
pnpm run run --suite incremental --case 001-person --harness claude-code --model claude-opus-4-6
```

Each run gets a clean wiki — no cross-contamination between runs.

#### Run flags

| Flag | Description |
|------|-------------|
| `--suite <name>` | **Required.** Suite to run (directory name under `fixtures/`). |
| `--harness <name>` | **Required.** Agent harness: `claude-code`, `codex`, or `opencode`. |
| `--case <id>` | Run only this case (matches `id` field in `case.json`). |
| `--model <name>` | Model to use (passed to the harness). |
| `--external-wiki` | Use your running whoami.wiki instance instead of spinning up an isolated one. Uses existing `wai` credentials. |
| `--inspect` | Pause after grading so you can browse the wiki before teardown. |
| `--checkpoint-threshold <n>` | Override the per-checkpoint gate score (default: from `case.json` or `0.7`). |
| `--from-result <path>` | Resume from a previous result JSON — restores all passing checkpoints and skips them. Useful for iterating on later checkpoints without re-running expensive early ones. |

#### What happens during a run

For incremental suite fixtures (the primary workflow):

1. **For each checkpoint** in the fixture's `checkpoints` array:
   - The agent receives the checkpoint description as a task prompt
   - New sources (if any) are introduced for the agent to snapshot
   - The agent reads/creates/updates wiki pages using `wai` commands
   - Target pages are discovered and graded against the configured graders
   - If the score falls below the checkpoint's `threshold`, the run stops early
2. **Results** are written to `results/<case-id>-<harness>-<timestamp>.json`
3. **The wiki is torn down** (unless `--inspect` is set)

#### Resuming from a previous run

The `--from-result` flag lets you skip checkpoints that already passed:

```bash
# First run — might take 30+ minutes for all 6 checkpoints
pnpm run run --suite incremental --case 001-person --harness claude-code

# Resume from checkpoint 4 onward (reuses pages from checkpoints 1-3)
pnpm run run --suite incremental --case 001-person --harness claude-code \
  --from-result results/001-person-claude-code-2026-03-19T10-30-00-000Z.json
```

The runner restores all wiki pages from passing checkpoints, re-snapshots sources into the vault, and picks up where it left off.

### Grading existing output

The `grade` command scores wikitext without running an agent:

```bash
# Grade a single page
pnpm run grade fixtures/incremental/001-person --page output.wikitext

# Grade a directory of pages (person.wikitext, talk.wikitext, etc.)
pnpm run grade fixtures/incremental/001-person --pages output/

# Re-grade a previous result with all graders
pnpm run grade fixtures/incremental/001-person --result results/001-person-claude-code-2026-03-19.json

# Re-grade only specific graders (merges with existing scores)
pnpm run grade fixtures/incremental/001-person --result results/001-person-claude-code-2026-03-19.json --graders accuracy,editorial

# Rule-based graders only (no API key needed)
pnpm run grade fixtures/incremental/001-person --page output.wikitext --rule-based-only

# With vault path for citation verification
pnpm run grade fixtures/incremental/001-person --page output.wikitext --vault-path ~/.whoami/vault
```

#### Grade flags

| Flag | Description |
|------|-------------|
| `--page <file>` | Path to a single `.wikitext` file to grade. |
| `--pages <dir>` | Path to a directory of `.wikitext` files (classified by filename: `person.wikitext`, `talk.wikitext`, `source-*.wikitext`, etc.). |
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
     1. survey      [######..............] 0.300  2m15s
     2. draft       [##########..........] 0.512  8m42s
     3. new-source  [#############.......] 0.671  12m8s
     4. episodes    [###############.....] 0.745  6m33s
     5. owner-input [################....] 0.812  4m17s
     6. verify      [##################..] 0.891  3m45s
```

## Wiki isolation

The e2e runner reuses the desktop app's bundled resources (`desktop/resources/`):

- PHP 8.3 built-in server
- MediaWiki 1.43 with SQLite
- Extensions: Cite, CiteThisPage, ParserFunctions, Scribunto, TemplateData, TemplateStyles, TimedMediaHandler
- Custom namespaces: Source (100), Task (102)
- Templates: Gap, Dialogue, Infobox person
- Vector skin

Each run creates a temp directory with its own SQLite database, generates a `LocalSettings.php` matching the desktop config, imports templates, starts PHP's built-in server on a random port, and tears everything down in `finally`. No state leaks between runs.

Use `--external-wiki` to skip isolation and run against your live whoami.wiki instance instead (uses your existing `wai` credentials).

## Graders

Six graders score each page output on a 0–1 scale:

| Grader | Type | What it checks |
|---|---|---|
| **Completeness** | Rule-based | Lead paragraph, infobox, body sections, references, bibliography, categories |
| **Citations** | Rule-based | Template validity, required fields, uncited factual claims |
| **Editorial** | Rule-based | Encyclopedic tone, third-person voice, no raw data dumps |
| **Reference** | Rule-based | Similarity to gold-standard reference pages (section headings, infobox fields, categories) |
| **Accuracy** | LLM-assisted | Factual claims verified against source data via citation manifest; fabrications penalized 2x |
| **Cross-referencing** | LLM-assisted | Facts combining 2+ source types |

The composite score per page is the arithmetic mean of all non-skipped graders. The overall composite weights pages by role (configurable via `weights` in `case.json`).

## Fixtures

Fixtures define what an agent should produce and how to score it. Each fixture lives in its own directory under `fixtures/<suite>/<case-id>/`.

**Real fixtures are gitignored** because they contain personal archive data. See `fixtures/examples/` for the format, or use `/create-fixture` in Claude Code to generate one interactively.

### Fixture structure

```
001-person/
├── case.json              # Test case definition (required)
├── owner-anecdotes.json   # Owner testimony for the owner-input checkpoint (optional)
└── references/            # Gold-standard reference pages for grading (optional)
    ├── subject-name.wiki
    └── talk-subject-name.wiki
```

### case.json schema

The main fixture file defines the eval case, its data sources, and the checkpoint sequence.

```jsonc
{
  "id": "001-person",              // Unique case identifier
  "suite": "incremental",          // Suite name (matches parent directory)
  "description": "Write a ...",    // Human-readable task description
  "pageType": "Person",            // "Person", "Episode", or "Project"
  "subject": "Alex Chen",          // Primary subject name

  // Data sources — absolute paths on your machine
  "sources": [
    { "path": "/path/to/archive/instagram", "type": "instagram", "snapshotId": "" }
  ],

  // Map page titles to reference wikitext files (relative to fixture dir)
  // Supports globs: "Source:Instagram/*" matches any Instagram source page
  "references": {
    "Alex Chen": "references/alex-chen.wiki",
    "Talk:Alex Chen": "references/talk-alex-chen.wiki"
  },

  // Optional: override default content weights for composite scoring
  "weights": {
    "primary": 0.85,   // Main content page weight
    "episodes": 0,      // Episode sub-page weight
    "talk": 0.15,       // Talk page weight
    "source": 0.2       // Source page fraction of overall composite
  },

  // Ordered checkpoint sequence
  "checkpoints": [
    {
      "id": "survey",                    // Checkpoint identifier
      "description": "Task for agent...",  // Instructions given to the agent
      "sources": [{ ... }],              // Sources to introduce at this step
      "grade": [                         // Pages to grade after this step
        { "pattern": "Source:*", "role": "source" }
      ],
      "threshold": 0.3,                  // Min score to proceed (optional)
      "skipReference": false,            // Skip reference grader (optional)
      "ownerInput": "owner-anecdotes.json", // Owner testimony file (optional)
      "produceManifest": true            // Expect citation manifest (optional)
    }
  ]
}
```

### owner-anecdotes.json

First-person testimony from the wiki owner, loaded at checkpoints that specify `"ownerInput"`.

```jsonc
{
  "speaker": "owner",
  "context": "Wiki owner providing personal memories about Alex Chen",
  "entries": [
    {
      "type": "anecdote",           // "anecdote", "context", or "correction"
      "content": "The story...",
      "topic": "First dinner",
      "conflicts_with": "..."       // Optional: notes source contradictions
    }
  ]
}
```

### Source types

| Type | Description | Typical tools |
|------|-------------|---------------|
| `instagram` | Instagram data export (JSON + media) | `jq` |
| `whatsapp` | WhatsApp chat export (SQLite) | `sqlite3` |
| `messages` | iMessage/SMS export | `sqlite3` |
| `photos` | Photo directory with EXIF data | `exiftool`, `jq` |
| `location` | Location history JSON | `jq` |
| `transactions` | Transaction CSV | `csvtool`, `awk` |
| `shazam` | Shazam history | `jq` |
| `uber_trips` | Uber/Lyft trip CSV | `csvtool` |
| `github` | Git repository | `git log`, `git diff` |
| `slack` | Slack workspace export | `jq` |

### Grade target roles

| Role | Graders applied | Description |
|------|----------------|-------------|
| `person` | completeness, citations, editorial, reference, cross-ref | Main person biography |
| `episode` | completeness, citations, editorial, reference, cross-ref | Event/trip narrative |
| `project` | completeness, citations, editorial, reference, cross-ref | Software project page |
| `talk` | completeness, editorial, reference | Editorial discussion page |
| `source` | completeness, reference | Data source documentation |

### Creating fixtures

Use the Claude Code skill to create fixtures interactively:

```
/create-fixture
/create-fixture person
/create-fixture episode
```

Or copy and modify the examples in `fixtures/examples/`.

## Project structure

```
src/
  index.ts              CLI entry point (grade | run | report)
  types.ts              Shared interfaces
  llm.ts                Anthropic SDK wrapper for LLM-assisted graders
  wiki.ts               Isolated MediaWiki instance lifecycle
  graders/              Five grader implementations + registry
  runner/
    grade.ts            Grade a wikitext file against a fixture
    e2e.ts              End-to-end: provision wiki + agent + grade
  harnesses/            Agent harness integrations (claude-code, codex, opencode)
  reporter.ts           Markdown/JSON result aggregation
fixtures/
  examples/             Example fixtures with synthetic data (committed)
  incremental/          Real fixtures with personal data (gitignored)
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
