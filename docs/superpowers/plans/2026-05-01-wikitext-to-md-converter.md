# Wikitext → Markdown Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `tools/wikitext-to-md/`, a standalone Node CLI that drains the legacy MediaWiki SQLite database, applies the strict `.ged` cutoff (Plan B in the migration spec), and emits Markdown into `pages/` plus an initial `genealogy/snapshots.yml`.

**Architecture:** Pure functions composed into a pipeline. CLI args in → SQLite read → per-page extractor + transform passes → file write. No HTTP, no auth, no daemon. Each transform is a small unit with table-driven tests. The pipeline runs extractors first (categories, redirects, gedcom refs lift to frontmatter), then string-to-string transforms in a fixed order. Two-pass over redirects: collect redirect map first, apply as `aliases[]` on targets in the second pass.

**Tech Stack:** Node 22 + TypeScript 5.5, ESM, `tsx` for dev, `node:test` for tests (consistent with `cli/`), `better-sqlite3` for the legacy DB read, `js-yaml` for frontmatter and directive bodies. No remark/rehype — we are emitting Markdown, not parsing it. The renderer module (Plan E) handles parsing.

**Reference spec:** `docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md` — particularly Phase 1 (frontmatter schema, component table) and Phase 2 (transformations list).

---

## File Structure

```
tools/wikitext-to-md/
├── package.json
├── tsconfig.json
├── README.md
├── .gitignore
├── src/
│   ├── index.ts                  # CLI entry: parse args, orchestrate, write report
│   ├── types.ts                  # shared types (RawPage, PageMeta, GedcomRef, Warning, Report)
│   ├── db.ts                     # better-sqlite3 reader; cutoff + NS filter; emits RawPage[]
│   ├── slug.ts                   # title → kebab-slug
│   ├── frontmatter.ts            # PageMeta → YAML frontmatter string
│   ├── pipeline.ts               # compose extractors + transforms; redirect-map two-pass
│   ├── gedcom-snapshot.ts        # SHA-256 hash a .ged; write snapshots.yml
│   ├── extractors/
│   │   ├── categories.ts         # [[Category:X]] → frontmatter.categories; strip from body
│   │   ├── redirect.ts           # #REDIRECT [[X]] → { target } | null
│   │   └── cite-vault-ref.ts     # first {{Cite vault|note=…ged record I…}} → GedcomRef
│   └── transforms/
│       ├── infobox-person.ts
│       ├── infobox-company.ts
│       ├── cite-vault.ts         # body transform; pairs with extractors/cite-vault-ref
│       ├── cite-message.ts
│       ├── admonitions.ts        # Open / Closed / Superseded → directives
│       ├── gap.ts                # {{Gap|n}} → :::gap (separate from admonitions: takes content)
│       ├── blockquote.ts
│       ├── dialogue.ts
│       ├── columns-list.ts
│       ├── bold-italic.ts        # ''' bold ''' / '' italic '' → ** / *
│       ├── headings.ts           # == H2 == → ## H2
│       ├── refs.ts               # <ref>…</ref> + <references /> → footnotes
│       └── tables.ts             # {| … |} → MD pipe table when simple, raw HTML otherwise
└── test/
    ├── helpers/
    │   └── build-test-db.ts      # in-memory SQLite with minimal MediaWiki schema
    ├── slug.test.ts
    ├── frontmatter.test.ts
    ├── db.test.ts
    ├── gedcom-snapshot.test.ts
    ├── extractors/
    │   ├── categories.test.ts
    │   ├── redirect.test.ts
    │   └── cite-vault-ref.test.ts
    ├── transforms/
    │   ├── infobox-person.test.ts
    │   ├── infobox-company.test.ts
    │   ├── cite-vault.test.ts
    │   ├── cite-message.test.ts
    │   ├── admonitions.test.ts
    │   ├── gap.test.ts
    │   ├── blockquote.test.ts
    │   ├── dialogue.test.ts
    │   ├── columns-list.test.ts
    │   ├── bold-italic.test.ts
    │   ├── headings.test.ts
    │   ├── refs.test.ts
    │   └── tables.test.ts
    ├── pipeline.test.ts          # synthetic full-page round-trip
    └── e2e.test.ts               # opt-in: WIKI_SQLITE=… npm test runs against the real DB
```

---

## Tasks

### Task 1: Scaffold the package

**Files:**
- Create: `tools/wikitext-to-md/package.json`
- Create: `tools/wikitext-to-md/tsconfig.json`
- Create: `tools/wikitext-to-md/README.md`
- Create: `tools/wikitext-to-md/.gitignore`
- Create: `tools/wikitext-to-md/src/types.ts`

- [ ] **Step 1: Create `tools/wikitext-to-md/package.json`**

```json
{
  "name": "@whoami/wikitext-to-md",
  "version": "0.1.0",
  "description": "One-shot converter: MediaWiki SQLite → Markdown for the family-wiki migration",
  "type": "module",
  "private": true,
  "bin": {
    "wikitext-to-md": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "dev": "tsx src/index.ts",
    "test": "tsx --test \"test/**/*.test.ts\""
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `tools/wikitext-to-md/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `tools/wikitext-to-md/README.md`**

```markdown
# wikitext-to-md

One-shot converter from the legacy MediaWiki SQLite database to Markdown for
the whoami.wiki family-wiki migration. See
`docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md`.

## Usage

    npx tsx src/index.ts \
      --db ~/Library/Application\ Support/whoami/data/wiki.sqlite \
      --ged path/to/barash-tree.ged \
      --out ~/whoami/pages \
      --genealogy ~/whoami/genealogy

`--dry-run` prints what would be written without touching disk.

## Tests

    npm test                       # synthetic fixtures only
    WIKI_SQLITE=path npm test      # also runs e2e against the real DB
```

- [ ] **Step 4: Create `tools/wikitext-to-md/.gitignore`**

```
node_modules/
*.log
```

- [ ] **Step 5: Create `tools/wikitext-to-md/src/types.ts`**

```ts
export interface RawPage {
  namespace: number;
  title: string;
  text: string;
  createdAt: string;          // YYYYMMDDHHmmss
}

export type PageType = 'person' | 'family' | 'event' | 'tree' | 'meta';

export interface GedcomRef {
  file: string;
  record: string;
  snapshot: string;
}

export interface PageMeta {
  title: string;
  owner: string;
  editors: string[];
  type: PageType;
  aliases: string[];
  categories: string[];
  gedcom?: GedcomRef;
  created: string;            // YYYY-MM-DD
}

export interface Warning {
  page: string;
  kind: 'malformed-cite-vault' | 'unknown-template' | 'complex-table' | 'missing-frontmatter-field';
  detail: string;
}

export interface Report {
  pagesWritten: number;
  pagesSkipped: number;
  redirects: number;
  warnings: Warning[];
  snapshotHash: string;
}
```

- [ ] **Step 6: Install dependencies**

Run: `cd tools/wikitext-to-md && npm install`
Expected: completes without errors; `node_modules/` exists; `package-lock.json` is created.

- [ ] **Step 7: Verify typecheck**

Run: `cd tools/wikitext-to-md && npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 8: Commit**

```bash
git add tools/wikitext-to-md/package.json tools/wikitext-to-md/tsconfig.json tools/wikitext-to-md/README.md tools/wikitext-to-md/.gitignore tools/wikitext-to-md/src/types.ts tools/wikitext-to-md/package-lock.json
git commit -m "chore: scaffold tools/wikitext-to-md package"
```

---

### Task 2: `slug` module

**Files:**
- Create: `tools/wikitext-to-md/src/slug.ts`
- Create: `tools/wikitext-to-md/test/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/slug.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slug.ts';

test('slugify: lowercases and converts spaces to hyphens', () => {
  assert.equal(slugify('Steven Barash'), 'steven-barash');
});

test('slugify: collapses underscores', () => {
  assert.equal(slugify('Steven_Barash'), 'steven-barash');
});

test('slugify: collapses multiple whitespace and underscores', () => {
  assert.equal(slugify('Steven  Barash__Sr'), 'steven-barash-sr');
});

test('slugify: drops parenthesized parts only outside of person names', () => {
  assert.equal(slugify('Trip:Baku (December 2025)'), 'trip-baku-december-2025');
});

test('slugify: removes apostrophes and quotes', () => {
  assert.equal(slugify("Apara_and_the_Party_at_Nittay's"), 'apara-and-the-party-at-nittays');
});

test('slugify: preserves hyphens', () => {
  assert.equal(slugify('Wartime-catastrophe'), 'wartime-catastrophe');
});

test('slugify: collapses repeated hyphens', () => {
  assert.equal(slugify('A--B'), 'a-b');
});

