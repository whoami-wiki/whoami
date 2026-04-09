---
name: editorial-guide
description: Editorial standards, page conventions, citation system, and talk page structure for ProjectWiki. Use when writing, reviewing, or editing wiki pages.
user-invocable: false
---

# Editorial Guide

## Page types

### Area pages

**Namespace**: Main (e.g. `Area 03 — Primary Clarifiers`)

Encyclopedic article about a process area or geographic zone of the project. Documentary voice: third person, present tense for design parameters. The area page is a hub linking drawings, specifications, equipment, and construction documents.

**Lead paragraph**: What the area is, its function, key dimensions. No document lists in the lead — save those for discipline sections.

> Area 03 encompasses the primary clarifier complex consisting of four 120-foot diameter circular clarifiers with associated sludge collection and scum removal systems. The clarifiers receive raw wastewater from the headworks via a 48-inch reinforced concrete influent pipe.

**Standard sections**: Discipline sections (Structural, Mechanical, Electrical, I&C, Civil) — at least two, Connected Systems, Construction Requirements, References, Bibliography.

**What belongs**: Design parameters with citations to specific drawings and spec paragraphs, cross-references to equipment, drawing, and spec pages, construction sequencing requirements.

**What doesn't belong**: Full drawing analyses (those get their own Drawing: pages), raw specification text without context (use `{{Verbatim}}` blocks sparingly for contractually significant language).

### Equipment pages

**Namespace**: Main (e.g. `PS-301A`)

A page for a specific piece of equipment identified by its tag number. Includes design parameters, location, electrical, controls, and submittal status.

**Key fields**: tag number, capacity/design parameters, area link, spec section link, submittal status.

### Drawing pages

**Namespace**: Drawing (e.g. `Drawing:C-301`)

Structured analysis of a single contract drawing following the observations-before-interpretation protocol.

**Standard sections**:
1. Title Block — tabulated drawing metadata
2. Observations — physical observations without interpretation
3. Dimensions and Elevations — tabulated key measurements
4. Material and Specification Callouts — materials referenced
5. Cross-References — links to other drawings with verification status
6. Annotations and Notes — general notes and special instructions
7. Engineering Interpretation — analysis and significance (only after observations)

**Key principle**: Observations come before interpretation. Record what you see on the drawing before analyzing what it means.

### Spec pages

**Namespace**: Spec (e.g. `Spec:03 30 00`)

Specification section page following CSI MasterFormat numbering. Preserves Part 1/2/3 structure.

**Standard sections**: Part 1 — General, Part 2 — Products, Part 3 — Execution, Active Modifications.

**Key features**: Paragraph numbering preserved, `{{Verbatim}}` blocks for exact contract language, submittal requirements extracted and linked to Submittal Log.

### Construction document pages

**Namespace**: Construction (e.g. `Construction:RFI-042`)

Unified page type for RFIs, submittals, field directives, change orders. The infobox `type` field distinguishes document types.

**Standard sections by type**:
- **RFI**: Question, Response, Pages Updated
- **Submittal**: Submittal Contents, Review Comments, Pages Updated
- **Field Directive**: Directive, Pages Updated

**Pages Updated** is critical — it records which wiki pages were modified, maintaining the traceability chain.

### Issue pages

**Namespace**: Issue (e.g. `Issue:003`)

Project-level issue tracking drawing conflicts, spec ambiguities, missing information, or risk items.

**Standard sections**: Description, Impact, Recommended Action, Resolution.
**Severity levels**: Critical, High, Moderate, Low.

## Editorial standards

### Core principles

1. **One canonical home** — every piece of content lives in one place. Other pages link to it; they don't duplicate it.
2. **Prefer splitting to growing** — an equipment item needing more than two paragraphs deserves its own page.
3. **Documentary voice on area pages** — third person, present tense for design, past tense for construction events.
4. **Observations before interpretation on drawing pages** — record what you see before analyzing what it means.

### Don't interpret for the reader

- **Don't editorialize**: Replace adjectives with specifics. "The foundation requires 47 reinforcement details across 12 sheets" — not "The foundation design is extraordinarily complex."
- **Don't inflate significance**: Cut "marking a pivotal phase" and "reflecting a broader design philosophy." Facts demonstrate significance.
- **Don't use promotional language**: No "state-of-the-art," "innovative," "world-class," "cutting-edge."
- **Don't attribute vaguely**: No "industry standards require" or "best practices suggest." Cite specific spec paragraphs.

### Prose quality

- **Say "is" when you mean "is"**: Not "stands as" or "serves as."
- **Keep sentences short**: Split anything over ~40 words.
- **Vary rhythm**: Mix short and long sentences.
- **Use punctuation precisely**: Don't overuse em dashes.
- **Don't cycle through synonyms**: If you said "clarifier," say "clarifier" again.
- **Avoid formulaic transitions**: Cut "moreover," "furthermore," "notably."
- **Don't end sections with summaries**: No "In summary," "Overall," "In conclusion."

### Quoting conventions

