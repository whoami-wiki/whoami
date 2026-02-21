# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

All major naming issues are resolved. The remaining items are minor wording suggestions.

---

## Resolved: "Archive" → "Vault"

Clean. No stragglers remain.

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

## Resolved: wiki-writer.md citation names

All three occurrences updated: `{{Cite source}}` → `{{Cite vault}}`, `== Sources ==` → `== Bibliography ==`.

---

## Resolved: evals.mdx stale references

- Completeness grader now checks for both `== References ==` (with `<references />`) and `== Bibliography ==` (with `{{Cite vault}}` entries) as separate elements
- Test case description now says "both page types (Person, Episode) and covering all four namespaces"

---

## Minor issues

### "Ingest" / "index" as verbs

writing-your-first-page.mdx line 16 says `wai snapshot` "indexes the photos, extracts metadata." The actual command just hashes files and copies them to the vault — it doesn't parse, index, or extract metadata.

**Recommendation**: Use **"snapshot"** as the verb. Don't say "ingest" or "index" unless the command actually does that.

### Command group placement

Consider moving `source list` from **Discovery** to **Data** in the CLI help, since it's about data management not discovery.
