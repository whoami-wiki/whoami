---
name: create-fixture
description: Create a new eval fixture for ProjectWiki from construction contract documents
triggers: ["create-fixture", "new fixture", "add fixture"]
user_invocable: true
---

# Create Fixture

Interactively create a new eval fixture for the ProjectWiki evaluation suite.

## Usage

`/create-fixture [page-type]`

Examples:
- `/create-fixture` — start interactive fixture creation
- `/create-fixture area` — create an area page fixture
- `/create-fixture drawing` — create a drawing analysis fixture
- `/create-fixture equipment` — create an equipment page fixture

## Steps

### 1. Determine page type

If no page type was provided as an argument, ask the user:

> What type of page is this fixture for?
> - **Area** — a process area or geographic zone of the project (e.g., primary clarifiers, headworks)
> - **Equipment** — a specific tagged equipment item (e.g., PS-301A)
> - **Drawing** — analysis of a contract drawing sheet
> - **Spec** — a specification section following CSI MasterFormat

### 2. Gather basic information

Ask the user for:

- **Subject name**: The primary subject (e.g., "Area 03 — Primary Clarifiers", "Drawing:C-301", "Spec:03 30 00")
- **Description**: One sentence describing the eval task
- **Suite name**: Which suite to place this in (default: `incremental`)

### 3. Identify document sources

Ask the user what contract documents they have available. For each source, collect:

- **Path**: Absolute path to the documents on their machine
- **Type**: One of: `drawings`, `specs`, `rfis`, `submittals`, `geotech`, `field_directives`, `change_orders`

Guide them based on page type:
- **Area**: Typically needs drawings (multiple disciplines) and specifications. RFIs and submittals add richness.
- **Equipment**: Typically needs drawings showing the equipment, specifications for the equipment type, and submittals with manufacturer data.
- **Drawing**: Typically needs the drawing PDF itself plus related specifications for cross-referencing.
- **Spec**: Typically needs the specification document plus related drawings and any RFIs that modify the section.

### 4. Design the checkpoint sequence

Based on the page type and available documents, design the checkpoint sequence. Use the examples in `evals/fixtures/examples/` as templates.

**Standard checkpoint patterns by page type:**

**Area:**
1. `ingest` — Ingest drawing volumes, create index entries
2. `analyze` — Analyze drawings, write initial area and drawing pages (skipReference: true)
3. `cross-ref` — Ingest specifications, cross-reference with drawings, update area page
4. `construction` — Process RFIs, submittals, update affected pages
5. `verify` — Verification cycle, check all pages against current documents
6. `review` — Final editorial review + citation manifest

**Equipment:**
1. `ingest` — Ingest relevant drawings and specs
2. `analyze` — Write equipment page from drawings and specs (skipReference: true)
3. `cross-ref` — Process submittals with manufacturer data, update equipment page
4. `verify` — Verification cycle
5. `review` — Final review + citation manifest

**Drawing:**
1. `ingest` — Ingest the drawing PDF
2. `analyze` — Analyze using observations-before-interpretation protocol (skipReference: true)
3. `cross-ref` — Cross-reference with specifications
4. `review` — Final review + citation manifest

For each checkpoint, set appropriate `grade` targets using the subject name and roles. Set `threshold: 0.3` on the ingest checkpoint.

### 5. Ask about reference pages

Ask:

> Do you want to write gold-standard reference pages for grading? These are optional — they let the reference grader compare the agent's output against an ideal version.
>
> You can:
> 1. **Skip for now** — the other graders (completeness, citations, editorial) still work without references
> 2. **Write them later** — run the eval once, review the agent's output, then refine it into a reference
> 3. **Write them now** — I'll help you draft reference pages following the editorial guide

If they want to write references now, help them draft wikitext pages following the editorial guide conventions. Save to the `references/` subdirectory and add entries to the `references` map in `case.json`.

### 6. Generate the fixture

Determine the next available case number by listing existing directories in `evals/fixtures/<suite>/`:

```bash
ls evals/fixtures/<suite>/
```

Use the next sequential number with zero-padding (e.g., `004-area`, `005-drawing`).

Create the fixture directory and write all files:

```
evals/fixtures/<suite>/<NNN-type>/
├── case.json
└── references/
    ├── <subject>.wiki      (if reference pages were written)
    └── talk-<subject>.wiki (if talk reference was written)
```

### 7. Validate

After writing the files:

1. Read back the `case.json` and verify it parses correctly
2. Check that all document source paths referenced in `case.json` exist on the user's machine
3. Check that all files referenced in `references` exist in the fixture directory
4. Confirm the fixture follows the TypeScript types in `evals/src/types.ts`

### 8. Summary

Print a summary:

```
Created fixture: evals/fixtures/<suite>/<case-id>/
  Page type: Area
  Subject: Area 03 — Primary Clarifiers
  Sources: drawings (civil, structural), specs
  Checkpoints: ingest → analyze → cross-ref → construction → verify → review
  References: yes/no

Run it with:
  cd evals && pnpm eval --suite <suite> --case <case-id> --harness claude-code
```

## Important notes

- Source paths must be **absolute paths** on the user's machine
- Fixture directories under `fixtures/incremental/` are gitignored — project documents stay local
- The `snapshotId` field in sources starts empty and is populated at runtime by `wai ingest`
- Reference file paths in `case.json` are relative to the fixture directory
- Use `slug-case` for reference filenames (e.g., `area-03.wiki`, `drawing-c-301.wiki`)