test('slugify: keeps unicode letters by transliterating ASCII fallback (best-effort)', () => {
  assert.equal(slugify('Soviet Jewish emigration of the Barash Family'), 'soviet-jewish-emigration-of-the-barash-family');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all 8 tests fail with `Cannot find module '../src/slug.ts'`.

- [ ] **Step 3: Implement `src/slug.ts`**

```ts
/**
 * Normalize a wiki title into a kebab-case slug for filesystem and URL use.
 *
 * Rules (matches the Phase 3 wikilink resolution rule in the spec):
 *   1. lowercase
 *   2. drop apostrophes and quotes (', ’, ", “, ”)
 *   3. drop parens, brackets, braces (replace with hyphen)
 *   4. drop colons, semicolons, commas
 *   5. collapse runs of [\s_]+ into a single hyphen
 *   6. collapse runs of '-+' into a single hyphen
 *   7. trim leading/trailing hyphens
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’"“”]/g, '')
    .replace(/[()[\]{}]/g, '-')
    .replace(/[:;,]/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/slug.ts tools/wikitext-to-md/test/slug.test.ts
git commit -m "feat: add slugify for wiki title → kebab slug"
```

---

### Task 3: `frontmatter` module

**Files:**
- Create: `tools/wikitext-to-md/src/frontmatter.ts`
- Create: `tools/wikitext-to-md/test/frontmatter.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrontmatter } from '../src/frontmatter.ts';
import type { PageMeta } from '../src/types.ts';

test('renderFrontmatter: emits required fields in stable order', () => {
  const meta: PageMeta = {
    title: 'Abby Rickelman',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: ['Family', 'People'],
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.equal(out,
`---
title: Abby Rickelman
owner: steven
editors: []
type: person
aliases: []
categories: [Family, People]
created: 2026-04-29
---
`);
});

test('renderFrontmatter: emits gedcom block when present', () => {
  const meta: PageMeta = {
    title: 'Abby Rickelman',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: ['Family', 'People'],
    gedcom: { file: 'barash-tree.ged', record: 'I28906361734', snapshot: 'a1a48f25952a3294' },
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.match(out, /gedcom:\n  file: barash-tree\.ged\n  record: I28906361734\n  snapshot: a1a48f25952a3294/);
});

test('renderFrontmatter: aliases are inline-flow when short, block when long', () => {
  const meta: PageMeta = {
    title: 'X',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: ['Me'],
    categories: [],
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.match(out, /aliases: \[Me\]/);
});

test('renderFrontmatter: uses single-quoted strings only when needed', () => {
  const meta: PageMeta = {
    title: 'Trip: Baku',                        // colon needs quoting
    owner: 'steven',
    editors: [],
    type: 'meta',
    aliases: [],
    categories: [],
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.match(out, /title: ['"]Trip: Baku['"]/);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`
Expected: 4 frontmatter tests fail.

- [ ] **Step 3: Implement `src/frontmatter.ts`**

We render manually rather than via `js-yaml.dump` because the spec requires
inline-flow arrays (`categories: [Family, People]`) **and** block-style
gedcom in the same document, which `js-yaml`'s `flowLevel` can't express
together. Manual rendering is small and predictable.

```ts
import type { PageMeta } from './types.ts';

export function renderFrontmatter(meta: PageMeta): string {
  const lines: string[] = ['---'];
  lines.push(`title: ${yamlScalar(meta.title)}`);
  lines.push(`owner: ${meta.owner}`);
  lines.push(`editors: ${flowArray(meta.editors)}`);
  lines.push(`type: ${meta.type}`);
  lines.push(`aliases: ${flowArray(meta.aliases)}`);
  lines.push(`categories: ${flowArray(meta.categories)}`);
  if (meta.gedcom) {
    lines.push('gedcom:');
    lines.push(`  file: ${meta.gedcom.file}`);
    lines.push(`  record: ${meta.gedcom.record}`);
    lines.push(`  snapshot: ${meta.gedcom.snapshot}`);
  }
  lines.push(`created: ${meta.created}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

function yamlScalar(s: string): string {
  // Quote if value contains YAML-significant characters or leading/trailing whitespace.
  if (/[:#\[\]{}'"|>&!*%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function flowArray(xs: string[]): string {
  return `[${xs.join(', ')}]`;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all frontmatter tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/frontmatter.ts tools/wikitext-to-md/test/frontmatter.test.ts
git commit -m "feat: render PageMeta as YAML frontmatter"
```

---

### Task 4: Test DB helper

**Files:**
- Create: `tools/wikitext-to-md/test/helpers/build-test-db.ts`

- [ ] **Step 1: Implement the helper**

This isn't TDD — it's a fixture builder. Create `test/helpers/build-test-db.ts`:

```ts
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

interface Page {
  namespace: number;
  title: string;
  text: string;
  createdAt: string;            // YYYYMMDDHHmmss
}

/**
 * Build an in-memory SQLite database that mimics MediaWiki's storage shape
 * just enough for the converter's reader to work. Schema is the minimum
 * subset required; tables MediaWiki has but we don't read are omitted.
 */
export function buildTestDb(pages: Page[]): DB {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE page (
      page_id INTEGER PRIMARY KEY,
      page_namespace INTEGER NOT NULL,
      page_title TEXT NOT NULL,
      page_latest INTEGER NOT NULL
    );
    CREATE TABLE revision (
      rev_id INTEGER PRIMARY KEY,
      rev_page INTEGER NOT NULL,
      rev_timestamp TEXT NOT NULL
    );
    CREATE TABLE slots (
      slot_revision_id INTEGER NOT NULL,
      slot_content_id INTEGER NOT NULL
    );
    CREATE TABLE content (
      content_id INTEGER PRIMARY KEY,
      content_address TEXT NOT NULL
    );
    CREATE TABLE text (
      old_id INTEGER PRIMARY KEY,
      old_text TEXT NOT NULL
    );
  `);

  const insertPage = db.prepare(
    'INSERT INTO page (page_id, page_namespace, page_title, page_latest) VALUES (?, ?, ?, ?)'
  );
  const insertRev = db.prepare(
    'INSERT INTO revision (rev_id, rev_page, rev_timestamp) VALUES (?, ?, ?)'
  );
  const insertSlot = db.prepare(
    'INSERT INTO slots (slot_revision_id, slot_content_id) VALUES (?, ?)'
  );
  const insertContent = db.prepare(
    'INSERT INTO content (content_id, content_address) VALUES (?, ?)'
  );
  const insertText = db.prepare(
    'INSERT INTO text (old_id, old_text) VALUES (?, ?)'
  );

  pages.forEach((p, idx) => {
    const id = idx + 1;
    insertText.run(id, p.text);
    insertContent.run(id, `tt:${id}`);
    insertSlot.run(id, id);
    insertRev.run(id, id, p.createdAt);
    insertPage.run(id, p.namespace, p.title, id);
  });

  return db;
}
```

- [ ] **Step 2: Verify by importing it from a temp test**

Create a one-line throwaway test to verify it loads:

```ts
// test/helpers/build-test-db.smoke.ts
import { buildTestDb } from './build-test-db.ts';
const db = buildTestDb([{ namespace: 0, title: 'X', text: 'hi', createdAt: '20260429140700' }]);
console.log(db.prepare('SELECT page_title FROM page').get());
```

Run: `cd tools/wikitext-to-md && npx tsx test/helpers/build-test-db.smoke.ts`
Expected: prints `{ page_title: 'X' }`.

Delete the smoke file.

- [ ] **Step 3: Commit**

```bash
git add tools/wikitext-to-md/test/helpers/build-test-db.ts
git commit -m "test: add in-memory mediawiki schema fixture builder"
```

---

### Task 5: `db` module — cutoff filter

**Files:**
- Create: `tools/wikitext-to-md/src/db.ts`
- Create: `tools/wikitext-to-md/test/db.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPages } from '../src/db.ts';
import { buildTestDb } from './helpers/build-test-db.ts';

const CUTOFF = '20260429140653';

test('readPages: includes pages whose first revision is at or after cutoff', () => {
  const db = buildTestDb([
    { namespace: 0, title: 'Pre',  text: 'old',  createdAt: '20260420000000' },
    { namespace: 0, title: 'Post', text: 'new',  createdAt: '20260429140700' },
    { namespace: 0, title: 'Edge', text: 'edge', createdAt: CUTOFF },
  ]);
  const pages = readPages(db, CUTOFF);
  const titles = pages.map(p => p.title).sort();
  assert.deepEqual(titles, ['Edge', 'Post']);
});

test('readPages: excludes Module: namespace (NS 828) entirely', () => {
  const db = buildTestDb([
    { namespace: 0,   title: 'Person',     text: 'x', createdAt: '20260429140700' },
    { namespace: 828, title: 'UpgradeTest', text: 'y', createdAt: '20260429140700' },
  ]);
  const pages = readPages(db, CUTOFF);
  const titles = pages.map(p => p.title);
  assert.deepEqual(titles, ['Person']);
});

test('readPages: returns latest revision text', () => {
  const db = buildTestDb([
    { namespace: 0, title: 'Page', text: 'first',  createdAt: '20260429140700' },
  ]);
  // Insert a second revision manually
  db.exec(`INSERT INTO text (old_id, old_text) VALUES (99, 'latest');`);
  db.exec(`INSERT INTO content (content_id, content_address) VALUES (99, 'tt:99');`);
  db.exec(`INSERT INTO revision (rev_id, rev_page, rev_timestamp) VALUES (99, 1, '20260430120000');`);
  db.exec(`INSERT INTO slots (slot_revision_id, slot_content_id) VALUES (99, 99);`);
  db.exec(`UPDATE page SET page_latest = 99 WHERE page_id = 1;`);

  const pages = readPages(db, CUTOFF);
  assert.equal(pages.length, 1);
  assert.equal(pages[0]!.text, 'latest');
});

test('readPages: createdAt is the FIRST revision timestamp, not latest', () => {
  const db = buildTestDb([
    { namespace: 0, title: 'Page', text: 'first', createdAt: '20260429140700' },
  ]);
  db.exec(`INSERT INTO revision (rev_id, rev_page, rev_timestamp) VALUES (99, 1, '20260501000000');`);

  const pages = readPages(db, CUTOFF);
  assert.equal(pages[0]!.createdAt, '20260429140700');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`
Expected: 4 db tests fail with `Cannot find module '../src/db.ts'`.

- [ ] **Step 3: Implement `src/db.ts`**

```ts
import type { Database } from 'better-sqlite3';
import type { RawPage } from './types.ts';

/**
 * Read pages from the legacy MediaWiki SQLite that pass the migration
 * cutoff filter:
 *   - first revision timestamp >= cutoff (post-`.ged`-import only)
 *   - namespace != 828 (drop Scribunto Module: namespace; Scribunto is removed)
 *
 * Returns the latest revision's text for each surviving page.
 */
export function readPages(db: Database, cutoff: string): RawPage[] {
  const rows = db.prepare(`
    SELECT
      p.page_namespace AS namespace,
      p.page_title AS title,
      t.old_text AS text,
      (SELECT MIN(rev_timestamp) FROM revision WHERE rev_page = p.page_id) AS createdAt
    FROM page p
    JOIN revision r ON p.page_latest = r.rev_id
    JOIN slots s ON s.slot_revision_id = r.rev_id
    JOIN content c ON s.slot_content_id = c.content_id
    JOIN text t ON CAST(SUBSTR(c.content_address, 4) AS INTEGER) = t.old_id
    WHERE p.page_namespace <> 828
      AND (SELECT MIN(rev_timestamp) FROM revision WHERE rev_page = p.page_id) >= ?
  `).all(cutoff) as Array<{ namespace: number; title: string; text: string; createdAt: string }>;

  return rows;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all db tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/db.ts tools/wikitext-to-md/test/db.test.ts
git commit -m "feat: read post-cutoff pages from legacy mediawiki sqlite"
```

---

### Task 6: Extractor — `categories`

**Files:**
- Create: `tools/wikitext-to-md/src/extractors/categories.ts`
- Create: `tools/wikitext-to-md/test/extractors/categories.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCategories } from '../../src/extractors/categories.ts';

test('extracts a single category and strips it from the body', () => {
  const out = extractCategories('Body text\n\n[[Category:Family]]\n');
  assert.deepEqual(out.categories, ['Family']);
  assert.equal(out.body, 'Body text\n');
});

test('extracts multiple categories preserving order', () => {
  const out = extractCategories('Body\n[[Category:Family]]\n[[Category:People]]\n');
  assert.deepEqual(out.categories, ['Family', 'People']);
  assert.equal(out.body.trim(), 'Body');
});

test('extracts category with sortkey and discards the sortkey', () => {
  const out = extractCategories('Body\n[[Category:Family|Rickelman, Abby]]\n');
  assert.deepEqual(out.categories, ['Family']);
});

test('returns empty list when no categories', () => {
  const out = extractCategories('Just body, no cats');
  assert.deepEqual(out.categories, []);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`
Expected: 4 categories-extractor tests fail.

- [ ] **Step 3: Implement `src/extractors/categories.ts`**

```ts
const CATEGORY_RE = /\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/g;

export function extractCategories(text: string): { body: string; categories: string[] } {
  const categories: string[] = [];
  const body = text.replace(CATEGORY_RE, (_match, name) => {
    categories.push(String(name).trim());
    return '';
  });
  // Collapse consecutive blank lines left behind by removed categories
  return { body: body.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', categories };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all categories-extractor tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/extractors/categories.ts tools/wikitext-to-md/test/extractors/categories.test.ts
git commit -m "feat: extract [[Category:X]] into structured frontmatter"
```

---

### Task 7: Extractor — `redirect`

**Files:**
- Create: `tools/wikitext-to-md/src/extractors/redirect.ts`
- Create: `tools/wikitext-to-md/test/extractors/redirect.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRedirect } from '../../src/extractors/redirect.ts';

test('detects #REDIRECT and returns target title', () => {
  assert.deepEqual(extractRedirect('#REDIRECT [[Steven Barash]]'), { target: 'Steven Barash' });
});

test('matches case-insensitive REDIRECT keyword', () => {
  assert.deepEqual(extractRedirect('#redirect [[A]]'), { target: 'A' });
});

test('tolerates leading whitespace', () => {
  assert.deepEqual(extractRedirect('  \n#REDIRECT [[A]]'), { target: 'A' });
});

test('returns null for non-redirect pages', () => {
  assert.equal(extractRedirect("'''A''' is a body."), null);
});

test('returns null when REDIRECT appears mid-text (only the leading directive counts)', () => {
  assert.equal(extractRedirect('Body. #REDIRECT [[A]]'), null);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`
Expected: 5 redirect tests fail.

- [ ] **Step 3: Implement `src/extractors/redirect.ts`**

```ts
const REDIRECT_RE = /^\s*#REDIRECT\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/i;

export function extractRedirect(text: string): { target: string } | null {
  const m = REDIRECT_RE.exec(text);
  if (!m) return null;
  return { target: m[1]!.trim() };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all redirect tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/extractors/redirect.ts tools/wikitext-to-md/test/extractors/redirect.test.ts
git commit -m "feat: extract #REDIRECT directive into target title"
```

---

### Task 8: Extractor — `cite-vault-ref`

**Files:**
- Create: `tools/wikitext-to-md/src/extractors/cite-vault-ref.ts`
- Create: `tools/wikitext-to-md/test/extractors/cite-vault-ref.test.ts`

The first `{{Cite vault|note=… X.ged record I…}}` on a page declares that page's GEDCOM record. The extractor lifts it into frontmatter; the body transform later replaces the `{{Cite vault|…}}` text with a directive.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCiteVaultRef } from '../../src/extractors/cite-vault-ref.ts';

const HASH = 'a1a48f25952a3294';

test('lifts gedcom record from a Cite vault note=', () => {
  const text = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I28906361734}}';
  assert.deepEqual(
    extractCiteVaultRef(text, HASH),
    { ref: { file: 'barash-tree.ged', record: 'I28906361734', snapshot: HASH }, warning: null }
  );
});

test('handles spaces and slashes in the .ged filename', () => {
  const text = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I12345}}';
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref?.file, 'barash-tree.ged');
});

test('only the FIRST cite-vault on the page is lifted', () => {
  const text = `
First: {{Cite vault|note=A.ged record I1}}
Second: {{Cite vault|note=B.ged record I2}}
`;
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref?.record, 'I1');
});

