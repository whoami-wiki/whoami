---
name: editorial-guide
description: Editorial standards, page conventions, citation system, and talk page structure for whoami.wiki. Use when writing, reviewing, or editing wiki pages.
user-invocable: false
---

# Editorial Guide

## Page types

### Person pages

**File**: `jane-doe.md` (one markdown file per page, slug-cased)

Encyclopedic article about a person. Documentary voice: third person, past tense, factual. The person page is a hub that links out to episode pages.

**Lead paragraph**: Biographical identity first, relationship to wiki owner in one sentence, arc in one more. No statistics in the lead — save those for a dedicated section. No emotional framing.

> Jane Doe (born 3 May 1997) is a Berlin-based photographer and former classmate. She and the wiki owner exchanged 6,200 Instagram DMs between March 2021 and May 2022, the largest one-on-one thread in the archive. They connected over film photography, collaborated on a zine, and met in person in Berlin in November 2021. The conversation faded after Jane moved to Tokyo in early 2022.

**What belongs**: Biographical details, chronological arc (summarized not exhaustive), key statistics, links to episode pages, media embeds, source citations.

**What doesn't belong**: Full voice note transcriptions, raw research notes, detailed retellings of specific episodes (those get their own episode pages).

**Blockquote discipline**: Only quote when exact words matter more than the information — confessions, turning points, self-descriptions that can't be paraphrased without losing the voice. Let paraphrasing carry the rest.

**Episode references**: When the chronological arc mentions a story with its own episode page, summarize in one sentence and link out:

```markdown
On 14 August, Jane described a disastrous shoot at Tempelhof
in a series of five voice notes (see [[Jane and the Tempelhof Disaster]]).
```

### Episode pages

**Naming**: `{Person} and the {Episode Title}` (e.g. `Jane and the Tempelhof Disaster`)

Self-contained page for a specific story, event, or extended narrative. More narrative latitude than person pages, but still third-person and factual. The storytelling comes from sequencing, detail, and well-chosen quotes — not from the writer's adjectives.

**Create when**: 3+ voice notes telling a connected story, or a sustained back-and-forth that would take more than two paragraphs to tell properly.

**What belongs**: Full contextual setup, the story with detail, all relevant voice note transcriptions inline, audio/video embeds, surrounding messages, links back to person page and related episodes.

**What it should feel like**: Reading one should feel like being shown a specific memory. Beginning, middle, end.

## Editorial standards

### Core principles

1. **One canonical home** — every piece of content lives in one place. Other pages link to it; they don't duplicate it.
2. **Prefer splitting to growing** — a story that takes more than two paragraphs deserves its own page.
3. **Documentary voice on person pages** — third person, past tense, factual. Like Wikipedia.
4. **Episode pages allow storytelling** — still third-person and factual, but more narrative.

### Don't interpret for the reader

- **Don't editorialize**: Replace adjectives with specifics. "They exchanged 1,800 messages in five days, averaging 360 per day" — not "The conversation density was staggering."
- **Don't inflate significance**: Cut "marking a pivotal turning point" and "reflecting a broader shift." If something is significant, facts demonstrate it without a caption.
- **Don't use promotional language**: No "vibrant," "rich," "renowned," "groundbreaking," "nestled," "showcases."
- **Don't attribute vaguely**: No "observers have noted" or "friends describe her as." Cite specific sources.

### Prose quality

- **Say "is" when you mean "is"**: Not "stands as" or "serves as."
- **Keep sentences short**: Split anything over ~40 words.
- **Vary rhythm**: Mix short and long sentences. Avoid the "rule of three" tic.
- **Use punctuation precisely**: Don't overuse em dashes as a Swiss Army knife.
- **Don't cycle through synonyms**: If you said "conversation," say "conversation" again.
- **Avoid formulaic transitions**: Cut "moreover," "furthermore," "notably," "additionally."
- **Don't frame by negation**: State what something is, not what it isn't.
- **Don't end sections with summaries**: No "In summary," "Overall," "In conclusion."

