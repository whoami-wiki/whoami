# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

The archive → vault rename is fully resolved. The remaining issues are:

1. **"Source" still means four different things** depending on context, though the dual-section citation structure is now clarified
2. **cli.mdx documentation** is substantially out of sync with the actual CLI — and the same phantom commands appear in installation.mdx and troubleshooting.mdx
3. **evals.mdx uses `== Sources ==`** where it means `== References ==`
4. **evals.mdx references a stale page type list**

---

## Resolved: "Archive" → "Vault"

The archive → vault rename is clean. One straggler remains:

- **citation-system.mdx line 70** says "the content-addressed archive snapshot hash" — should be "vault" or just "snapshot hash"

Otherwise the current state is correct:

- **Vault** — the content-addressed store (`getVaultPath()`, `WAI_VAULT_PATH`)
- **Backup** — the tar file produced by `wai export` / consumed by `wai import`
- **Snapshot** (verb) — the action of running `wai snapshot`, output says "Snapshotted"
- CLI help groups are now **Data** (snapshot) and **Backup** (export, import)

---

## Resolved: page types aligned

page-types.mdx and the glossary now agree on four page types: **Person**, **Episode**, **Talk**, **Task**. The Conversation and Reflection types have been removed.

One stale reference remains: **evals.mdx line 28** says test cases span "all four page types (Person, Episode, Talk, Task)" — the list happens to be correct now, but should be verified against the actual test suite if Conversation/Reflection test cases existed.

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

citation-system.mdx now explicitly defines a **dual-section structure** at the bottom of pages:

```wikitext
== References ==
<references />

== Sources ==
{{Cite source|type=messages|snapshot=...|timestamp=...|note=...}}
```

- **References** = numbered footnotes from `<ref>` tags (inline citations)
- **Sources** = bibliography-style `{{Cite source}}` entries (archives consulted)

This means `== Sources ==` is intentional and correct in wiki-writer.md — it's the bibliography section, not the footnotes section. The old audit incorrectly recommended replacing all `== Sources ==` with `== References ==`.

### What's still wrong

evals.mdx line 58 says the completeness grader checks for `== Sources ==` with `{{reflist}}`. This conflates the two sections — `{{reflist}}` renders footnotes and belongs in `== References ==`. The grader should check for both sections or at least use the correct name for the footnotes section.

### Recommendation

1. **Fix evals.mdx**: The completeness grader should check for `== References ==` with `{{reflist}}` (footnotes) and optionally `== Sources ==` with `{{Cite source}}` entries (bibliography).

2. **Use "data source" (two words) consistently** when referring to raw input types. Never use bare "source" to mean raw data. The data-sources.mdx page is already correctly titled.

3. **Consider renaming `{{Cite source}}`** to `{{Cite ref}}` or `{{Bibliography}}` to avoid confusion with the Source namespace. Lower priority since it's a wiki template.

---

## Problem 2: cli.mdx is out of sync

The reference documentation in `web/content/docs/cli.mdx` documents commands that don't exist in the actual CLI, and has wrong flags for commands that do exist. **This is unchanged from the previous audit.**

### Commands in cli.mdx that don't exist

| Documented command | Status |
|---|---|
| `wai status` | Does not exist |
| `wai doctor` | Does not exist |
| `wai config list/set/get` | Does not exist |
| `wai wiki restart` | Does not exist |
| `wai wiki backup` | Does not exist (actual: `wai export`) |
| `wai wiki restore` | Does not exist (actual: `wai import`) |
| `wai plugin install` | Does not exist |
| `wai plugin list` | Does not exist |

### Wrong flags / syntax in cli.mdx

| Documented | Actual |
|---|---|
| `wai snapshot --batch-size 100` | `wai snapshot --name "Name" --dry-run` |
| `wai search --type photos` | `wai search <query>` (no --type flag) |
| `wai task list --status claimed` | `--status in-progress` |
| `wai task create --title "..." --type write` | `wai task create -m "..." [--source X]` |
| `wai task fail --reason "..."` | `wai task fail <id> -m "..."` |

### Same phantom commands appear elsewhere

The non-existent commands are not confined to cli.mdx:

| File | Phantom commands used |
|---|---|
| installation.mdx | `wai status`, `wai doctor`, `wai plugin install` |
| troubleshooting.mdx | `wai wiki restart`, `wai config set`, `wai doctor`, `wai plugin install --force`, `wai snapshot --batch-size` |

### Recommendation

Rewrite cli.mdx to match the actual `index.ts:31-87` help text. Audit installation.mdx and troubleshooting.mdx for the same phantom commands. Consider generating cli.mdx from the actual command implementations to prevent future drift.

---

## Minor issues

### "Ingest" / "index" as verbs

The tutorial (writing-your-first-page.mdx line 16) says `wai snapshot` "indexes the photos, extracts metadata." The actual command just hashes files and copies them to the vault — it doesn't parse, index, or extract metadata. cli.mdx says "Ingest a data source into the vault."

**Recommendation**: Use **"snapshot"** as the verb. "Snapshot a directory" = hash its files and register them as a source. Don't say "ingest" or "index" unless the command actually does that.

### "Agent harness" vs "plugin"

installation.mdx says "Agent harness — a plugin for your AI coding tool" and references `wai plugin install`. The system uses both terms to refer to the MCP integration. This is fine as-is: "agent harness" is the concept, "plugin" is the implementation mechanism. Just note that `wai plugin install` doesn't exist yet (see Problem 3).

### Command group placement

Consider moving `source list` from **Discovery** to **Data** in the CLI help, since it's about data management not discovery.

---

## Change impact matrix

| Change | Files affected | Risk |
|---|---|---|
| Fix evals.mdx completeness grader | `evals.mdx` | Low — documentation only |
| Fix citation-system.mdx "archive" straggler | `citation-system.mdx` | Low — one word |
| Rewrite cli.mdx | `cli.mdx` | Low — documentation only |
| Fix phantom commands in installation/troubleshooting | `installation.mdx`, `troubleshooting.mdx` | Low — documentation only |
| Use "data source" consistently | Multiple docs | Low — wording only |
| Move `source list` to Data group | `index.ts` | Low — cosmetic |