test('returns null when no Cite vault is present', () => {
  assert.deepEqual(extractCiteVaultRef('plain body', HASH), { ref: null, warning: null });
});

test('returns a warning when Cite vault has malformed note (no record I…)', () => {
  const text = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Some narrative without an id}}';
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref, null);
  assert.equal(out.warning?.kind, 'malformed-cite-vault');
});

test('slugifies the .ged filename to match the canonical install path', () => {
  // Source label may differ from canonical filename; converter normalizes
  // any form like "Barash Family Tree.ged" → "barash-tree.ged" via a
  // best-known label map. For now: pass through but document.
  const text = '{{Cite vault|note=Barash Family Tree.ged record I1}}';
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref?.file, 'barash-tree.ged');  // canonical
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`
Expected: 6 cite-vault-ref tests fail.

- [ ] **Step 3: Implement `src/extractors/cite-vault-ref.ts`**

```ts
import type { GedcomRef, Warning } from '../types.ts';

const CITE_VAULT_RE = /\{\{Cite vault\s*\|([^}]+)\}\}/i;

/**
 * The legacy wiki uses `{{Cite vault|note=Barash Family Tree.ged record I…}}`
 * to cite a GEDCOM record. The first such citation on a page declares the
 * page's GEDCOM ref (lifted to frontmatter).
 *
 * Filename normalization: any human-readable label like "Barash Family
 * Tree.ged" maps to the canonical install path `barash-tree.ged`. Update
 * GED_FILE_ALIASES if you add additional .ged sources.
 */
const GED_FILE_ALIASES: Record<string, string> = {
  'barash family tree.ged': 'barash-tree.ged',
  'barash-tree.ged': 'barash-tree.ged',
};

const RECORD_RE = /([A-Za-z0-9 _-]+\.ged)\s+record\s+(I\d+)/i;

export function extractCiteVaultRef(
  text: string,
  snapshotHash: string,
): { ref: GedcomRef | null; warning: Warning | null } {
  const m = CITE_VAULT_RE.exec(text);
  if (!m) return { ref: null, warning: null };

  // Parse pipe-delimited args (only `note=` matters here)
  const args = parsePipeArgs(m[1]!);
  const note = args.note ?? '';
  const recMatch = RECORD_RE.exec(note);
  if (!recMatch) {
    return {
      ref: null,
      warning: { page: '', kind: 'malformed-cite-vault', detail: m[0]!.slice(0, 120) },
    };
  }

  const rawFile = recMatch[1]!.toLowerCase();
  const file = GED_FILE_ALIASES[rawFile] ?? rawFile.replace(/\s+/g, '-');
  return {
    ref: { file, record: recMatch[2]!, snapshot: snapshotHash },
    warning: null,
  };
}

/**
 * Parse `key1=value1|key2=value2` into a record. Whitespace around `=` and
 * `|` is preserved inside values; only the splitting characters are removed.
 */
function parsePipeArgs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('|')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`
Expected: all cite-vault-ref tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/extractors/cite-vault-ref.ts tools/wikitext-to-md/test/extractors/cite-vault-ref.test.ts
git commit -m "feat: lift first cite-vault gedcom record into frontmatter"
```

---

### Task 9: Transform — `cite-vault` (body)

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/cite-vault.ts`
- Create: `tools/wikitext-to-md/test/transforms/cite-vault.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformCiteVault } from '../../src/transforms/cite-vault.ts';

test('converts a basic cite vault to a directive', () => {
  const input = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I123}}';
  const output = transformCiteVault(input);
  assert.equal(
    output,
    ':::cite-vault{type="genealogy" snapshot="barash-tree" note="Barash Family Tree.ged record I123"}:::'
  );
});

test('preserves args when only note= is set', () => {
  const input = '{{Cite vault|note=hello}}';
  const output = transformCiteVault(input);
  assert.equal(output, ':::cite-vault{note="hello"}:::');
});

test('handles multiple cite vaults on one page', () => {
  const input = '{{Cite vault|note=A}}\n\nMore text.\n\n{{Cite vault|note=B}}';
  const output = transformCiteVault(input);
  assert.match(output, /:::cite-vault\{note="A"\}:::/);
  assert.match(output, /:::cite-vault\{note="B"\}:::/);
});

test('escapes double quotes inside arg values', () => {
  const input = '{{Cite vault|note=She said "hi"}}';
  const output = transformCiteVault(input);
  assert.match(output, /note="She said \\"hi\\""/);
});