For the full words-to-watch list, see [words-to-watch.md](words-to-watch.md).

### Quoting conventions

Use direct quotes when:
- The exact words matter (confessions, self-descriptions, turning points)
- The phrasing is distinctive and can't be paraphrased without losing character
- The quote is short (under ~30 words)

Don't quote:
- Routine factual statements that can be paraphrased
- Three quotes in a row saying similar things
- To show off the archive

Integrate quotes grammatically into sentences. Save the `:::blockquote` directive for extended passages (2+ sentences) that need to stand alone.

## Talk page structure

Talk pages live alongside the page they discuss as `<slug>.talk.md` (e.g. `jane-doe.talk.md` next to `jane-doe.md`). They use these sections as needed, in this order. Omit any with no content.

1. **Active gaps** — open editorial questions marked with the `::open` admonition
2. **Resolved** — closed questions marked `::closed`, corrected ones `::superseded`
3. **Editorial decisions** — choices about structure, scope, voice, what to include/exclude
4. **Infrastructure** — technical issues and their resolutions
5. **Agent log** — one entry per task: ID, date, what changed, link to task page
6. **Research notes** — index of raw research materials (what exists, where it is, which pages consumed it)
7. **Voice note transcriptions** — complete chronological index with inline audio embeds

### Active gaps

```markdown
### Birth year unknown

::open

Likely 1996-1998 based on contextual clues. Never stated directly in DMs.
Would require external source to confirm.
```

### Resolved

```markdown
### Did they meet in person?

::superseded

Previously resolved as one meeting (dinner, Nov 12).

::closed

Three meetings confirmed via WhatsApp thread (snapshot 3f0390a3...):
dinner (Nov 12), gallery opening (Nov 13), darkroom session (Nov 14).
```

### Agent log

```markdown
### Task:0008 — Initial page creation

2026-02-15. Created page from Instagram DM research (6,200 messages).
Posted 3 open gaps. See [[Task:0008]].
```

### What does NOT belong on talk pages

- Reader-facing content (goes on person/episode pages)
- Duplicate research indexes

## Citation system

Inline citations use markdown footnote syntax (`text[^id]` in the body, `[^id]: ...` definitions at the bottom of the page under a `## References` heading). Each footnote definition wraps a `:::cite-*` directive describing the source.

### Inline citation templates

**cite-message** — for text messages (DMs, chats):
```markdown
Jane's mother is from Munich.[^ig-2021-04-15]

[^ig-2021-04-15]: ::cite-message{snapshot=a1b2c3d4e5f6 date=2021-04-15 thread=janedoe_12345 note="Family background exchange"}
```

**cite-voice-note** — for voice note content:
```markdown
She first picked up a film camera in art class.[^vn-7]

[^vn-7]: ::cite-voice-note{number=7 date=2021-06-03 speaker=Jane snapshot=a1b2c3d4e5f6 note="Darkroom discovery story"}
```

**cite-photo** — for facts derived from photos:
```markdown
Jane enrolled at UdK in 2019.[^uni-id]

[^uni-id]: ::cite-photo{file=IMG_2847.jpg hash=... date=2021-05-20 snapshot=a1b2c3d4e5f6 note="University ID confirming enrollment"}
```

**cite-video** — for video content:
```markdown
The gallery opening drew about forty people.[^gallery-vid]

[^gallery-vid]: ::cite-video{file=berlin_gallery_opening.mp4 date=2021-11-12 snapshot=a1b2c3d4e5f6 note="Gallery opening footage"}
```

All templates include: **snapshot** (vault hash), **date**, **note** (human-readable description).

### Directive syntax

**Directive shapes**: use `::name{attrs}` (single colon-pair, single line) for leaf directives that carry only attributes — citations (`::cite-vault`, `::cite-message`, `::cite-voice-note`, `::cite-photo`, `::cite-video`), admonitions (`::open`, `::closed`, `::superseded`, `::gap`). Use `:::name{attrs}` opening on its own line, body content on subsequent lines, and `:::` close on its own line for container directives that have a body — infoboxes, blockquotes, dialogue, columns-list. The one-line `:::name{...}:::` shape is invalid and won't render or be picked up by the eval graders.

