# Ontology Audit

An audit of every noun and term used as a concept in the whoami.wiki project, identifying inconsistencies, overloaded terms, and recommendations for a consistent vocabulary.

## Summary of findings

The project has **three significant naming collisions** and **several minor inconsistencies** that make the terminology harder to learn than it needs to be. The most impactful problems:

1. **"Archive"** means three different things depending on context
2. **"Source"** means four different things depending on context
3. **"Snapshot"** and the verb "archive" compete for the same action
4. The **cli.mdx documentation** is substantially out of sync with the actual CLI
5. The **`== References ==` vs `== Sources ==`** section heading is inconsistent across docs

---

## Problem 1: "Archive" is overloaded

The word "archive" currently refers to three distinct concepts:

| Usage | Where | What it means |
|---|---|---|
| Content-addressed store | `getArchivePath()`, `~/Archive/` dir | The local directory of hashed objects and snapshot manifests |
| Backup tar file | `wai export` / `wai import` | A `.tar` file containing the full wiki database, images, and archive |
| Verb "to archive" | `snapshot.ts` output: `"Archived <dir>"`, CLI help: `"Archive a directory"` | The action of running `wai snapshot` |

Additionally, the CLI help groups `export`, `import`, and `snapshot` under the heading **"Archive"** — which collides with the directory name.

### Where each usage appears

- **Content-addressed store**: `data-path.ts:21` (`getArchivePath`), `snapshot.ts:54` (`archiveDir`), `export.ts:74` (`archivePath`), `import.ts:94` (`snapshotArchivePath`), plugin `CLAUDE.md` (`~/Archive`)
- **Backup tar file**: `import.ts:29` (`Archive not found`), `import.ts:43` (`Invalid archive`), `export.ts:135` (`Failed to create archive`), `import.ts:45` (`manifest.version`)
- **Verb**: `snapshot.ts:131` (`Archived ${dir}`), `index.ts:72` (`Archive a directory`), `cli.mdx:42` (`Ingest a data source into the archive`)

### Recommendation

Rename the content-addressed store from "archive" to **"vault"**. This:

- Removes the collision with the backup/export tar concept (which can keep "archive")
- Removes the collision with the verb "to archive"
- Conveys the immutability and permanence of the store
- Is self-explanatory and distinct from every other term in the system

Changes required:
- `getArchivePath()` → `getVaultPath()`
- `WAI_ARCHIVE_PATH` env var → `WAI_VAULT_PATH`
- `~/Archive/` directory → `~/vault/` (lowercase to match Unix conventions)
- CLI help group "Archive" → rename to **"Backup"** (for export/import) and move `snapshot` to the **"Data"** group
- Update plugin CLAUDE.md references to `~/Archive`
- Update snapshot.ts output from `"Archived <dir>"` to `"Snapshotted <dir>"` or `"Captured <dir>"`

---

## Problem 2: "Source" is overloaded

"Source" currently means at least four different things:

| Usage | Where | What it means |
|---|---|---|
| Wiki namespace `Source:` | `wai source list`, `Source:WhatsApp` pages | A wiki page documenting an ingested dataset |
| Raw data type | data-sources.mdx, editorial-standards.mdx | The type of raw input (photos, messages, etc.) |
| Citation reference | `{{Cite source}}`, `== Sources ==` section | A bibliographic entry linking to archived data |
| Task field | `TaskInfo.source`, `--source` flag | Which Source page a task relates to |

The most confusing collision is between **Source pages** (wiki namespace) and **data sources** (raw input types). A "Source page" documents a "data source" but they are not the same thing — a single data source (e.g. WhatsApp) might have multiple Source pages (one per snapshot).

### Recommendation

The `Source:` namespace is fine — it's clear and well-established. The changes needed are:

1. **Rename the `== Sources ==` section** to `== References ==` consistently. This matches Wikipedia convention and the citation-system.mdx documentation (which already says `== References ==`). The evals.mdx grader says `== Sources ==` — fix that. The wiki-writer.md agent says `== Sources ==` — fix that.

2. **Use "data source" (two words) consistently** when referring to raw input types. Never use bare "source" to mean raw data. The data-sources.mdx page is already correctly titled.

