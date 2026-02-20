# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

After the archive → vault rename, the project's biggest naming collision is resolved. The remaining issues are:

1. **"Source"** still means four different things depending on context
2. **"Talk"** page type collides with MediaWiki talk pages
3. **cli.mdx documentation** is substantially out of sync with the actual CLI
4. **`== References ==` vs `== Sources ==`** section heading is inconsistent across docs

---

## Resolved: "Archive" → "Vault"

The archive → vault rename resolved the three-way collision where "archive" meant the content-addressed store, a backup tar file, and a verb. The current state is clean:

- **Vault** — the content-addressed store (`getVaultPath()`, `WAI_VAULT_PATH`)
- **Backup** — the tar file produced by `wai export` / consumed by `wai import`
- **Snapshot** (verb) — the action of running `wai snapshot`, output says "Snapshotted"
- CLI help groups are now **Data** (snapshot) and **Backup** (export, import)

---

## Problem 1: "Source" is overloaded

"Source" currently means at least four different things:

| Usage | Where | What it means |
|---|---|---|
| Wiki namespace `Source:` | `wai source list`, `Source:WhatsApp` pages | A wiki page documenting an ingested dataset |
| Raw data type | data-sources.mdx, editorial-standards.mdx | The type of raw input (photos, messages, etc.) |
| Citation reference | `{{Cite source}}`, `== Sources ==` section | A bibliographic entry linking to source data |
| Task field | `TaskInfo.source`, `--source` flag | Which Source page a task relates to |

The most confusing collision is between **Source pages** (wiki namespace) and **data sources** (raw input types). A "Source page" documents a "data source" but they are not the same thing — a single data source (e.g. WhatsApp) might have multiple Source pages (one per snapshot).

### Recommendation

The `Source:` namespace is fine — it's clear and well-established. The changes needed are:

1. **Rename the `== Sources ==` section** to `== References ==` consistently. This matches Wikipedia convention and the citation-system.mdx documentation (which already says `== References ==`). The evals.mdx grader says `== Sources ==` — fix that. The wiki-writer.md agent says `== Sources ==` — fix that.

2. **Use "data source" (two words) consistently** when referring to raw input types. Never use bare "source" to mean raw data. The data-sources.mdx page is already correctly titled.

3. **Consider renaming `{{Cite source}}`** to `{{Cite ref}}` or `{{Citation}}` to avoid confusion with the Source namespace. Lower priority since it's a wiki template.

---

## Problem 2: "Talk" page type vs talk pages

The project defines "Talk" as one of the five page types (page-types.mdx) — a page built from conversations. But MediaWiki has a built-in concept of "talk pages" (the `Talk:` namespace) used for editorial discussion.

- **Page type "Talk"**: A main-namespace article built from chat/conversation data
- **`wai talk read/create`**: Commands for MediaWiki's editorial discussion pages

A user could reasonably ask "how do I read a Talk page?" and mean either thing.

### Recommendation

Rename the page type from **"Talk"** to **"Conversation"**. This:

- Removes the collision with MediaWiki talk pages
- Is more descriptive of the content (it's about conversations, not "talk")
- Still fits the pattern: Person, Episode, Conversation, Reflection, Task

---

## Problem 3: cli.mdx is out of sync

The reference documentation in `web/content/docs/cli.mdx` documents commands that don't exist in the actual CLI, and has wrong flags for commands that do exist.

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

### Recommendation

Rewrite cli.mdx to match the actual `index.ts` help text. The help text in `index.ts:31-87` is the ground truth. Consider generating cli.mdx from the actual command implementations to prevent future drift.

---

## Problem 4: "References" vs "Sources" section heading

Three different documents use different names for the footnotes/citations section at the bottom of wiki pages:

| Document | Section heading |
|---|---|
| citation-system.mdx | `== References ==` with `{{reflist}}` |
| evals.mdx (completeness grader) | `== Sources ==` with `{{reflist}}` |
| wiki-writer.md (agent instructions) | `== Sources ==` with `{{Cite source}}` entries |

### Recommendation

Standardize on **`== References ==`** with `{{reflist}}`. This matches Wikipedia convention. Update:
- evals.mdx completeness grader description
- wiki-writer.md Phase 3 and Phase 4 instructions

Note: the wiki-writer.md uses `{{Cite source}}` entries in the `== Sources ==` section, while citation-system.mdx uses `<ref>{{cite message/voice/photo/video}}</ref>` with `{{reflist}}`. These appear to be two different citation styles. Clarify which is canonical and document both if both are valid.

---

## Minor issues

### "Ingest" as a verb

cli.mdx uses "Ingest a data source into the vault" but the actual command just hashes and copies files — it doesn't parse, index, or extract metadata. The tutorial (writing-your-first-page.mdx) says "indexes the photos, extracts metadata" which is also inaccurate for `wai snapshot`.

**Recommendation**: Use **"snapshot"** as the verb. "Snapshot" a directory = hash its files and register them as a source. Don't say "ingest" or "index" unless the command actually does that.

### "Agent harness" vs "plugin"

The system uses both "agent harness" and "plugin" to refer to the MCP integration:
- installation.mdx: "Agent harness — a plugin for your AI coding tool"
- Commands: `wai plugin install`
- Plugin directory: `plugins/`

**Recommendation**: This is fine as-is. "Agent harness" is the concept, "plugin" is the implementation mechanism. Just be consistent: install a **plugin** that provides the **agent harness**.

### Command group names

The CLI help now correctly uses:
- **Data** — `snapshot`
- **Backup** — `export`, `import`

Consider moving `source list` from **Discovery** to **Data**, since it's about data management not discovery.

---

## Change impact matrix

| Change | Files affected | Risk |
|---|---|---|
| Rename Talk page type → Conversation | `page-types.mdx`, `evals.mdx`, agent instructions | Low — documentation only |
| Standardize `== References ==` | `evals.mdx`, `wiki-writer.md`, existing wiki pages | Low-medium — existing pages may use `== Sources ==` |
| Rewrite cli.mdx | `cli.mdx` | Low — documentation only |
| Move `source list` to Data group | `index.ts` | Low — cosmetic |
| Add glossary | New file `glossary.mdx`, sidebar config | Low — additive |
