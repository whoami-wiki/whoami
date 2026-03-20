---
name: create-fixture
description: Create a new eval fixture for whoami.wiki from the user's personal archive data
triggers: ["create-fixture", "new fixture", "add fixture"]
user_invocable: true
---

# Create Fixture

Interactively create a new eval fixture for the whoami.wiki evaluation suite.

## Usage

`/create-fixture [page-type]`

Examples:
- `/create-fixture` — start interactive fixture creation
- `/create-fixture person` — create a person page fixture
- `/create-fixture episode` — create an episode page fixture
- `/create-fixture project` — create a project page fixture

## Steps

### 1. Determine page type

If no page type was provided as an argument, ask the user:

> What type of page is this fixture for?
> - **Person** — a biography of someone in your archive (friend, family, colleague)
> - **Episode** — a specific event, trip, or milestone
> - **Project** — a software project, creative work, or collaborative effort

### 2. Gather basic information

Ask the user for:

- **Subject name**: The primary subject (e.g., "Sarah Kim", "Tokyo trip", "Raycast plugin")
- **Description**: One sentence describing the eval task
- **Suite name**: Which suite to place this in (default: `incremental`)

### 3. Identify data sources

Ask the user what archive data they have available for this subject. For each source, collect:

- **Path**: Absolute path to the data on their machine
- **Type**: One of: `instagram`, `whatsapp`, `messages`, `photos`, `location`, `transactions`, `shazam`, `uber_trips`, `github`, `slack`

Guide them based on page type:
- **Person**: Typically needs messaging sources (instagram, whatsapp, messages). Photos are a bonus.
- **Episode**: Typically needs photos, location history, and messages. Transactions and transport data add richness.
- **Project**: Typically needs a git repository and communication data (slack, messages).

### 4. Design the checkpoint sequence

Based on the page type and available sources, design the checkpoint sequence. Use the examples in `evals/fixtures/examples/` as templates.

**Standard checkpoint patterns by page type:**

**Person:**
1. `survey` — Snapshot first source, create source page
2. `draft` — Write initial person page from first source (skipReference: true)
3. `new-source` — Add remaining sources, revise page
4. `episodes` — Create episode sub-pages for rich events
5. `owner-input` — Integrate owner testimony (if anecdotes provided)
6. `verify` — Final review + citation manifest

**Episode:**
1. `survey` — Snapshot photos/location, create source pages
2. `draft` — Write day-by-day itinerary from spatial data (skipReference: true)
3. `new-source` — Add messages/transactions, weave into narrative
4. `persons` — Create person stubs for trip participants
5. `owner-input` — Integrate owner memories (if anecdotes provided)
6. `verify` — Final review + citation manifest

**Project:**
1. `survey` — Snapshot git repo, create source page
2. `draft` — Write project page from code/commits (skipReference: true)
3. `new-source` — Add Slack/messages, integrate collaboration context
4. `episodes` — Create episode pages for key development moments
5. `verify` — Final review + citation manifest

For each checkpoint, set appropriate `grade` targets using the subject name and roles. Set `threshold: 0.3` on the survey checkpoint.

### 5. Ask about owner anecdotes

Ask:

> Do you have personal memories or corrections about this subject that you'd like the agent to incorporate? These are things the digital sources can't capture — personal stories, context, corrections to what the data shows.

If yes, collect entries interactively. For each entry ask:
- What's the memory or correction?
- What topic does it relate to?
- Does it contradict anything in the digital sources?

Write these to `owner-anecdotes.json` in the fixture directory.

### 6. Ask about reference pages

Ask:

> Do you want to write gold-standard reference pages for grading? These are optional — they let the reference grader compare the agent's output against an ideal version.
>
> You can:
> 1. **Skip for now** — the other graders (completeness, citations, editorial) still work without references
> 2. **Write them later** — run the eval once, review the agent's output, then refine it into a reference
> 3. **Write them now** — I'll help you draft reference pages following the editorial guide

If they want to write references now, help them draft wikitext pages following the editorial guide conventions. Save to the `references/` subdirectory and add entries to the `references` map in `case.json`.

### 7. Generate the fixture

Determine the next available case number by listing existing directories in `evals/fixtures/<suite>/`:

```bash
ls evals/fixtures/<suite>/
```

Use the next sequential number with zero-padding (e.g., `004-person`, `005-trip`).

Create the fixture directory and write all files:

```
evals/fixtures/<suite>/<NNN-type>/
├── case.json
├── owner-anecdotes.json    (if anecdotes were provided)
└── references/
    ├── <subject>.wiki      (if reference pages were written)
    └── talk-<subject>.wiki (if talk reference was written)
```

### 8. Validate

After writing the files:

1. Read back the `case.json` and verify it parses correctly
2. Check that all source paths referenced in `case.json` exist on the user's machine
3. Check that all files referenced in `references` and `ownerInput` exist in the fixture directory
4. Confirm the fixture follows the TypeScript types in `evals/src/types.ts`

### 9. Summary

Print a summary:

```
Created fixture: evals/fixtures/<suite>/<case-id>/
  Page type: Person
  Subject: Sarah Kim
  Sources: instagram, whatsapp
  Checkpoints: survey → draft → new-source → episodes → owner-input → verify
  References: yes/no
  Owner anecdotes: 4 entries

Run it with:
  cd evals && pnpm eval --suite <suite> --case <case-id> --harness claude-code
```

## Important notes

- Source paths must be **absolute paths** on the user's machine
- Fixture directories under `fixtures/incremental/` are gitignored — personal data stays local
- The `snapshotId` field in sources starts empty and is populated at runtime by `wai snapshot`
- Reference file paths in `case.json` are relative to the fixture directory
- Use `slug-case` for reference filenames (e.g., `alex-chen.wiki`, `talk-alex-chen.wiki`)
