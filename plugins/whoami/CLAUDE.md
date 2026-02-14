# whoami-wiki

This is a personal encyclopedia documenting my life through
wiki pages.

## Sources
Sources can be listed with `wai source list`. Each source has a
path and description of what it contains.

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
- Use {{Infobox Trip}}, {{Infobox Person}} templates
- Add {{Gap}} for unknown information

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

[Spawns source-explorer subagent]
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
