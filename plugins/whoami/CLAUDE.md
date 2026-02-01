# whoami-wiki

This is a personal encyclopedia documenting my life through 
wiki pages.

## Sources
Sources can be retrieved from the MCP server. Each source has a path 
and description of what it contains.

## Architecture  
- MediaWiki instance at localhost:8080
- MCP server provides read/write access
- Pages are written in wikitext

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
```

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
