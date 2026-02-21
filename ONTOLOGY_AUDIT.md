# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

Most naming issues from earlier audits are now resolved. The remaining issues are:

1. **"Source" still means four different things** depending on context, though the dual-section citation structure is now clarified
2. **evals.mdx has two stale references**: `== Sources ==` where it means `== References ==`, and "all four page types (Person, Episode, Talk, Task)" which doesn't match the current two-type framing

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

## Resolved: glossary "page type" definition aligned

The glossary now defines "page type" as a grouping of pages that share a common structure, with Person and Episode as the current types. New types may emerge as different kinds of data are added. Talk and Task are namespaces, not page types.

evals.mdx line 27 still says "all four page types (Person, Episode, Talk, Task)" — this should be updated.

---

## Problem 2: phantom commands in installation.mdx and troubleshooting.mdx

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
| Fix evals.mdx completeness grader and page type list | `evals.mdx` | Low — documentation only |
| Fix citation-system.mdx "archive" straggler | `citation-system.mdx` | Low — one word |
| Fix phantom commands in installation/troubleshooting | `installation.mdx`, `troubleshooting.mdx` | Low — documentation only |
| Use "data source" consistently | Multiple docs | Low — wording only |
| Move `source list` to Data group | `index.ts` | Low — cosmetic |
