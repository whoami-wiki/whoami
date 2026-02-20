# whoami-wiki

This is a personal encyclopedia documenting my life through
wiki pages.

## Sources
Sources can be listed with `wai source list`, which returns all
pages in the wiki's source namespace. Source pages have information about different primary sources of data available that can be used for editorial purposes. Each source page has a unique snapshot id in the infobox that can be used to look up their info in the vault

Source pages contain a **Querying** section with instructions for programmatic access to the vault (located in Application Support/whoami/vault) — SQL queries for databases, JSON parsing for exports, file lookup via snapshot hashes. Always read the relevant source page before attempting to extract data.

Use `wai snapshot <dir>` to snapshot a directory. It hashes files into `vault/objects/`, writes a manifest to `vault/snapshots/`, and creates a `Source:` wiki page. The vault is located at `~/Library/Application Support/whoami/vault` (configurable via `WAI_VAULT_PATH`).

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
      "path": "18455129814@s.whatsapp.net/0/0/00b35087-9f6e-4b37-8fd3-74caeece3ee7.jpg",
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
6. `wai task fail <id> -m "reason"` if the task can't be completed — e.g. missing sources, ambiguous scope, blocked by unanswered questions

Tasks may reference a source via the `source` field (e.g. `Source:WhatsApp Alice`). Always read the linked source page before starting work.

## Architecture
- MediaWiki instance at localhost:8080
- `wai` CLI provides read/write access (see `wai --help`)
- Pages are written in wikitext

## CLI Quick Reference
```bash
wai source list                   # list all sources
wai read "Page Name"              # read a page
wai search "query"                # full-text search
wai create "Page" -c "content"    # create new page
wai edit "Page" --old "x" --new "y"  # find-and-replace
wai edit "Page" --old "x" --new "y" --dry-run  # preview changes
wai edit "Page" --old "x" --new "y" --replace-all  # replace all occurrences
wai write "Page" -f draft.wiki    # overwrite page
wai upload photo.jpg              # upload a file
wai section list "Page"           # list sections
wai section read "Page" 3         # read a specific section
wai section update "Page" 3 -c "content"  # update a section
wai talk read "Page"              # read talk page
wai talk read "Page" --thread "Subject"   # read a specific thread
wai talk create "Page" -s "Subject" -c "content"
wai link "Page"                   # show links in/out
wai category                      # list all categories
wai changes                       # recent changes
wai place "query"                 # look up a place (Google Places)
wai snapshot <dir>                # snapshot a directory into the vault
wai snapshot <dir> --name "Name"  # snapshot with custom source page name
wai snapshot <dir> --dry-run      # preview without writing
wai task list                     # list pending tasks
wai task list --status done       # list tasks by status
wai task read 0001                # read a task
wai task create -m "description"  # create a new task
wai task create -m "msg" --source "Source:X"  # create with source ref
wai task claim 0001               # claim a pending task
wai task complete 0001 -m "output"  # complete a task
wai task fail 0001 -m "reason"    # fail a task
wai task requeue 0001             # requeue a failed task
```

## Workflow
1. User directs agent to write about a topic
2. Agent explores relevant sources
3. Agent drafts page, posts questions to talk page
4. User answers questions
5. Agent refines and publishes

## Conventions
- Use third person ("Jeremy visited..." not "I visited...")
- Link to people, places, events with [[wikilinks]]
- Pages use a lead paragraph followed by thematic/chronological sections
- Do NOT use {{Gap}} inline — post unknowns as individual talk page threads with {{Open}}/{{Closed}} status
- Use {{Blockquote}} for preserving authentic voice from sources
- **Source identifiers**: Person identifiers (WhatsApp JIDs, chat session Z_PKs, Facebook thread paths) go in `{{Cite source}}` entries in the `== Sources ==` section. Include snapshot ID, date range, and identifiers in the `note` field so future research can retrace queries. See the Vishhvak Srinivasan page for the canonical example.

## When working on a page
- Check Talk:PageName for any existing context or locks
- Post your intent before starting: "Working on chronology section"
- Post questions as you encounter gaps
- Remove your lock when done

## Putting It Together

A typical session might look like:
```
You: /write-page Coorg trip November 2012

Claude: I'll explore the relevant sources first.

[Spawns explore agent team]
→ Found 624 photos in /Photos/2012/coorg/
→ Date range: Nov 15-20, 2012
→ No GPS data, but filenames suggest: Abbey Falls,
   Raja's Seat, coffee plantation

[Checks wiki for existing page]
→ No page exists, creating new

[Spawns wiki-writer subagent with scoped sources]
→ Drafting page...
→ 3 gaps identified:
   - Who were the participants?
   - Which coffee plantation?
   - What was the occasion for the trip?

[Posts to Talk:Coorg Trip (2012)]

Draft ready. I've posted questions to the talk page.
The main uncertainties are around who you traveled with
and which specific plantation you visited.
```
