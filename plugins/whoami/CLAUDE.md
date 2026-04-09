# projectwiki

This is a construction project encyclopedia documenting a project through
wiki pages built from contract documents.

## Sources
Documents can be ingested with `wai ingest volume <dir> --type <type> --name "<name>"`, which hashes files into `vault/objects/`, writes a manifest to `vault/snapshots/`, and creates index entries for analysis. The vault is located at `~/Library/Application Support/projectwiki/vault` (configurable via `WAI_VAULT_PATH`).

Structure of the vault:
- objects/
  - 00/
    - 00b9da...350b19
  - 01/
  - ...
- snapshots/
  - 8af96b7a06247676.json

Structure of snapshot.json:

```
{
  "files": [
    {
      "path": "drawings/civil/C-301.pdf",
      "hash": "9b980e25709b348676c2f32b261135b141568d1c45e7dc5a9fd78e17679ea0da"
    },
    ...
  ],
}
```

## Tasks

Tasks are first-class wiki pages in the `Task:` namespace. Each task page has an `{{Infobox Task}}` template with metadata (id, status, source, timestamps) and a description body. Tasks are categorized by status: `[[Category:Pending tasks]]`, `[[Category:In-progress tasks]]`, `[[Category:Done tasks]]`, `[[Category:Failed tasks]]`.

**Lifecycle**: pending → in-progress → done/failed. Failed tasks can be requeued back to pending.

When working from the task queue:
1. `wai task list` to see pending tasks
2. `wai task read <id>` to understand what's needed
3. `wai task claim <id>` to mark it in-progress before starting
4. Do the work (follow the normal workflow below)
5. `wai task complete <id> -m "summary of what was done"` on success
6. `wai task fail <id> -m "reason"` if the task can't be completed — e.g. missing documents, ambiguous scope, blocked by unanswered questions

Tasks may reference a document volume. Always review available documents before starting work.

## Architecture
- MediaWiki instance at localhost:8080
- `wai` CLI provides read/write access (see `wai --help`)
- Pages are written in wikitext

## CLI Quick Reference
```bash
wai read "Page Name"              # read a page
wai search "query"                # full-text search
wai create "Page" -c "content"    # create new page
wai edit "Page" --old "x" --new "y"  # find-and-replace
wai edit "Page" --old "x" --new "y" --dry-run  # preview changes
wai edit "Page" --old "x" --new "y" --replace-all  # replace all occurrences
wai write "Page" -f draft.wiki    # overwrite page
wai upload drawing.pdf            # upload a file
wai section list "Page"           # list sections
wai section read "Page" 3         # read a specific section
wai section update "Page" 3 -c "content"  # update a section
wai talk read "Page"              # read talk page
wai talk read "Page" --thread "Subject"   # read a specific thread
wai talk create "Page" -s "Subject" -c "content"
wai link "Page"                   # show links in/out
wai category                      # list all categories
wai changes                       # recent changes
wai ingest volume <dir> --type <type> --name "Name"  # ingest documents
wai ingest analyze "Volume Name"  # queue volume for analysis
wai verify --all                  # verify all pages
wai issue list                    # list open issues
wai issue read 003                # read an issue
wai task list                     # list pending tasks
wai task list --status done       # list tasks by status
wai task read 0001                # read a task
wai task create -m "description"  # create a new task
wai task claim 0001               # claim a pending task
wai task complete 0001 -m "output"  # complete a task
wai task fail 0001 -m "reason"    # fail a task
wai task requeue 0001             # requeue a failed task
```

## Workflow
1. User directs agent to analyze documents or build pages for a process area
2. Agent ingests and analyzes relevant contract documents
3. Agent drafts pages, posts gaps and coordination issues to talk pages
4. User reviews and provides additional context
5. Agent refines and publishes

## Conventions
- Use third person, present tense for design parameters ("The clarifier receives..."), past tense for construction events
- Link to areas, equipment, drawings, and specs with [[wikilinks]]
- Pages use a lead paragraph followed by discipline-organized or thematic sections
- Follow the observations-before-interpretation protocol for drawing analysis
- Use {{Verbatim}} for contractually significant specification language
- Post unknowns as individual talk page threads with {{Open}}/{{Closed}} status
- Include {{Verification}} template on talk pages with verification status

## When working on a page
- Check Talk:PageName for verification status and active gaps
- Post your intent before starting: "Working on structural section"
- Post coordination issues and gaps as you encounter them
- Update the verification status when done

## Namespaces

| Namespace | Prefix | ID | Purpose |
|-----------|--------|----|---------|
| Main | (none) | 0 | Area pages, equipment pages, project content |
| Talk | `Talk:` | 1 | Verification status, gaps, coordination |
| Drawing | `Drawing:` | 100 | Drawing analysis pages |
| Spec | `Spec:` | 102 | Specification section pages |
| Construction | `Construction:` | 104 | RFIs, submittals, field directives |
| Issue | `Issue:` | 106 | Conflicts, ambiguities, risk items |
| Task | `Task:` | 108 | Agent work logs |
