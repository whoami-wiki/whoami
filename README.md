# ProjectWiki

A construction project management wiki built on [MediaWiki](https://www.mediawiki.org/wiki/MediaWiki). AI agents analyze contract documents — drawings, specifications, RFIs, submittals — and produce structured, interlinked wiki pages with full source traceability.

## How it works

1. **Ingest documents** — Point the agent at PDF volumes (drawings, specs). It splits, catalogs, and queues them for analysis.
2. **Agent analyzes** — Each drawing or spec is analyzed following a structured protocol and turned into wiki pages with citations back to specific documents, paragraphs, and details.
3. **Track changes** — As RFIs, submittals, and field directives arrive, the agent updates affected pages and maintains a traceability chain showing how information evolved.
4. **Verify** — Periodic verification cycles check that wiki content matches current document revisions and flag stale information.

## Architecture

```
desktop/          Electron app — bundles MediaWiki, PHP, templates, and setup wizard
cli/              `wai` command-line tool — page editing, document ingestion, task queue
evals/            Evaluation suite — graders, harnesses, fixtures, reference pages
plugins/          Agent harness plugins (Claude Code, Codex, OpenCode)
web/              Documentation website (Next.js)
```

### Key concepts

- **Every fact has a citation** — dimensions, elevations, material specs all trace back to a specific drawing, spec paragraph, or construction document
- **Talk pages track confidence** — each page has a verification status and lists active gaps where information is uncertain or missing
- **Issues are project-level** — drawing conflicts, spec ambiguities, and risk items are tracked as Issue pages
- **Change traceability** — when an RFI modifies a spec requirement, the chain (original spec → RFI response → updated page) is preserved with citations at each link

## Namespaces

| Namespace | Prefix | ID | Purpose |
|---|---|---|---|
| Main | (none) | 0 | Area pages, equipment pages, project-level content |
| Talk | `Talk:` | 1 | Verification status, active gaps, coordination, agent log |
| Drawing | `Drawing:` | 100 | Drawing analysis pages (one per sheet) |
| Spec | `Spec:` | 102 | Specification section pages (CSI MasterFormat) |
| Construction | `Construction:` | 104 | RFIs, submittals, field directives, change orders |
| Issue | `Issue:` | 106 | Conflicts, ambiguities, risk items |
| Task | `Task:` | 108 | Agent work logs |

## Page types

| Type | Example | Description |
|---|---|---|
| **Area** | `Area 03 — Primary Clarifiers` | Process area with discipline sections, connected systems, citations |
| **Equipment** | `PS-301A` | Equipment page with design parameters, location, controls |
| **Drawing** | `Drawing:C-301` | Title block, observations, dimensions, cross-references, interpretation |
| **Spec** | `Spec:03 30 00` | CSI Part 1/2/3 structure, verbatim contract language, submittal requirements |
| **Construction doc** | `Construction:RFI-042` | Question/response, traceability, pages updated |
| **Issue** | `Issue:003` | Description, impact, recommended action, resolution |

## CLI quick reference

```bash
# Document navigation
wai drawing list --discipline Civil
wai drawing read C-301
wai spec read "03 30 00"
wai spec paragraph "03 30 00" "2.1.A"

# Construction documents
wai construction list --type RFI --status Open
wai construction add --type RFI --subject "Wall reinforcement conflict"
wai construction update RFI-042 --status Closed

# Issues
wai issue list --status open --severity high
wai issue add --type "Drawing Conflict" --severity High --area "Area 03"
wai issue resolve 003 --resolution "RFI-042 response clarifies"

# Verification
wai verify "Area 03 — Primary Clarifiers"
wai verify --all

# Project overview
wai project status
wai project precedence

# Document ingestion
wai ingest volume pages/ --type drawings --name "Volume 3"
wai ingest status
wai ingest analyze "Volume 3" --limit 10

# Standard wiki operations
wai read "Page Name"
wai create "Page" -c "content"
wai edit "Page" --old "old text" --new "new text"
wai search "query"
wai task list
```

## Getting started

### Desktop app

Download and install the desktop app. On first launch, the setup wizard creates a fresh MediaWiki instance with all construction templates and namespaces pre-configured.

When setting up a construction project, the wizard creates:
- **Project Standards** page (populated from Division 01 specs)
- **Submittal Log** (populated as specs are analyzed)
- **Drawing Index** (populated as drawings are analyzed)

### Document ingestion

Split PDF volumes into individual pages, then catalog and analyze:

```bash
# Split a volume using pdftk
pdftk volume3.pdf burst output pages/page_%03d.pdf

# Catalog the volume
wai ingest volume pages/ --type drawings --name "Volume 3"

# Review the manifest, then queue analysis
wai ingest analyze "Volume 3"
```

### Agent harness

Install the plugin for your agent harness (Claude Code, Codex, or OpenCode) to give AI agents read/write access to the wiki via `wai` commands. See the [documentation](web/content/docs/) for setup instructions.

## Templates

### Infoboxes
`Infobox area`, `Infobox equipment`, `Infobox system`, `Infobox drawing`, `Infobox spec`, `Infobox construction`, `Infobox issue`

### Citations
`Cite drawing`, `Cite spec`, `Cite rfi`, `Cite submittal`, `Cite document`, `Cite field`

### Utilities
`Verbatim` (contract language blocks), `Verification` (status banners), `Superseded` (talk page badges)

## Evaluation suite

The `evals/` directory contains an automated evaluation framework for testing agent performance on construction document analysis. Graders measure completeness, citation quality, editorial standards, and accuracy across all page types.

```bash
cd evals
pnpm install
pnpm tsx --test test/*.test.ts
```

## License

MIT — see [LICENSE.md](LICENSE.md).
