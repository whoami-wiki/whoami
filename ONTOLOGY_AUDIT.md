# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

Most naming issues from earlier audits are now resolved. The remaining issues are:

1. **"Source" still means four different things** depending on context, though the dual-section citation structure is now clarified
2. **Glossary says "four page types"** but page-types.mdx now says "two reader-facing page types" — the definition of "page type" needs settling
3. **evals.mdx has two stale references**: `== Sources ==` where it means `== References ==`, and "all four page types" which doesn't match the new two-type framing
4. **Phantom commands in installation.mdx and troubleshooting.mdx** — cli.mdx is fixed, but these pages still reference non-existent commands

---

## Resolved: "Archive" → "Vault"

Clean. One straggler remains:

- **citation-system.mdx line 70** says "the content-addressed archive snapshot hash" — should be "vault" or just "snapshot hash"

---

## Resolved: cli.mdx rewritten

cli.mdx has been completely rewritten to match the actual CLI. All phantom commands (`wai status`, `wai doctor`, `wai config`, `wai wiki restart/backup/restore`, `wai plugin install/list`) and wrong flags (`--batch-size`, `--type`, `--status claimed`, `--title`, `--reason`) are gone. The new cli.mdx documents every real command with correct flags.

---

## Resolved: page-types.mdx and namespaces.mdx split

Content has been cleanly split:

- **page-types.mdx** — documents the two reader-facing page types (Person, Episode)
- **namespaces.mdx** — documents all four namespaces (Main, Talk, Source, Task) with their structure and conventions

Talk and Task documentation moved from page-types.mdx to namespaces.mdx. This is a clean separation.

---

## Problem 1: "Source" is overloaded

"Source" still means at least four different things:

| Usage | Where | What it means |
|---|---|---|
| Wiki namespace `Source:` | `wai source list`, `Source:WhatsApp` pages | A wiki page documenting an ingested dataset |
| Raw data type | data-sources.mdx, editorial-standards.mdx | The type of raw input (photos, messages, etc.) |
| Citation bibliography | `{{Cite source}}`, `== Sources ==` section | A bibliography entry listing archives consulted |
| Task field | `TaskInfo.source`, `--source` flag | Which Source page a task relates to |

### Clarification from updated docs

citation-system.mdx explicitly defines a **dual-section structure** at the bottom of pages:

```wikitext
== References ==
<references />

== Sources ==
{{Cite source|type=messages|snapshot=...|timestamp=...|note=...}}
```

- **References** = numbered footnotes from `<ref>` tags (inline citations)
- **Sources** = bibliography-style `{{Cite source}}` entries (archives consulted)

This means `== Sources ==` is intentional and correct in wiki-writer.md — it's the bibliography section, not the footnotes section.

### What's still wrong

evals.mdx line 58 says the completeness grader checks for `== Sources ==` with `{{reflist}}`. This conflates the two sections — `{{reflist}}` renders footnotes and belongs in `== References ==`. The grader should check for both sections or at least use the correct name for the footnotes section.

### Recommendation

1. **Fix evals.mdx**: The completeness grader should check for `== References ==` with `{{reflist}}` (footnotes) and optionally `== Sources ==` with `{{Cite source}}` entries (bibliography).

2. **Use "data source" (two words) consistently** when referring to raw input types. Never use bare "source" to mean raw data. The data-sources.mdx page is already correctly titled.

3. **Consider renaming `{{Cite source}}`** to `{{Cite ref}}` or `{{Bibliography}}` to avoid confusion with the Source namespace. Lower priority since it's a wiki template.

---

## Problem 2: glossary "page type" definition doesn't match page-types.mdx

The glossary defines "page type" as one of four structural templates: **Person**, **Episode**, **Talk**, **Task**.

But page-types.mdx now says "two reader-facing page types" and only documents Person and Episode. Talk and Task are documented as namespaces in namespaces.mdx, not as page types.

This creates an ambiguity: are Talk and Task "page types" or just "namespaces with conventions"?

Additionally, evals.mdx line 27 says test cases span "all four page types (Person, Episode, Talk, Task)" — this uses the old four-type framing.

### Recommendation

Decide whether "page type" means:

- **(a) Reader-facing content types** — Person and Episode only. Talk and Task are namespaces with their own conventions but not "page types." Update the glossary to match page-types.mdx.
- **(b) Any page with a defined structure** — Person, Episode, Talk, and Task. Update page-types.mdx to list all four again (possibly in two groups: reader-facing and operational).

Either way, the glossary and page-types.mdx should agree.

---

## Problem 3: phantom commands in installation.mdx and troubleshooting.mdx

cli.mdx is now fixed, but the same non-existent commands still appear in two other pages:

| File | Phantom commands used |
|---|---|
| installation.mdx | `wai status`, `wai doctor`, `wai plugin install` |
| troubleshooting.mdx | `wai wiki restart`, `wai config set`, `wai doctor`, `wai plugin install --force`, `wai snapshot --batch-size` |

### Recommendation

Audit both pages against the actual CLI. Either remove references to unimplemented commands or replace them with real equivalents (e.g., `wai auth status` instead of `wai status`).

---

## Minor issues

### "Ingest" / "index" as verbs

writing-your-first-page.mdx line 16 says `wai snapshot` "indexes the photos, extracts metadata." The actual command just hashes files and copies them to the vault — it doesn't parse, index, or extract metadata.

**Recommendation**: Use **"snapshot"** as the verb. Don't say "ingest" or "index" unless the command actually does that.

### Command group placement

Consider moving `source list` from **Discovery** to **Data** in the CLI help, since it's about data management not discovery.

---

## Change impact matrix

| Change | Files affected | Risk |
|---|---|---|
| Fix evals.mdx completeness grader | `evals.mdx` | Low — documentation only |
| Fix citation-system.mdx "archive" straggler | `citation-system.mdx` | Low — one word |
| Settle "page type" definition | `glossary.mdx` or `page-types.mdx`, `evals.mdx` | Low — documentation only |
| Fix phantom commands in installation/troubleshooting | `installation.mdx`, `troubleshooting.mdx` | Low — documentation only |
| Use "data source" consistently | Multiple docs | Low — wording only |
| Move `source list` to Data group | `index.ts` | Low — cosmetic |
