---
name: editorial-guide
description: Editorial standards, page conventions, citation system, and talk page structure for whoami.wiki. Use when writing, reviewing, or editing wiki pages.
user-invocable: false
---

# Editorial Guide

## Page types

### Person pages

**Namespace**: Main (e.g. `Jane Doe`)

Encyclopedic article about a person. Documentary voice: third person, past tense, factual. The person page is a hub that links out to episode pages.

**Lead paragraph**: Biographical identity first, relationship to wiki owner in one sentence, arc in one more. No statistics in the lead — save those for a dedicated section. No emotional framing.

> Jane Doe (born 3 May 1997) is a Berlin-based photographer and former classmate. She and the wiki owner exchanged 6,200 Instagram DMs between March 2021 and May 2022, the largest one-on-one thread in the archive. They connected over film photography, collaborated on a zine, and met in person in Berlin in November 2021. The conversation faded after Jane moved to Tokyo in early 2022.

**What belongs**: Biographical details, chronological arc (summarized not exhaustive), key statistics, links to episode pages, media embeds, source citations.

**What doesn't belong**: Full voice note transcriptions, raw research notes, detailed retellings of specific episodes (those get their own episode pages).

**Blockquote discipline**: Only quote when exact words matter more than the information — confessions, turning points, self-descriptions that can't be paraphrased without losing the voice. Let paraphrasing carry the rest.

**Episode references**: When the chronological arc mentions a story with its own episode page, summarize in one sentence and link out:

```wikitext
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

Integrate quotes grammatically into sentences. Save `{{Blockquote}}` for extended passages (2+ sentences) that need to stand alone.

## Talk page structure

Talk pages use these sections as needed, in this order. Omit any with no content.

1. **Active gaps** — open editorial questions marked `{{Open}}`
2. **Resolved** — closed questions marked `{{Closed}}`, corrected ones `{{Superseded}}`
3. **Editorial decisions** — choices about structure, scope, voice, what to include/exclude
4. **Infrastructure** — technical issues and their resolutions
5. **Agent log** — one entry per task: ID, date, what changed, link to task page
6. **Research notes** — index of raw research materials (what exists, where it is, which pages consumed it)
7. **Voice note transcriptions** — complete chronological index with inline audio embeds

### Active gaps

```wikitext
=== Birth year unknown ===
{{Open}}
Likely 1996-1998 based on contextual clues. Never stated directly in DMs.
Would require external source to confirm.
```

### Resolved

```wikitext
=== Did they meet in person? ===
{{Superseded}}
Previously resolved as one meeting (dinner, Nov 12).

{{Closed}}
Three meetings confirmed via WhatsApp thread (snapshot 3f0390a3...):
dinner (Nov 12), gallery opening (Nov 13), darkroom session (Nov 14).
```

### Agent log

```wikitext
=== Task:0008 — Initial page creation ===
2026-02-15. Created page from Instagram DM research (6,200 messages).
Posted 3 open gaps. See [[Task:0008]].
```

### What does NOT belong on talk pages

- Reader-facing content (goes on person/episode pages)
- Duplicate research indexes

## Citation system

Inline citations use `<ref>` tags rendered via `<references />` in a `== References ==` section. This is standard MediaWiki.

### Inline citation templates

**Cite message** — for text messages (DMs, chats):
```wikitext
<ref name="ig-2021-04-15">{{Cite message|snapshot=a1b2c3d4e5f6
|date=2021-04-15|thread=janedoe_12345|note=Family background exchange}}</ref>
```

**Cite voice note** — for voice note content:
```wikitext
<ref>{{Cite voice note|number=7|date=2021-06-03|speaker=Jane
|snapshot=a1b2c3d4e5f6|note=Darkroom discovery story}}</ref>
```

**Cite photo** — for facts derived from photos:
```wikitext
<ref>{{Cite photo|file=IMG_2847.jpg|hash=...|date=2021-05-20
|snapshot=a1b2c3d4e5f6|note=University ID confirming enrollment}}</ref>
```

**Cite video** — for video content:
```wikitext
<ref>{{Cite video|file=berlin_gallery_opening.mp4|date=2021-11-12
|snapshot=a1b2c3d4e5f6|note=Gallery opening footage}}</ref>
```

All templates include: **snapshot** (vault hash), **date**, **note** (human-readable description).

### Bibliography template

**Cite vault** — for the Bibliography section, describes full vault snapshots consulted:
```wikitext
{{Cite vault|type=messages|snapshot=a1b2c3d4e5f6
|timestamp=2021-03-01/2022-05-15|note=Instagram DM thread with Jane Doe}}
```

Additional fields: **type** (messages, photos, video, etc.), **timestamp** (date range).

### When to cite

**Always cite**: Biographical facts, direct quotes, specific event dates, statistics, claims corrected or disputed on the talk page.

**Don't need citations**: Broadly sourced observations, information already attributed inline with a date, episode page content drawn from a defined set of voice notes listed at the top.

### Named refs for reuse

```wikitext
Jane's mother is from Munich.<ref name="ig-2021-04-15" />
Her father works in Zurich.<ref name="ig-2021-05-02">
{{Cite message|snapshot=a1b2c3d4e5f6|date=2021-05-02
|thread=janedoe_12345|note=Family details, father in Zurich}}</ref>
She has a younger brother named Max.<ref name="ig-2021-04-15" />
```

### Page structure

Every person and episode page ends with:

```wikitext
== References ==
<references />

== Bibliography ==
{{Cite vault|type=messages|snapshot=a1b2c3d4e5f6
|timestamp=2021-03-01/2022-05-15|note=Instagram DM thread with Jane Doe}}
{{Cite vault|type=voice_notes|snapshot=b2c3d4e5f6a1
|timestamp=2021-04-12/2021-06-03|note=47 voice notes, Jane and wiki owner}}
```

**References** = inline citations tracing specific claims to specific moments in the vault.

**Bibliography** = full vault snapshots consulted for the page overall.

## Namespaces

| Namespace | Prefix | ID | Purpose |
|-----------|--------|----|---------|
| Main | (none) | 0 | Person and episode pages |
| Talk | `Talk:` | 1 | Editorial process and research notes |
| Source | `Source:` | 100 | Data source documentation |
| Task | `Task:` | 102 | Agent work logs |