Use `{{Verbatim}}` blocks when:
- The exact contract language matters (scope definitions, performance criteria, warranty terms)
- The phrasing has contractual significance and can't be paraphrased without losing meaning
- The language may be relevant to change order or claim arguments

Don't use verbatim blocks for:
- Routine procedural statements that can be paraphrased
- Three blocks in a row saying similar things
- General requirements that are standard across projects

## Talk page structure

Talk pages use these sections as needed, in this order. Omit any with no content.

1. **Verification status** — `{{Verification}}` template with status (complete, in-progress, not-started), last verified date, and source documents
2. **Active gaps** — open questions marked `{{Open}}` that need resolution
3. **Resolved** — closed items marked `{{Closed}}`, corrected ones `{{Superseded}}`
4. **Coordination issues** — cross-discipline coordination items
5. **Document history** — chronological record of which documents contributed to this page
6. **Agent log** — one entry per task: ID, date, what changed, link to task page

### Active gaps

```wikitext
=== Clarifier mechanism vendor unknown ===
{{Open}}
Spec 46 33 00 lists performance requirements but no basis-of-design
manufacturer. Will be resolved when submittal is received.
```

### Resolved

```wikitext
=== Wall rebar spacing at penetrations ===
{{Superseded}}
Previously documented as #5 at 12" O.C. per Drawing S-302.

{{Closed}}
RFI-042 response (2026-01-22): S-305 Detail 7 governs. Use #5 at 8" O.C.
for penetrations > 6" diameter. Area page and Spec 03 30 00 updated.
```

### Agent log

```wikitext
=== Task:0003 — Area 03 initial analysis ===
2026-02-15. Created area page from civil and structural drawings.
Posted 3 open gaps. See [[Task:0003]].
```

### What does NOT belong on talk pages

- Reader-facing content (goes on area/equipment/drawing/spec pages)
- Full document transcriptions

## Citation system

Inline citations use `<ref>` tags rendered via `<references />` in a `== References ==` section. This is standard MediaWiki.

### Inline citation templates

**Cite drawing** — for facts from contract drawings:
```wikitext
<ref name="c-301">{{Cite drawing|sheet=C-301|date=2025-08-15
|hash=a1b2c3d4e5f6|note=Civil site plan with pipe routing}}</ref>
```

**Cite spec** — for specification requirements:
```wikitext
<ref>{{Cite spec|section=03 30 00|paragraph=2.1.A|date=2025-06-01
|hash=a1b2c3d4e5f6|note=Concrete mix requirements}}</ref>
```

**Cite rfi** — for RFI questions and responses:
```wikitext
<ref>{{Cite rfi|number=042|date=2026-01-22|hash=a1b2c3d4e5f6
|note=Wall reinforcement at penetrations}}</ref>
```

**Cite submittal** — for approved submittal data:
```wikitext
<ref>{{Cite submittal|number=SUB-033000-001|date=2026-02-10
|hash=a1b2c3d4e5f6|note=Concrete mix design approval}}</ref>
```

**Cite geotech** — for geotechnical report data:
```wikitext
<ref>{{Cite geotech|report=Geotechnical Investigation|boring=B-7
|date=2025-03-15|hash=a1b2c3d4e5f6|note=Groundwater elevation}}</ref>
```

All templates include: **hash** (vault hash), **date**, **note** (human-readable description).

### Bibliography template

**Cite vault** — for the Bibliography section, describes full document sets consulted:
```wikitext
{{Cite vault|type=drawings|snapshot=a1b2c3d4e5f6
|timestamp=2025-08-15|note=Volume 3 — Civil Drawings, 45 sheets}}
```

Additional fields: **type** (drawings, specs, reports, etc.), **timestamp** (date or date range).

### When to cite

**Always cite**: Design parameters, verbatim contract language, RFI responses, approved submittal data, claims corrected or superseded on the talk page.

**Don't need citations**: General descriptions evident from multiple drawings, information already attributed inline, drawing page content analyzing a single drawing identified in the title.

### Named refs for reuse

```wikitext
The influent pipe is 48 inches in diameter.<ref name="c-301" />
It enters the distribution box at elevation 102.5 ft.<ref name="c-301">
{{Cite drawing|sheet=C-301|date=2025-08-15|hash=a1b2c3d4e5f6
|note=Civil site plan with pipe routing}}</ref>
The distribution box splits flow to four clarifiers.<ref name="c-301" />
```

### Page structure

Every area and equipment page ends with:

```wikitext
== References ==
<references />

== Bibliography ==
{{Cite vault|type=drawings|snapshot=a1b2c3d4e5f6
|timestamp=2025-08-15|note=Volume 3 — Civil Drawings, 45 sheets}}
{{Cite vault|type=specs|snapshot=b2c3d4e5f6a1
|timestamp=2025-06-01|note=Project Specifications, Divisions 01-46}}
```

**References** = inline citations tracing specific claims to specific documents in the vault.

**Bibliography** = full document sets consulted for the page overall.

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