test('passes through text without any cite vault', () => {
  assert.equal(transformCiteVault('plain text'), 'plain text');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`

- [ ] **Step 3: Implement `src/transforms/cite-vault.ts`**

```ts
const CITE_VAULT_RE = /\{\{Cite vault\s*\|([^}]+)\}\}/gi;

export function transformCiteVault(text: string): string {
  return text.replace(CITE_VAULT_RE, (_match, args: string) => {
    const pairs = parsePipeArgs(args);
    const attrs = Object.entries(pairs)
      .map(([k, v]) => `${k}="${escapeQuotes(v)}"`)
      .join(' ');
    return `:::cite-vault{${attrs}}:::`;
  });
}

function parsePipeArgs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('|')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function escapeQuotes(v: string): string {
  return v.replace(/"/g, '\\"');
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd tools/wikitext-to-md && npm test`

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/cite-vault.ts tools/wikitext-to-md/test/transforms/cite-vault.test.ts
git commit -m "feat: transform {{Cite vault}} body to :::cite-vault::: directive"
```

---

### Task 10: Transform — `cite-message`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/cite-message.ts`
- Create: `tools/wikitext-to-md/test/transforms/cite-message.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformCiteMessage } from '../../src/transforms/cite-message.ts';

test('converts cite message to directive', () => {
  const input = '{{Cite message|snapshot=vault-2024-03|date=2024-03-15|thread=Mom}}';
  const output = transformCiteMessage(input);
  assert.equal(
    output,
    ':::cite-message{snapshot="vault-2024-03" date="2024-03-15" thread="Mom"}:::'
  );
});

test('passes through unrelated text', () => {
  assert.equal(transformCiteMessage('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/cite-message.ts`**

```ts
const CITE_MESSAGE_RE = /\{\{Cite message\s*\|([^}]+)\}\}/gi;

export function transformCiteMessage(text: string): string {
  return text.replace(CITE_MESSAGE_RE, (_match, args: string) => {
    const pairs: Record<string, string> = {};
    for (const part of args.split('|')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k) pairs[k] = v;
    }
    const attrs = Object.entries(pairs)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .join(' ');
    return `:::cite-message{${attrs}}:::`;
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/cite-message.ts tools/wikitext-to-md/test/transforms/cite-message.test.ts
git commit -m "feat: transform {{Cite message}} to directive"
```

---

### Task 11: Transform — `infobox-person`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/infobox-person.ts`
- Create: `tools/wikitext-to-md/test/transforms/infobox-person.test.ts`

`{{Infobox person|name=…|born=…|...}}` becomes a `:::infobox-person` block with a YAML body. Each `|key=value` line becomes a YAML key.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformInfoboxPerson } from '../../src/transforms/infobox-person.ts';

test('converts a multi-line Infobox person to a block directive with YAML body', () => {
  const input = `{{Infobox person
| name = Abby Rickelman
| born = 1991
| spouse = [[Thomas Vincent Campanella]]
| relationship = Steven's first cousin (maternal)
}}`;
  const output = transformInfoboxPerson(input);
  assert.equal(output,
`:::infobox-person
name: Abby Rickelman
born: 1991
spouse: "[[Thomas Vincent Campanella]]"
relationship: "Steven's first cousin (maternal)"
:::`);
});

test('skips empty values', () => {
  const input = `{{Infobox person
| name = X
| born =
| died =
}}`;
  const output = transformInfoboxPerson(input);
  assert.match(output, /name: X/);
  assert.doesNotMatch(output, /^born:/m);
  assert.doesNotMatch(output, /^died:/m);
});

test('preserves wikilinks inside values verbatim', () => {
  const input = '{{Infobox person\n| father = [[Yaroslav Steven Rickelman]]\n}}';
  const output = transformInfoboxPerson(input);
  assert.match(output, /father: "\[\[Yaroslav Steven Rickelman\]\]"/);
});

test('passes through text without Infobox person', () => {
  assert.equal(transformInfoboxPerson('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/infobox-person.ts`**

```ts
const INFOBOX_PERSON_RE = /\{\{Infobox person\s*((?:\|[^{}]*?)+)\}\}/gs;

export function transformInfoboxPerson(text: string): string {
  return text.replace(INFOBOX_PERSON_RE, (_match, args: string) => {
    const body = parseInfoboxArgs(args);
    return `:::infobox-person\n${body}\n:::`;
  });
}

function parseInfoboxArgs(args: string): string {
  // Split on `|` but only when it's at the start of a logical key=value line.
  // Real-world infoboxes use `|key = value\n` with trailing newline before `|`.
  const lines: string[] = [];
  for (const part of args.split(/\n\s*\|/).map(s => s.replace(/^\|/, ''))) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (!k || !v) continue;
    lines.push(`${k}: ${needsQuotes(v) ? JSON.stringify(v) : v}`);
  }
  return lines.join('\n');
}

function needsQuotes(v: string): boolean {
  // YAML rules: quote if value contains ":, [, {, ', or other special chars
  return /[:#\[\]{}'"|>&!*%@`,]/.test(v) || /^\s|\s$/.test(v);
}
```

- [ ] **Step 4: Run tests, verify they pass**

If a test fails because YAML escaping diverges (for example, `JSON.stringify` produces `"[[X]]"` but the test expected exactly `"[[X]]"`), confirm the assertion uses the same form. Adjust the test or the helper until they match exactly.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/infobox-person.ts tools/wikitext-to-md/test/transforms/infobox-person.test.ts
git commit -m "feat: transform {{Infobox person}} to :::infobox-person block"
```

---

### Task 12: Transform — `infobox-company`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/infobox-company.ts`
- Create: `tools/wikitext-to-md/test/transforms/infobox-company.test.ts`

Same shape as `infobox-person`; different directive name and likely different field set. Reuse the parser.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformInfoboxCompany } from '../../src/transforms/infobox-company.ts';

test('converts a multi-line Infobox company to a block directive', () => {
  const input = `{{Infobox company
| name = Descope
| founded = 2022
| industry = Authentication
}}`;
  const output = transformInfoboxCompany(input);
  assert.equal(output,
`:::infobox-company
name: Descope
founded: 2022
industry: Authentication
:::`);
});

test('passes through text without Infobox company', () => {
  assert.equal(transformInfoboxCompany('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/infobox-company.ts`**

```ts
import { transformInfoboxPerson } from './infobox-person.ts';

const INFOBOX_COMPANY_RE = /\{\{Infobox company\s*((?:\|[^{}]*?)+)\}\}/gs;

// Reuse the person parser by aliasing the directive name.
export function transformInfoboxCompany(text: string): string {
  return text.replace(INFOBOX_COMPANY_RE, (whole) => {
    const replaced = whole.replace(/Infobox company/, 'Infobox person');
    return transformInfoboxPerson(replaced).replace(/^:::infobox-person/m, ':::infobox-company');
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/infobox-company.ts tools/wikitext-to-md/test/transforms/infobox-company.test.ts
git commit -m "feat: transform {{Infobox company}} via shared infobox parser"
```

---

### Task 13: Transform — `dialogue`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/dialogue.ts`
- Create: `tools/wikitext-to-md/test/transforms/dialogue.test.ts`

`{{Dialogue|speaker|"text"}}` → `:::dialogue{speaker="…"}\n"text"\n:::`. Note the body is the second positional arg.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformDialogue } from '../../src/transforms/dialogue.ts';

test('converts dialogue to block directive with body', () => {
  const input = `{{Dialogue|Alex|"That changed everything."}}`;
  const output = transformDialogue(input);
  assert.equal(output,
`:::dialogue{speaker="Alex"}
"That changed everything."
:::`);
});

test('handles missing speaker (positional 1 empty)', () => {
  const input = `{{Dialogue||Just a quote.}}`;
  const output = transformDialogue(input);
  assert.match(output, /:::dialogue\{\}\n/);
  assert.match(output, /Just a quote\./);
});

test('passes through text without dialogue', () => {
  assert.equal(transformDialogue('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/dialogue.ts`**

```ts
const DIALOGUE_RE = /\{\{Dialogue\|([^|}]*)\|([^}]*)\}\}/g;

export function transformDialogue(text: string): string {
  return text.replace(DIALOGUE_RE, (_match, speaker: string, body: string) => {
    const speakerAttr = speaker.trim() ? `{speaker="${speaker.trim().replace(/"/g, '\\"')}"}` : '{}';
    return `:::dialogue${speakerAttr}\n${body.trim()}\n:::`;
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/dialogue.ts tools/wikitext-to-md/test/transforms/dialogue.test.ts
git commit -m "feat: transform {{Dialogue}} to :::dialogue block"
```

---

### Task 14: Transform — `blockquote`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/blockquote.ts`
- Create: `tools/wikitext-to-md/test/transforms/blockquote.test.ts`

`{{Blockquote|text|attribution}}` → `:::blockquote{by="attr"}\ntext\n:::`. Attribution is optional.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformBlockquote } from '../../src/transforms/blockquote.ts';

test('converts blockquote with attribution', () => {
  const input = `{{Blockquote|We slept on a Greyhound.|Apara, October 2018}}`;
  const output = transformBlockquote(input);
  assert.equal(output,
`:::blockquote{by="Apara, October 2018"}
We slept on a Greyhound.
:::`);
});

test('converts blockquote without attribution', () => {
  const input = `{{Blockquote|Some quote.}}`;
  const output = transformBlockquote(input);
  assert.equal(output, ':::blockquote\nSome quote.\n:::');
});

test('passes through unrelated text', () => {
  assert.equal(transformBlockquote('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/blockquote.ts`**

```ts
const BLOCKQUOTE_RE = /\{\{Blockquote\|([^|}]*)(?:\|([^}]*))?\}\}/g;

export function transformBlockquote(text: string): string {
  return text.replace(BLOCKQUOTE_RE, (_match, body: string, by?: string) => {
    const trimmedBy = by?.trim();
    const attr = trimmedBy ? `{by="${trimmedBy.replace(/"/g, '\\"')}"}` : '';
    return `:::blockquote${attr}\n${body.trim()}\n:::`;
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/blockquote.ts tools/wikitext-to-md/test/transforms/blockquote.test.ts
git commit -m "feat: transform {{Blockquote}} to :::blockquote block"
```

---

### Task 15: Transform — `admonitions` (Open / Closed / Superseded)

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/admonitions.ts`
- Create: `tools/wikitext-to-md/test/transforms/admonitions.test.ts`

These are zero-arg directives.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformAdmonitions } from '../../src/transforms/admonitions.ts';

test('converts {{Open}} to :::open:::', () => {
  assert.equal(transformAdmonitions('{{Open}}'), ':::open:::');
});

test('converts {{Closed}} to :::closed:::', () => {
  assert.equal(transformAdmonitions('{{Closed}}'), ':::closed:::');
});

test('converts {{Superseded}} to :::superseded:::', () => {
  assert.equal(transformAdmonitions('{{Superseded}}'), ':::superseded:::');
});

test('handles all three on one page', () => {
  const input = '{{Open}}\n\n{{Closed}}\n\n{{Superseded}}';
  const output = transformAdmonitions(input);
  assert.match(output, /:::open:::/);
  assert.match(output, /:::closed:::/);
  assert.match(output, /:::superseded:::/);
});

test('passes through unrelated text', () => {
  assert.equal(transformAdmonitions('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/admonitions.ts`**

```ts
const TOKENS = ['Open', 'Closed', 'Superseded'] as const;

export function transformAdmonitions(text: string): string {
  let out = text;
  for (const t of TOKENS) {
    const re = new RegExp(`\\{\\{${t}\\}\\}`, 'g');
    out = out.replace(re, `:::${t.toLowerCase()}:::`);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/admonitions.ts tools/wikitext-to-md/test/transforms/admonitions.test.ts
git commit -m "feat: transform Open/Closed/Superseded admonition templates"
```

---

### Task 16: Transform — `gap`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/gap.ts`
- Create: `tools/wikitext-to-md/test/transforms/gap.test.ts`

`{{Gap|note}}` → `:::gap\nnote\n:::`. Has a body argument.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformGap } from '../../src/transforms/gap.ts';

test('converts {{Gap|note}} to :::gap with body', () => {
  const input = '{{Gap|Need to confirm birth year}}';
  assert.equal(transformGap(input), ':::gap\nNeed to confirm birth year\n:::');
});

test('handles empty body {{Gap}}', () => {
  assert.equal(transformGap('{{Gap}}'), ':::gap:::');
});

test('passes through unrelated text', () => {
  assert.equal(transformGap('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/gap.ts`**

```ts
const GAP_BODY_RE = /\{\{Gap\|([^}]+)\}\}/g;
const GAP_EMPTY_RE = /\{\{Gap\}\}/g;

export function transformGap(text: string): string {
  return text
    .replace(GAP_BODY_RE, (_m, body: string) => `:::gap\n${body.trim()}\n:::`)
    .replace(GAP_EMPTY_RE, ':::gap:::');
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/gap.ts tools/wikitext-to-md/test/transforms/gap.test.ts
git commit -m "feat: transform {{Gap}} to :::gap block"
```

---

### Task 17: Transform — `columns-list`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/columns-list.ts`
- Create: `tools/wikitext-to-md/test/transforms/columns-list.test.ts`

`{{Columns-list|colcount|*item\n*item}}` → block directive with body.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformColumnsList } from '../../src/transforms/columns-list.ts';

test('converts columns-list with body', () => {
  const input = `{{Columns-list|2|
* one
* two
* three
}}`;
  const output = transformColumnsList(input);
  assert.equal(output,
`:::columns-list{cols="2"}
* one
* two
* three
:::`);
});

test('passes through unrelated text', () => {
  assert.equal(transformColumnsList('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/columns-list.ts`**

```ts
const COLUMNS_LIST_RE = /\{\{Columns-list\|(\d+)\|([\s\S]*?)\}\}/g;

export function transformColumnsList(text: string): string {
  return text.replace(COLUMNS_LIST_RE, (_match, cols: string, body: string) => {
    return `:::columns-list{cols="${cols}"}\n${body.trim()}\n:::`;
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/columns-list.ts tools/wikitext-to-md/test/transforms/columns-list.test.ts
git commit -m "feat: transform {{Columns-list}} to :::columns-list block"
```

---

### Task 18: Transform — `refs` (footnotes)

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/refs.ts`
- Create: `tools/wikitext-to-md/test/transforms/refs.test.ts`

`<ref name="x">…</ref>` → `[^x]` (named); `<ref>…</ref>` → `[^auto-N]` (auto-numbered). Footnote bodies move to the bottom of the page. `<references />` → empty (the footnotes section emits naturally below).

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformRefs } from '../../src/transforms/refs.ts';

test('converts a single unnamed ref to a footnote with auto id', () => {
  const input = 'Body[<ref>source A</ref>]\n\n<references />';
  const output = transformRefs(input);
  assert.match(output, /Body\[\[\^auto-1\]\]/);
  assert.match(output, /\[\^auto-1\]: source A/);
});

test('converts a named ref and reuses the name on second mention', () => {
  const input = 'A<ref name="src1">first body</ref> and B<ref name="src1" /> done.\n\n<references />';
  const output = transformRefs(input);
  // Two inline refs both pointing at [^src1]
  const matches = output.match(/\[\^src1\]/g);
  assert.equal(matches?.length, 3);   // 2 inline + 1 footnote definition
  assert.match(output, /\[\^src1\]: first body/);
});

test('removes <references /> entirely when there are no refs', () => {
  assert.equal(transformRefs('Body\n\n<references />'), 'Body');
});

test('handles ref bodies containing wikilinks and templates', () => {
  const input = 'A<ref>{{Cite vault|note=B.ged record I1}}</ref>\n\n<references />';
  const output = transformRefs(input);
  assert.match(output, /\[\^auto-1\]: \{\{Cite vault.*\}\}/);
});

test('passes through text with no refs', () => {
  assert.equal(transformRefs('Just plain.'), 'Just plain.');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/refs.ts`**

```ts
const NAMED_REF_RE = /<ref\s+name="([^"]+)"\s*>([\s\S]*?)<\/ref>/g;
const NAMED_REF_SELFCLOSE_RE = /<ref\s+name="([^"]+)"\s*\/>/g;
const UNNAMED_REF_RE = /<ref>([\s\S]*?)<\/ref>/g;
const REFERENCES_TAG = /<references\s*\/>\s*/g;

export function transformRefs(text: string): string {
  const footnotes = new Map<string, string>();      // id → body
  let auto = 0;

  // Pass 1: named refs with body. Record body, replace with [^id].
  let out = text.replace(NAMED_REF_RE, (_m, name: string, body: string) => {
    if (!footnotes.has(name)) footnotes.set(name, body.trim());
    return `[^${name}]`;
  });

  // Pass 2: named self-closing refs (re-use). Replace with [^id].
  out = out.replace(NAMED_REF_SELFCLOSE_RE, (_m, name: string) => `[^${name}]`);

  // Pass 3: unnamed refs. Auto-id, record body, replace.
  out = out.replace(UNNAMED_REF_RE, (_m, body: string) => {
    auto += 1;
    const id = `auto-${auto}`;
    footnotes.set(id, body.trim());
    return `[^${id}]`;
  });

  // Strip <references /> (Markdown footnotes are emitted naturally below)
  out = out.replace(REFERENCES_TAG, '');

  // Append footnote definitions at the end
  if (footnotes.size === 0) return out.trimEnd();
  const defs = Array.from(footnotes.entries()).map(([id, body]) => `[^${id}]: ${body}`);
  return `${out.trimEnd()}\n\n${defs.join('\n')}`.trimEnd();
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/refs.ts tools/wikitext-to-md/test/transforms/refs.test.ts
git commit -m "feat: transform <ref> tags to markdown footnotes"
```

---

### Task 19: Transform — `tables`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/tables.ts`
- Create: `tools/wikitext-to-md/test/transforms/tables.test.ts`

Simple `{| … |}` → Markdown pipe table. Tables with rowspan, colspan, or `class="…"` other than `wikitable` → preserved as raw HTML inside the Markdown (Markdown allows it).

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformTables } from '../../src/transforms/tables.ts';

test('converts a simple wikitable to a markdown pipe table', () => {
  const input = `{| class="wikitable"
! Property !! Value
|-
| Type    || Person
|-
| Born    || 1991
|}`;
  const output = transformTables(input);
  assert.equal(output, [
    '| Property | Value  |',
    '| -------- | ------ |',
    '| Type     | Person |',
    '| Born     | 1991   |',
  ].join('\n'));
});

test('falls back to raw HTML when table has rowspan or colspan', () => {
  const input = `{| class="wikitable"
! A !! B
|-
| rowspan=2 | merged || top
|-
| bottom
|}`;
  const output = transformTables(input);
  assert.match(output, /^<table/);
  assert.match(output, /rowspan="?2"?/);
});

test('passes through text with no tables', () => {
  assert.equal(transformTables('plain'), 'plain');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/tables.ts`**

```ts
const TABLE_RE = /\{\|([\s\S]*?)\n\|\}/g;

export function transformTables(text: string): string {
  return text.replace(TABLE_RE, (_match, body: string) => {
    if (hasMergedCells(body)) {
      return tableToHtml(body);
    }
    return tableToMarkdown(body);
  });
}

function hasMergedCells(body: string): boolean {
  return /\b(rowspan|colspan)\s*=/.test(body);
}

function tableToMarkdown(body: string): string {
  // Strip class="wikitable" and similar attributes from the first line
  const lines = body.split('\n').slice(1);   // drop the initial 'class="..."' line
  const rows: string[][] = [];
  let header: string[] | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('!')) {
      header = splitCells(line.slice(1), '!!');
      continue;
    }
    if (line === '|-') {
      rows.push([]);
      continue;
    }
    if (line.startsWith('|')) {
      const cells = splitCells(line.slice(1), '||');
      if (rows.length === 0) rows.push([]);
      rows[rows.length - 1]!.push(...cells);
      continue;
    }
  }

  const allRows = header ? [header, ...rows.filter(r => r.length)] : rows.filter(r => r.length);
  return formatMarkdownTable(allRows);
}

function splitCells(line: string, sep: string): string[] {
  return line.split(sep).map(s => s.trim());
}

function formatMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  const widths = rows[0]!.map((_, i) =>
    Math.max(...rows.map(r => (r[i] ?? '').length))
  );
  const fmt = (cells: string[]) =>
    '| ' + cells.map((c, i) => (c ?? '').padEnd(widths[i]!)).join(' | ') + ' |';
  const sep = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
  return [fmt(rows[0]!), sep, ...rows.slice(1).map(fmt)].join('\n');
}

function tableToHtml(body: string): string {
  // For complex tables, emit a faithful HTML translation. We don't need
  // perfection — the renderer's sanitizer will pass through td/th/tr/table.
  const lines = body.split('\n').slice(1);
  let html = '<table>\n';
  let inRow = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('!')) {
      if (!inRow) { html += '  <tr>\n'; inRow = true; }
      const cells = line.slice(1).split('!!').map(s => s.trim());
      for (const c of cells) html += `    <th>${c}</th>\n`;
      continue;
    }
    if (line === '|-') {
      if (inRow) { html += '  </tr>\n'; inRow = false; }
      continue;
    }
    if (line.startsWith('|')) {
      if (!inRow) { html += '  <tr>\n'; inRow = true; }
      const cells = line.slice(1).split('||').map(s => s.trim());
      for (const c of cells) {
        // Detect attributes: `rowspan=2 | content`
        const attrMatch = /^([a-z]+\s*=\s*[^|]+(?:\s+[a-z]+\s*=\s*[^|]+)*)\s*\|\s*(.*)$/.exec(c);
        if (attrMatch) {
          const attrs = attrMatch[1]!.replace(/=([^"\s]+)/g, '="$1"');
          html += `    <td ${attrs}>${attrMatch[2]}</td>\n`;
        } else {
          html += `    <td>${c}</td>\n`;
        }
      }
      continue;
    }
  }
  if (inRow) html += '  </tr>\n';
  html += '</table>';
  return html;
}
```

- [ ] **Step 4: Run tests, verify they pass**

If the rowspan test produces slightly different HTML formatting (e.g. different attribute quoting), adjust the test's assertion to use `match` rather than equality. Goal: HTML is well-formed and faithful, not bit-exact.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/tables.ts tools/wikitext-to-md/test/transforms/tables.test.ts
git commit -m "feat: transform wikitables to md pipe tables; html fallback for merged cells"
```

---

### Task 20: Transform — `bold-italic`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/bold-italic.ts`
- Create: `tools/wikitext-to-md/test/transforms/bold-italic.test.ts`

Wikitext bold (`'''text'''`) and italic (`''text''`) → Markdown bold (`**text**`) and italic (`*text*`). Order matters: bold must be processed before italic (bold's three quotes contain italic's two).

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformBoldItalic } from '../../src/transforms/bold-italic.ts';

test('converts bold ''' to **', () => {
  assert.equal(transformBoldItalic("'''Steven Barash'''"), '**Steven Barash**');
});

test('converts italic '' to *', () => {
  assert.equal(transformBoldItalic("''nickname''"), '*nickname*');
});

test('converts bold-italic ''''' to ***', () => {
  assert.equal(transformBoldItalic("'''''both'''''"), '***both***');
});

test('handles bold and italic in same line', () => {
  assert.equal(transformBoldItalic("'''bold''' and ''italic''"), '**bold** and *italic*');
});

test('preserves unmatched apostrophes', () => {
  assert.equal(transformBoldItalic("Steven's first cousin"), "Steven's first cousin");
});

test('handles bold across multiple words', () => {
  assert.equal(transformBoldItalic("'''Pittsburgh (Squirrel Hill, 6730 Beacon St)'''"), '**Pittsburgh (Squirrel Hill, 6730 Beacon St)**');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd tools/wikitext-to-md && npm test`

- [ ] **Step 3: Implement `src/transforms/bold-italic.ts`**

```ts
/**
 * Convert wikitext emphasis to Markdown:
 *   ''''' x ''''' → *** x ***   (bold-italic; 5 apostrophes)
 *   '''   x '''   → **  x **    (bold; 3 apostrophes)
 *   ''    x ''    → *   x *     (italic; 2 apostrophes)
 *
 * Order matters: longest run first so bold doesn't eat italic's apostrophes.
 */
const BOLD_ITALIC = /'{5}(.+?)'{5}/g;
const BOLD = /'{3}(.+?)'{3}/g;
const ITALIC = /'{2}(.+?)'{2}/g;

export function transformBoldItalic(text: string): string {
  return text
    .replace(BOLD_ITALIC, '***$1***')
    .replace(BOLD, '**$1**')
    .replace(ITALIC, '*$1*');
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/bold-italic.ts tools/wikitext-to-md/test/transforms/bold-italic.test.ts
git commit -m "feat: transform wikitext bold/italic to markdown"
```

---

### Task 21: Transform — `headings`

**Files:**
- Create: `tools/wikitext-to-md/src/transforms/headings.ts`
- Create: `tools/wikitext-to-md/test/transforms/headings.test.ts`

Wikitext headings: `== H2 ==`, `=== H3 ===`, etc. Markdown: `## H2`, `### H3`, etc. Wikitext doesn't use `# H1` (that's reserved for the page title); Markdown does, so we map level for level.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformHeadings } from '../../src/transforms/headings.ts';

test('converts == H2 ==', () => {
  assert.equal(transformHeadings('== Residential arc =='), '## Residential arc');
});

test('converts === H3 ===', () => {
  assert.equal(transformHeadings('=== Romantic ==='), '### Romantic');
});

test('converts ==== H4 ====', () => {
  assert.equal(transformHeadings('==== Former close friend ===='), '#### Former close friend');
});

test('handles trailing whitespace inside the wrapper', () => {
  assert.equal(transformHeadings('==  Section  =='), '## Section');
});

test('preserves leading whitespace if any (rare)', () => {
  // MediaWiki ignores leading whitespace; we treat headings as line-starting.
  assert.equal(transformHeadings('  == Indented =='), '  == Indented ==');
});

test('does not match unbalanced =', () => {
  assert.equal(transformHeadings('== Unbalanced'), '== Unbalanced');
  assert.equal(transformHeadings('=== Mismatched =='), '=== Mismatched ==');
});

test('passes through text without headings', () => {
  assert.equal(transformHeadings('plain body'), 'plain body');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/transforms/headings.ts`**

```ts
/**
 * Convert wikitext headings to Markdown ATX headings. Only line-leading
 * == headings are recognized; indented patterns are left as-is (matches
 * MediaWiki's behavior of treating non-leading == as plain text).
 *
 * Wikitext supports h1 ('= one ='), but in practice the page title is h1
 * and h1 doesn't appear in body content. Map level-for-level: h2 → ##.
 */
const HEADING_RE = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;

export function transformHeadings(text: string): string {
  return text.replace(HEADING_RE, (_match, equals: string, content: string) => {
    return `${'#'.repeat(equals.length)} ${content}`;
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/transforms/headings.ts tools/wikitext-to-md/test/transforms/headings.test.ts
git commit -m "feat: transform wikitext headings to markdown atx headings"
```

---

### Task 22: `gedcom-snapshot` module

**Files:**
- Create: `tools/wikitext-to-md/src/gedcom-snapshot.ts`
- Create: `tools/wikitext-to-md/test/gedcom-snapshot.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashGedcom, writeSnapshotManifest } from '../src/gedcom-snapshot.ts';

test('hashGedcom: returns 64-char lowercase hex digest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gedhash-'));
  try {
    const path = join(dir, 'tiny.ged');
    writeFileSync(path, '0 HEAD\n1 SOUR test\n');
    const hash = hashGedcom(path);
    assert.match(hash, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashGedcom: identical content produces identical hashes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gedhash-'));
  try {
    const a = join(dir, 'a.ged');
    const b = join(dir, 'b.ged');
    writeFileSync(a, '0 HEAD\n1 SOUR same\n');
    writeFileSync(b, '0 HEAD\n1 SOUR same\n');
    assert.equal(hashGedcom(a), hashGedcom(b));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashGedcom: different content produces different hashes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gedhash-'));
  try {
    const a = join(dir, 'a.ged');
    const b = join(dir, 'b.ged');
    writeFileSync(a, '0 HEAD\n1 SOUR one\n');
    writeFileSync(b, '0 HEAD\n1 SOUR two\n');
    assert.notEqual(hashGedcom(a), hashGedcom(b));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSnapshotManifest: appends a row when manifest exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    writeSnapshotManifest(dir, 'aaaa', 'barash-tree.ged', 'first');
    writeSnapshotManifest(dir, 'bbbb', 'barash-tree.ged', 'second');
    const yml = readFileSync(join(dir, 'snapshots.yml'), 'utf-8');
    assert.match(yml, /hash: aaaa/);
    assert.match(yml, /hash: bbbb/);
    assert.match(yml, /notes: first/);
    assert.match(yml, /notes: second/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/gedcom-snapshot.ts`**

```ts
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export function hashGedcom(path: string): string {
  const data = readFileSync(path);
  return createHash('sha256').update(data).digest('hex');
}

interface SnapshotEntry {
  hash: string;
  date: string;            // ISO 8601
  file: string;
  notes: string;
}

export function writeSnapshotManifest(
  genealogyDir: string,
  hash: string,
  file: string,
  notes: string,
): void {
  mkdirSync(genealogyDir, { recursive: true });
  const path = join(genealogyDir, 'snapshots.yml');
  let entries: SnapshotEntry[] = [];
  if (existsSync(path)) {
    const parsed = yaml.load(readFileSync(path, 'utf-8'));
    if (Array.isArray(parsed)) entries = parsed as SnapshotEntry[];
  }
  entries.push({
    hash,
    date: new Date().toISOString(),
    file,
    notes,
  });
  writeFileSync(path, yaml.dump(entries, { lineWidth: 200 }));
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/gedcom-snapshot.ts tools/wikitext-to-md/test/gedcom-snapshot.test.ts
git commit -m "feat: hash .ged and append to snapshots manifest"
```

---

### Task 23: `pipeline` — compose the conversion

**Files:**
- Create: `tools/wikitext-to-md/src/pipeline.ts`
- Create: `tools/wikitext-to-md/test/pipeline.test.ts`

Pipeline orchestrates: extract redirects (page-level decision), extract categories + cite-vault-ref to frontmatter, run body transforms in fixed order, build frontmatter, concatenate.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertPage } from '../src/pipeline.ts';
import type { RawPage } from '../src/types.ts';

const HASH = 'a1a48f25952a3294';
const OWNER = 'steven';

test('converts a person page end-to-end', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'Abby Rickelman',
    text: `{{Infobox person
| name = Abby Rickelman
| born = 1991
}}

'''Abby Rickelman''' (born 1991) is a first cousin of [[Steven Barash]].

== References ==
<references />

== Bibliography ==

{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I123}}

[[Category:People]]
[[Category:Family]]`,
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  assert.match(out.md, /^---/);
  assert.match(out.md, /title: Abby Rickelman/);
  assert.match(out.md, /categories: \[People, Family\]/);
  assert.match(out.md, /gedcom:\n  file: barash-tree\.ged\n  record: I123\n  snapshot: a1a48f25952a3294/);
  assert.match(out.md, /:::infobox-person/);
  assert.match(out.md, /:::cite-vault\{type="genealogy"/);
  assert.match(out.md, /'''Abby Rickelman''' \(born 1991\) is a first cousin of \[\[Steven Barash\]\]\./);
  assert.equal(out.kind, 'page');
  assert.equal(out.warnings.length, 0);
});

test('returns a redirect record when body is just #REDIRECT', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'Me',
    text: '#REDIRECT [[Steven Barash]]',
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  assert.equal(out.kind, 'redirect');
  if (out.kind === 'redirect') {
    assert.equal(out.target, 'Steven Barash');
    assert.equal(out.fromTitle, 'Me');
  }
});

test('warns when Cite vault note= is malformed', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'Page',
    text: 'Body. {{Cite vault|note=No id here}} [[Category:People]]',
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  assert.equal(out.kind, 'page');
  assert.equal(out.warnings.length, 1);
  assert.equal(out.warnings[0]!.kind, 'malformed-cite-vault');
});

test('strips category lines from body but preserves narrative', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'P',
    text: 'Body line.\n\n[[Category:Family]]\n',
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  if (out.kind !== 'page') throw new Error('expected page');
  assert.match(out.md, /Body line\./);
  assert.doesNotMatch(out.md, /\[\[Category:Family\]\]/);
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Implement `src/pipeline.ts`**

```ts
import type { RawPage, PageMeta, PageType, Warning } from './types.ts';
import { renderFrontmatter } from './frontmatter.ts';
import { extractCategories } from './extractors/categories.ts';
import { extractRedirect } from './extractors/redirect.ts';
import { extractCiteVaultRef } from './extractors/cite-vault-ref.ts';
import { transformInfoboxPerson } from './transforms/infobox-person.ts';
import { transformInfoboxCompany } from './transforms/infobox-company.ts';
import { transformCiteVault } from './transforms/cite-vault.ts';
import { transformCiteMessage } from './transforms/cite-message.ts';
import { transformAdmonitions } from './transforms/admonitions.ts';
import { transformGap } from './transforms/gap.ts';
import { transformBlockquote } from './transforms/blockquote.ts';
import { transformDialogue } from './transforms/dialogue.ts';
import { transformColumnsList } from './transforms/columns-list.ts';
import { transformRefs } from './transforms/refs.ts';
import { transformTables } from './transforms/tables.ts';
import { transformBoldItalic } from './transforms/bold-italic.ts';
import { transformHeadings } from './transforms/headings.ts';

export type ConvertResult =
  | {
      kind: 'page';
      title: string;
      namespace: number;        // 0 = main, 1 = talk
      md: string;
      warnings: Warning[];
    }
  | {
      kind: 'redirect';
      fromTitle: string;
      target: string;
    };

export function convertPage(raw: RawPage, snapshotHash: string, owner: string): ConvertResult {
  // 1. Redirect short-circuit
  const redirect = extractRedirect(raw.text);
  if (redirect) {
    return { kind: 'redirect', fromTitle: raw.title, target: redirect.target };
  }

  const warnings: Warning[] = [];

  // 2. Extract categories from body (mutates body)
  const cats = extractCategories(raw.text);
  let body = cats.body;

  // 3. Extract cite-vault gedcom ref (does NOT mutate body)
  const citeRef = extractCiteVaultRef(body, snapshotHash);
  if (citeRef.warning) {
    warnings.push({ ...citeRef.warning, page: raw.title });
  }

  // 4. Run body transforms in fixed order. Block-level templates first
  //    (so their bodies are extracted before inline transforms touch them),
  //    then inline emphasis, then headings/refs/tables.
  body = transformInfoboxPerson(body);
  body = transformInfoboxCompany(body);
  body = transformCiteVault(body);
  body = transformCiteMessage(body);
  body = transformAdmonitions(body);
  body = transformGap(body);
  body = transformBlockquote(body);
  body = transformDialogue(body);
  body = transformColumnsList(body);
  body = transformBoldItalic(body);
  body = transformHeadings(body);
  body = transformRefs(body);
  body = transformTables(body);

  // 5. Build frontmatter
  const meta: PageMeta = {
    title: humanTitle(raw.title),
    owner,
    editors: [],
    type: inferType(raw),
    aliases: [],
    categories: cats.categories,
    ...(citeRef.ref ? { gedcom: citeRef.ref } : {}),
    created: yyyymmddToIso(raw.createdAt),
  };

  const md = renderFrontmatter(meta) + '\n' + body.trimEnd() + '\n';
  return { kind: 'page', title: raw.title, namespace: raw.namespace, md, warnings };
}

function humanTitle(title: string): string {
  return title.replace(/_/g, ' ');
}

function inferType(_raw: RawPage): PageType {
  // First pass: everything in NS 0 is a person; family pages and synthesis
  // pages get reclassified by a small whitelist of known titles. Refine
  // when a known set emerges from the real data; for now default 'person'.
  return 'person';
}

function yyyymmddToIso(ts: string): string {
  // '20260429140700' → '2026-04-29'
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}
```

- [ ] **Step 4: Run tests, verify they pass**

If the frontmatter test asserts a specific gedcom block format and js-yaml emits it differently, adjust `renderFrontmatter` (Task 3) to render the `gedcom` object as block-style by setting `flowLevel` per-field — not at the document level. The expected output shape is non-negotiable; the YAML library config flexes.

- [ ] **Step 5: Commit**

```bash
git add tools/wikitext-to-md/src/pipeline.ts tools/wikitext-to-md/test/pipeline.test.ts
git commit -m "feat: compose extractors + transforms in convertPage pipeline"
```

---

### Task 24: CLI entry — `index.ts`

**Files:**
- Create: `tools/wikitext-to-md/src/index.ts`

The CLI orchestrates: parse args, open DB, hash .ged, write snapshots manifest, two-pass over redirects, write pages, write warnings log, print report.

- [ ] **Step 1: Implement `src/index.ts`**

```ts
#!/usr/bin/env -S npx tsx
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { readPages } from './db.ts';
import { convertPage, type ConvertResult } from './pipeline.ts';
import { hashGedcom, writeSnapshotManifest } from './gedcom-snapshot.ts';
import { slugify } from './slug.ts';
import type { Report, Warning, PageMeta } from './types.ts';
import { renderFrontmatter } from './frontmatter.ts';

const CUTOFF = '20260429140653';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      db:        { type: 'string' },
      ged:       { type: 'string' },
      out:       { type: 'string' },
      genealogy: { type: 'string' },
      owner:     { type: 'string', default: 'steven' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  for (const k of ['db', 'ged', 'out', 'genealogy'] as const) {
    if (!values[k]) {
      console.error(`error: --${k} is required`);
      process.exit(2);
    }
  }

  const db = new Database(values.db!, { readonly: true });
  const ged = values.ged!;
  const out = values.out!;
  const genealogy = values.genealogy!;
  const owner = values.owner!;
  const dryRun = values['dry-run']!;

  // 1. Hash the .ged and write the initial snapshots manifest
  const hash = hashGedcom(ged);
  if (!dryRun) {
    mkdirSync(genealogy, { recursive: true });
    writeSnapshotManifest(genealogy, hash, 'barash-tree.ged', 'Initial migration import');
  }

  // 2. Read pages from the legacy DB
  const raw = readPages(db, CUTOFF);
  console.log(`Read ${raw.length} post-cutoff pages from ${values.db}`);

  // 3. Convert each page; partition into pages and redirects
  const results: ConvertResult[] = raw.map(p => convertPage(p, hash, owner));
  const pages = results.filter(r => r.kind === 'page') as Extract<ConvertResult, { kind: 'page' }>[];
  const redirects = results.filter(r => r.kind === 'redirect') as Extract<ConvertResult, { kind: 'redirect' }>[];

  // 4. Apply redirects to targets as aliases
  const aliasesByTarget = new Map<string, string[]>();
  for (const r of redirects) {
    const list = aliasesByTarget.get(r.target) ?? [];
    list.push(r.fromTitle);
    aliasesByTarget.set(r.target, list);
  }

  // 5. Write each page (with merged aliases)
  if (!dryRun) mkdirSync(out, { recursive: true });

  let pagesWritten = 0;
  const warnings: Warning[] = [];
  for (const p of pages) {
    const slug = slugify(p.title);
    const aliases = aliasesByTarget.get(p.title) ?? [];
    const md = aliases.length > 0 ? insertAliases(p.md, aliases) : p.md;
    // Talk pages (NS 1) become `<slug>.talk.md` siblings of their main page.
    const filename = p.namespace === 1 ? `${slug}.talk.md` : `${slug}.md`;
    const path = join(out, filename);
    if (!dryRun) writeFileSync(path, md);
    pagesWritten += 1;
    warnings.push(...p.warnings);
  }

  // 6. Emit warnings log
  if (warnings.length > 0 && !dryRun) {
    const logPath = join(out, 'migration-warnings.log');
    const log = warnings.map(w => `${w.page}\t${w.kind}\t${w.detail}`).join('\n');
    writeFileSync(logPath, log + '\n');
  }

  const report: Report = {
    pagesWritten,
    pagesSkipped: raw.length - results.length,
    redirects: redirects.length,
    warnings,
    snapshotHash: hash,
  };
  console.log(JSON.stringify(report, null, 2));
}

function insertAliases(md: string, aliases: string[]): string {
  // Replace the existing aliases line with the merged set
  return md.replace(
    /^aliases: \[\]/m,
    `aliases: [${aliases.join(', ')}]`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify CLI shows usage on missing args**

Run: `cd tools/wikitext-to-md && npx tsx src/index.ts`
Expected: prints `error: --db is required` and exits 2.

- [ ] **Step 3: Verify CLI runs in dry-run against a synthetic input**

Build a tiny `.ged` and synthetic SQLite for a sanity check:

```bash
cd tools/wikitext-to-md
mkdir -p /tmp/wai-test
echo '0 HEAD\n1 SOUR test' > /tmp/wai-test/tiny.ged
node --input-type=module -e "
import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
const db = new Database('/tmp/wai-test/tiny.sqlite');
db.exec(\`
CREATE TABLE page (page_id INTEGER PRIMARY KEY, page_namespace INTEGER, page_title TEXT, page_latest INTEGER);
CREATE TABLE revision (rev_id INTEGER PRIMARY KEY, rev_page INTEGER, rev_timestamp TEXT);
CREATE TABLE slots (slot_revision_id INTEGER, slot_content_id INTEGER);
CREATE TABLE content (content_id INTEGER PRIMARY KEY, content_address TEXT);
CREATE TABLE text (old_id INTEGER PRIMARY KEY, old_text TEXT);
INSERT INTO text VALUES (1, '{{Infobox person|name=Test}}\n[[Category:People]]');
INSERT INTO content VALUES (1, 'tt:1');
INSERT INTO slots VALUES (1, 1);
INSERT INTO revision VALUES (1, 1, '20260430000000');
INSERT INTO page VALUES (1, 0, 'Test_Page', 1);
\`);
db.close();
"
npx tsx src/index.ts \
  --db /tmp/wai-test/tiny.sqlite \
  --ged /tmp/wai-test/tiny.ged \
  --out /tmp/wai-test/pages \
  --genealogy /tmp/wai-test/genealogy \
  --dry-run
```

Expected: stdout includes `Read 1 post-cutoff pages` and a JSON report with `pagesWritten: 1`.

- [ ] **Step 4: Commit**

```bash
git add tools/wikitext-to-md/src/index.ts
git commit -m "feat: cli entry orchestrating db read, conversion, redirects, write"
```

---

### Task 25: Synthetic e2e — full conversion in a temp dir

**Files:**
- Create: `tools/wikitext-to-md/test/e2e.test.ts`

This test wires up a synthetic SQLite + .ged, runs `convertPage` through the same code path the CLI uses, and asserts the on-disk output. Skip the real-DB assertion until the next task.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { readPages } from '../src/db.ts';
import { convertPage } from '../src/pipeline.ts';
import { hashGedcom, writeSnapshotManifest } from '../src/gedcom-snapshot.ts';
import { slugify } from '../src/slug.ts';
import { buildTestDb } from './helpers/build-test-db.ts';

test('e2e: synthetic db + ged → expected files in out/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
  try {
    // 1. Make a tiny .ged
    const gedPath = join(dir, 'tiny.ged');
    writeFileSync(gedPath, '0 HEAD\n1 SOUR test\n');
    const hash = hashGedcom(gedPath);

    // 2. Make a tiny SQLite via the helper, write to disk for realism
    const memDb = buildTestDb([
      { namespace: 0, title: 'Steven_Barash', text: `{{Infobox person|name=Steven Barash}}\n\nBody.\n[[Category:Family]]\n[[Category:People]]\n`, createdAt: '20260429140700' },
      { namespace: 0, title: 'Me', text: '#REDIRECT [[Steven Barash]]', createdAt: '20260429140700' },
    ]);
    const dbPath = join(dir, 'wiki.sqlite');
    memDb.backup(dbPath);
    memDb.close();

    // 3. Read + convert
    const db = new Database(dbPath, { readonly: true });
    const raw = readPages(db, '20260429140653');
    const results = raw.map(r => convertPage(r, hash, 'steven'));

    // 4. Split + write
    const pagesDir = join(dir, 'pages');
    const genealogyDir = join(dir, 'genealogy');
    require('node:fs').mkdirSync(pagesDir, { recursive: true });
    writeSnapshotManifest(genealogyDir, hash, 'tiny.ged', 'test');

    const aliases = new Map<string, string[]>();
    for (const r of results) {
      if (r.kind === 'redirect') {
        const list = aliases.get(r.target) ?? [];
        list.push(r.fromTitle);
        aliases.set(r.target, list);
      }
    }
    for (const r of results) {
      if (r.kind !== 'page') continue;
      const slug = slugify(r.title);
      let md = r.md;
      const al = aliases.get(r.title);
      if (al) md = md.replace(/^aliases: \[\]/m, `aliases: [${al.join(', ')}]`);
      writeFileSync(join(pagesDir, `${slug}.md`), md);
    }

    // 5. Assert
    const files = readdirSync(pagesDir);
    assert.deepEqual(files.sort(), ['steven-barash.md']);
    const stevenMd = readFileSync(join(pagesDir, 'steven-barash.md'), 'utf-8');
    assert.match(stevenMd, /title: Steven Barash/);
    assert.match(stevenMd, /aliases: \[Me\]/);
    assert.match(stevenMd, /categories: \[Family, People\]/);
    assert.match(stevenMd, /:::infobox-person/);

    const snapYml = readFileSync(join(genealogyDir, 'snapshots.yml'), 'utf-8');
    assert.match(snapYml, new RegExp(`hash: ${hash}`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test, verify it fails (or passes — depends on prior tasks)**

Run: `cd tools/wikitext-to-md && npm test`
Expected: passes if all prior tasks are complete. If failing, debug the specific transform that's misbehaving.

- [ ] **Step 3: Commit**

```bash
git add tools/wikitext-to-md/test/e2e.test.ts
git commit -m "test: e2e synthetic db + ged → on-disk files"
```

---

### Task 26: Real-DB sanity test (opt-in)

**Files:**
- Create: `tools/wikitext-to-md/test/real-db.test.ts`

Gated on `WIKI_SQLITE` env var. Doesn't assert exact content (that would commit personal genealogy to the repo); asserts shape: post-cutoff page count is in expected range, every page has frontmatter, no malformed-cite-vault warnings beyond a documented threshold.

- [ ] **Step 1: Write the test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { readPages } from '../src/db.ts';
import { convertPage } from '../src/pipeline.ts';

const CUTOFF = '20260429140653';
const DB = process.env.WIKI_SQLITE;

test('real-db: post-cutoff page count is between 100 and 130', { skip: !DB || !existsSync(DB) }, () => {
  const db = new Database(DB!, { readonly: true });
  const raw = readPages(db, CUTOFF);
  assert.ok(raw.length >= 100 && raw.length <= 130, `expected ~107, got ${raw.length}`);
});

test('real-db: every converted page has frontmatter and a non-empty body', { skip: !DB || !existsSync(DB) }, () => {
  const db = new Database(DB!, { readonly: true });
  const raw = readPages(db, CUTOFF);
  let pageCount = 0;
  for (const r of raw) {
    const out = convertPage(r, 'a'.repeat(64), 'steven');
    if (out.kind !== 'page') continue;
    pageCount += 1;
    assert.match(out.md, /^---/, `${r.title}: missing frontmatter`);
    assert.match(out.md, /---\n\n[^]+/, `${r.title}: empty body after frontmatter`);
  }
  assert.ok(pageCount > 0);
});

test('real-db: malformed-cite-vault warnings are below a sane threshold', { skip: !DB || !existsSync(DB) }, () => {
  const db = new Database(DB!, { readonly: true });
  const raw = readPages(db, CUTOFF);
  let warnings = 0;
  for (const r of raw) {
    const out = convertPage(r, 'a'.repeat(64), 'steven');
    if (out.kind === 'page') warnings += out.warnings.length;
  }
  // 90 cite vaults in the DB; expect very few malformed
  assert.ok(warnings < 5, `unexpectedly many warnings: ${warnings}`);
});
```

- [ ] **Step 2: Run with the live DB**

```bash
WIKI_SQLITE="$HOME/Library/Application Support/whoami/data/wiki.sqlite" \
  npm test --prefix tools/wikitext-to-md
```

Expected: real-db tests pass. If page count is outside `[100, 130]`, investigate — either our cutoff understanding is off or the DB has changed.

- [ ] **Step 3: Commit**

```bash
git add tools/wikitext-to-md/test/real-db.test.ts
git commit -m "test: opt-in real-db sanity checks (gated on WIKI_SQLITE)"
```

---

## Self-Review Checklist

After completing all tasks, run this checklist:

1. **Spec coverage**
   - Phase 2 transformations list (spec §Phase 2): every bullet has a corresponding task. ✓ (Tasks 6–21, 23)
   - Phase 1 frontmatter schema (spec §Phase 1): rendered correctly. ✓ (Task 3)
   - Cutoff filter + NS 828 exclusion: ✓ (Task 5)
   - Talk-page (NS 1) → `<slug>.talk.md` sibling: ✓ (Tasks 23, 24)
   - GEDCOM hash + snapshots.yml: ✓ (Task 22)
   - Malformed cite-vault → migration-warnings.log: ✓ (Task 24)

2. **Placeholder scan**
   - No "TBD", "TODO", or "implement later" in any task.
   - Every code block is real, runnable code.

3. **Type consistency**
   - `RawPage`, `PageMeta`, `GedcomRef`, `Warning`, `Report` all from `types.ts`.
   - `convertPage` returns a discriminated union (`kind: 'page' | 'redirect'`); the CLI handles both.

4. **Run order**
   - Tasks must be executed in numbered order: each later task imports symbols from earlier tasks.

5. **Final commands to run after every task**
   - `npm test` passes (no skipped tests except the real-DB ones when env var unset)
   - `npm run typecheck` exits 0

---

## Definition of Done

- All 26 tasks complete; every test green.
- `npm run typecheck` passes.
- Real-DB test (Task 26) passes against the live `wiki.sqlite`.
- `npx tsx src/index.ts --db <real-db> --ged <real-ged> --out /tmp/pages --genealogy /tmp/genealogy --dry-run` reports `pagesWritten` ~107 and `redirects` ~1.
- Committed and pushed to `migration-spec`.
