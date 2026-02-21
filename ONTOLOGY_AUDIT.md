# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

Most naming issues from earlier audits are now resolved. The remaining issues are:

1. **wiki-writer.md still uses `{{Cite source}}` and `== Sources ==`** — should be `{{Cite vault}}` and `== Bibliography ==`
2. **evals.mdx has two stale references**: the completeness grader conflates `== Bibliography ==` with `{{reflist}}`, and "all four page types" doesn't match the current two-type framing

---

## Resolved: "Archive" → "Vault"

Clean. The citation-system.mdx "archive" straggler is gone — the template is now `{{Cite vault}}`.

---

## Resolved: cli.mdx rewritten

cli.mdx has been completely rewritten to match the actual CLI. All phantom commands and wrong flags are gone.

---

## Resolved: phantom commands in installation.mdx and troubleshooting.mdx

Both pages have been updated:

- installation.mdx: `wai status` → `wai auth status`, `wai plugin install` → `claude plugin add whoami`, `wai doctor` removed
- troubleshooting.mdx: `wai wiki restart` → `docker restart`, `wai config set` → manual config edit, `wai doctor` → `wai auth status`, `wai snapshot --batch-size` removed

---

## Resolved: page-types.mdx and namespaces.mdx split

Content has been cleanly split:

- **page-types.mdx** — documents the two reader-facing page types (Person, Episode)
- **namespaces.mdx** — documents all four namespaces (Main, Talk, Source, Task) with their structure and conventions

---

## Resolved: glossary "page type" definition aligned

The glossary now defines "page type" as a grouping of pages that share a common structure, with Person and Episode as the current types. New types may emerge as different kinds of data are added. Talk and Task are namespaces, not page types.

---

## Resolved: "Source" overloading reduced

The `== Sources ==` / `{{Cite source}}` rename to `== Bibliography ==` / `{{Cite vault}}` eliminates the biggest collision. "Source" now means:

| Usage | Where | What it means |
|---|---|---|
| Wiki namespace `Source:` | `wai source list`, `Source:WhatsApp` pages | A wiki page documenting an ingested dataset |
| Raw data type | data-sources.mdx, editorial-standards.mdx | The type of raw input (photos, messages, etc.) |
| Task field | `TaskInfo.source`, `--source` flag | Which Source page a task relates to |

The bibliography meaning is gone. The remaining "Source namespace" vs "data source" collision is manageable with the two-word convention ("data source" for raw input types).

---

## Problem 1: wiki-writer.md still uses old citation names

wiki-writer.md still references the pre-rename citation system:

| wiki-writer.md | Should be |
|---|---|
| `{{Cite source\|type=...\|snapshot=...\|timestamp=...\|note=...}}` | `{{Cite vault\|type=...\|snapshot=...\|timestamp=...\|note=...}}` |
| `== Sources ==` section | `== Bibliography ==` section |
| "look at their `{{Cite source}}` entries" (Phase 2) | "look at their `{{Cite vault}}` entries" |

### Recommendation

Find-and-replace `Cite source` → `Cite vault` and `== Sources ==` → `== Bibliography ==` in wiki-writer.md.

---

## Problem 2: evals.mdx has two stale references

### Completeness grader conflates sections

evals.mdx line 58 says the completeness grader checks for `== Bibliography ==` with `{{reflist}}`. But `{{reflist}}` renders inline citation footnotes and belongs in `== References ==`. The Bibliography section uses `{{Cite vault}}` entries.

The grader should check for `== References ==` with `<references />` (footnotes) and `== Bibliography ==` with `{{Cite vault}}` entries.

### Page type list is stale

evals.mdx line 27 says test cases span "all four page types (Person, Episode, Talk, Task)." Page types are now Person and Episode only. Talk and Task are namespaces, not page types.

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
| Update wiki-writer.md citation names | `wiki-writer.md` | Low — agent instructions only |
| Fix evals.mdx completeness grader | `evals.mdx` | Low — documentation only |
| Fix evals.mdx page type list | `evals.mdx` | Low — documentation only |
| Use "data source" consistently | Multiple docs | Low — wording only |
| Move `source list` to Data group | `index.ts` | Low — cosmetic |