3. **Consider renaming `{{Cite source}}`** to `{{Cite ref}}` or `{{Citation}}` to avoid confusion with the Source namespace. Lower priority since it's a wiki template.

---

## Problem 3: "Snapshot" nomenclature

The `wai snapshot` command does several things at once:
1. Hashes files into the content-addressed store (objects)
2. Writes a manifest to `snapshots/`
3. Creates a `Source:` wiki page

The naming is slightly tangled:
- The **command** is called `snapshot`
- The **manifest directory** is called `snapshots/`
- The **wiki page** it creates is in the `Source:` namespace
- The **output** says `"Archived <dir>"`
- The **docs** say `"Ingest a data source"` (cli.mdx) and `"Snapshot your data"` (writing-your-first-page.mdx)
- A **snapshot ID** is the hash of the manifest

### Recommendation

"Snapshot" is actually a good word for what happens — you're capturing a point-in-time copy of a directory. The problems are:

1. **The output should say "Snapshotted"** not "Archived" — align the verb with the command name
2. **The cli.mdx description should say "Snapshot a directory"** not "Ingest a data source" (it doesn't ingest or index anything, it just hashes and copies)
3. The `snapshots/` subdirectory name is fine — it stores snapshot manifests
4. The `Source:` page namespace is fine — it documents the source, not the snapshot itself

The verb hierarchy should be: you **snapshot** a directory, which stores **objects** in the **vault** and creates a **Source page** on the wiki.

---

## Problem 4: cli.mdx is out of sync

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

Rewrite cli.mdx to match the actual `index.ts` help text. The help text in `index.ts:31-85` is the ground truth. Consider generating cli.mdx from the actual command implementations to prevent future drift.

---

## Problem 5: "References" vs "Sources" section heading

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

## Problem 6: "Talk" page type vs talk pages

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

## Problem 7: Export/import terminology vs backup/restore

The CLI commands are `wai export` and `wai import`, but:
- cli.mdx documents them as `wai wiki backup` and `wai wiki restore`
- The concepts are "backup" and "restore" — that's what users think of
- The actual commands use "export" and "import"

### Recommendation

Keep `export`/`import` as the command names. They're more general — you might export to move to a different machine, not just for backup. But update cli.mdx to use the correct names and describe them as "Export a full backup" / "Import from a backup" to bridge the mental model.

---

## Problem 8: Inconsistent casing of "Archive" path

The plugin CLAUDE.md uses `~/Archive` (capitalized) while the code uses a lowercase config-derived path. The CLAUDE.md also references `~/archive` (lowercase) in the same file.

- Line 12: `"...look up their info in ~/archive"`
- Line 14: `"Structure of ~/Archive:"`
- Line 79: `"archive a directory into ~/Archive"`

### Recommendation

Use lowercase `~/vault/` consistently (if the rename is accepted) or `~/archive/` if keeping the current name. Follow Unix conventions — user-facing directories are lowercase.

---

## Minor issues

### "Object" as archive storage unit

The content-addressed store calls each file an "object" (stored in `objects/`). This is standard terminology (git uses it) but isn't immediately self-explanatory. Alternative: **"blob"** (also git terminology, more specific).

**Recommendation**: Keep "object". It's the established convention in content-addressed storage systems.

### "Ingest" as a verb

cli.mdx uses "Ingest a data source" but the actual command just hashes and copies files — it doesn't parse, index, or extract metadata. The tutorial (writing-your-first-page.mdx) says "indexes the photos, extracts metadata" which is also inaccurate for `wai snapshot`.

**Recommendation**: Use **"snapshot"** as the verb. "Snapshot" a directory = hash its files and register it as a source. Don't say "ingest" or "index" unless the command actually does that.

### "Agent harness" vs "plugin"

The system uses both "agent harness" and "plugin" to refer to the MCP integration:
- installation.mdx: "Agent harness — a plugin for your AI coding tool"
- Commands: `wai plugin install`
- Plugin directory: `plugins/`

**Recommendation**: This is fine as-is. "Agent harness" is the concept, "plugin" is the implementation mechanism. Just be consistent: install a **plugin** that provides the **agent harness**.

### "Page" vs "article" vs "entry"

The project consistently uses "page" throughout, which is correct MediaWiki terminology. No inconsistency here.

### Command group names in CLI help

Current groups: Pages, Sections, Talk Pages, Tasks, Discovery, Archive, Auth

With the proposed changes:
- **Archive** → split into **Data** (snapshot) and **Backup** (export, import)
- Or rename the group to **Backup** and move `snapshot` to a **Data** group

Proposed:

```
Pages:        read, write, edit, create, search, upload
Sections:     section list, section read, section update
Talk Pages:   talk read, talk create
Tasks:        task list, task read, task create, task claim, task complete, task fail, task requeue
Data:         snapshot, source list
Discovery:    link, category, changes, place
Backup:       export, import
Auth:         auth login, auth logout, auth status, update
```

This puts `snapshot` and `source list` together (they're both about data ingestion/management) and separates them from the backup commands.

---

## Proposed glossary terms

These should be the canonical definitions in a `docs/reference/glossary.mdx`:

| Term | Definition |
|---|---|
| **Page** | A wiki article in the main namespace. The fundamental unit of the encyclopedia. |
| **Page type** | One of five structural templates: Person, Episode, Conversation, Reflection, Task. |
| **Section** | A subdivision within a page, delimited by `== Heading ==` syntax. |
| **Infobox** | A structured sidebar template on a page with key-value facts. |
| **Lead paragraph** | The opening prose before the first section heading, summarizing the page topic. |
| **Category** | A tag grouping pages by type or theme. Syntax: `[[Category:Name]]`. |
| **Wikilink** | An internal link between pages. Syntax: `[[Page Name]]`. |
| **Red link** | A wikilink to a page that doesn't exist yet, indicating a gap in the encyclopedia. |
| **Talk page** | A discussion page paired with a main page (Talk:PageName), used for editorial notes and questions. |
| **Vault** | The content-addressed store on disk where source files are kept. Contains `objects/` and `snapshots/` subdirectories. |
| **Object** | A single file stored in the vault, identified by its SHA-256 hash. Immutable once written. |
| **Snapshot** | A captured copy of a directory. Produces a manifest (mapping file paths to hashes), stores objects in the vault, and creates a Source page. Identified by a deterministic snapshot ID derived from the manifest hash. |
| **Snapshot ID** | A 16-character hex string derived from the SHA-256 hash of a snapshot's manifest. Uniquely identifies a snapshot. |
| **Manifest** | A JSON file listing all files in a snapshot with their paths and hashes. Stored in `vault/snapshots/`. |
| **Source page** | A wiki page in the `Source:` namespace documenting an ingested dataset. Created by `wai snapshot`. Contains metadata (snapshot ID, file count, size) and querying instructions. |
| **Data source** | A type of raw personal data that can be snapshotted: photos, messages, voice notes, location data, financial data, social media archives. |
| **Citation** | A reference linking a factual claim in a page to a specific piece of evidence. Uses `<ref>{{cite type}}</ref>` syntax. |
| **Reference** | A collected citation displayed in the `== References ==` section via `{{reflist}}`. |
| **Task** | A work item in the `Task:` namespace tracking editorial work. Has a lifecycle: pending → in-progress → done or failed. |
| **Task queue** | The system of Task pages used to coordinate work between agents and humans. |
| **Agent harness** | An MCP server plugin that gives AI coding tools (Claude Code, Codex, OpenCode) read/write access to the wiki. |
| **Plugin** | The installable package that provides the agent harness for a specific coding tool. |

---

## Change impact matrix

| Change | Files affected | Risk |
|---|---|---|
| Rename archive → vault | `data-path.ts`, `snapshot.ts`, `export.ts`, `import.ts`, plugin CLAUDE.md, docs | Medium — env var change is breaking |
| Rename Talk page type → Conversation | `page-types.mdx`, `evals.mdx`, agent instructions | Low — documentation only |
| Standardize `== References ==` | `evals.mdx`, `wiki-writer.md`, existing wiki pages | Low-medium — existing pages may use `== Sources ==` |
| Rewrite cli.mdx | `cli.mdx` | Low — documentation only |
| Fix snapshot output verb | `snapshot.ts` | Low — cosmetic |
| Regroup CLI help | `index.ts` | Low — cosmetic |
| Add glossary | New file `glossary.mdx`, sidebar config | Low — additive |