### Bibliography template

**cite-vault** — for the Bibliography section, describes full vault snapshots consulted:
```markdown
::cite-vault{type=messages snapshot=a1b2c3d4e5f6 timestamp="2021-03-01/2022-05-15" note="Instagram DM thread with Jane Doe"}
```

Additional fields: **type** (messages, photos, video, etc.), **timestamp** (date range).

### When to cite

**Always cite**: Biographical facts, direct quotes, specific event dates, statistics, claims corrected or disputed on the talk page.

**Don't need citations**: Broadly sourced observations, information already attributed inline with a date, episode page content drawn from a defined set of voice notes listed at the top.

### Reusing footnotes

A single footnote definition can be referenced multiple times in the body — just repeat the `[^id]` marker:

```markdown
Jane's mother is from Munich.[^ig-2021-04-15]
Her father works in Zurich.[^ig-2021-05-02]
She has a younger brother named Max.[^ig-2021-04-15]

[^ig-2021-04-15]: ::cite-message{snapshot=a1b2c3d4e5f6 date=2021-04-15 thread=janedoe_12345 note="Family background exchange"}
[^ig-2021-05-02]: ::cite-message{snapshot=a1b2c3d4e5f6 date=2021-05-02 thread=janedoe_12345 note="Family details, father in Zurich"}
```

### Page structure

Every person and episode page ends with:

```markdown
## References

[^ig-2021-04-15]: ::cite-message{snapshot=a1b2c3d4e5f6 date=2021-04-15 thread=janedoe_12345 note="Family background exchange"}
[^vn-7]: ::cite-voice-note{number=7 date=2021-06-03 speaker=Jane snapshot=a1b2c3d4e5f6 note="Darkroom discovery story"}

## Bibliography

::cite-vault{type=messages snapshot=a1b2c3d4e5f6 timestamp="2021-03-01/2022-05-15" note="Instagram DM thread with Jane Doe"}
::cite-vault{type=voice_notes snapshot=b2c3d4e5f6a1 timestamp="2021-04-12/2021-06-03" note="47 voice notes, Jane and wiki owner"}
```

**References** = inline citations tracing specific claims to specific moments in the vault.

**Bibliography** = full vault snapshots consulted for the page overall.

## Page conventions

The wiki is a tree of markdown files on git. Page kind is encoded in the filename, not a namespace prefix.

| Kind | Filename pattern | Purpose |
|------|------------------|---------|
| Person / episode | `<slug>.md` | Person and episode pages |
| Talk | `<slug>.talk.md` | Editorial process and research notes for the matching page |
| Source | `source/<slug>.md` | Data source documentation |
| Task | `task/<slug>.md` | Agent work logs |

### Redirects

Redirects are not separate pages. Add an `aliases:` field to the target page's frontmatter listing every name that should resolve to it:

```markdown
---
title: Jane Doe
aliases:
  - Jane
  - Jane D.
---
```

### Other directives

- `:::infobox-person` for biographical infoboxes (fields like `name`, `birth`, `birthPlace`)
- `:::blockquote{by="Person"}` for extended quoted passages
- `:::dialogue{speaker="Jane"}` for transcribed exchanges
- `:::columns-list{cols="2"}` for multi-column lists
- `::gap` as a leaf admonition for inline gap markers (use sparingly — prefer talk page threads)

Images use standard markdown: `![caption](/assets/photo.jpg)`. Headings use `## Heading` / `### Subheading` (not `==Heading==`). Emphasis uses `**bold**` and `*italic*` (not `'''bold'''` / `''italic''`). Wikilinks `[[Page]]`, `[[Page|alt]]`, and `[[Page#Section]]` are preserved by the renderer.
