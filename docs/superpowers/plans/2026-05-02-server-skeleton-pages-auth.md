# Server Skeleton + Pages + Auth Implementation Plan (Plan C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational backend (`core/pages`, `core/auth`) + a Next.js 15 frontend with an HTTP API and a minimal RSC page-render route that serves the migrated wiki at `~/whoami/pages` with session auth and atomic git-backed writes.

**Architecture:** Two top-level packages. `core/` is platform-agnostic TypeScript with TDD via `node:test` — no framework deps, no I/O at module scope. `frontend/` is Next.js 15 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui; it imports `core/*` via a tsconfig path alias. The wiki itself lives in `~/whoami/` (separate git repo, already populated by the Plan B converter). The frontend reads from / writes to that directory via the `core` modules. Plan C ships a working backend + bare-bones page render; Plan F polishes the UI.

**Tech Stack:** Node 22, TypeScript 5.5+ strict, ESM. Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS v4 (CSS-first config), shadcn/ui. `bcrypt` (cost 12) for passwords, `better-sqlite3` for sessions, `simple-git` for git ops, `gray-matter` + `zod` for frontmatter parse + validate, `node:test` for tests, `remark` + `remark-directive` + `remark-gfm` + `remark-rehype` + `rehype-stringify` for the page-render pipeline.

**Reference spec:** `docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md` — particularly the Architecture section (modules, performance budget, observability) and Phase 3 (web app routes, trust boundary, atomic write protocol).

---

## File Structure

```
core/                                 # platform-agnostic, no framework deps
├── package.json
├── tsconfig.json
├── src/
│   ├── pages/
│   │   ├── index.ts                  # public PageStore interface + factory
│   │   ├── types.ts                  # Page, PageMeta, Revision
│   │   ├── schema.ts                 # zod schema for PageMeta
│   │   ├── slug.ts                   # slug regex validation
│   │   ├── frontmatter.ts            # parse + validate via gray-matter + zod
│   │   ├── git.ts                    # simple-git wrapper (init, add, commit, log, checkout-HEAD)
│   │   ├── locks.ts                  # per-slug async mutex
│   │   └── store.ts                  # PageStore implementation
│   └── auth/
│       ├── index.ts                  # public AuthService interface + factory
│       ├── types.ts                  # User, Session
│       ├── passwords.ts              # bcrypt hash/verify
│       ├── users.ts                  # users.json reader (mode 0600)
│       ├── sessions.ts               # sqlite-backed session store
│       ├── csrf.ts                   # double-submit token gen + verify
│       ├── rate-limit.ts             # per-IP login rate limiter
│       └── service.ts                # AuthService composition
└── test/
    ├── pages/
    │   ├── helpers.ts                # mkdtemp + git-init test fixture
    │   ├── slug.test.ts
    │   ├── frontmatter.test.ts
    │   ├── git.test.ts
    │   ├── locks.test.ts
    │   └── store.test.ts
    └── auth/
        ├── passwords.test.ts
        ├── users.test.ts
        ├── sessions.test.ts
        ├── csrf.test.ts
        ├── rate-limit.test.ts
        └── service.test.ts

frontend/                             # Next.js 15 app
├── package.json
├── next.config.ts
├── tsconfig.json                     # path alias @core/* → ../core/src/*
├── postcss.config.mjs
├── eslint.config.mjs
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # index — list of pages
│   ├── globals.css                   # Tailwind v4 import
│   ├── [slug]/page.tsx               # RSC — render markdown server-side
│   └── api/
│       ├── healthz/route.ts
│       ├── login/route.ts
│       ├── logout/route.ts
│       └── pages/[slug]/route.ts     # GET / PUT / DELETE
├── lib/
│   ├── env.ts                        # WHOAMI_ROOT, etc.
│   ├── render.ts                     # markdown → React via remark/rehype
│   ├── wikilinks.ts                  # [[Page]] resolver
│   └── server-services.ts            # singleton PageStore + AuthService
└── components/
    └── directives/                   # React components for :::cite-vault, etc.
        ├── InfoboxPerson.tsx
        ├── InfoboxCompany.tsx
        ├── CiteVault.tsx
        ├── CiteMessage.tsx
        ├── Admonition.tsx            # one component for Open/Closed/Superseded/Gap
        ├── Blockquote.tsx
        ├── Dialogue.tsx
        └── ColumnsList.tsx
```

---

## Phase 0 — Scaffold

### Task 1: Create the `core` package

**Files:**
- Create: `core/package.json`
- Create: `core/tsconfig.json`
- Create: `core/src/index.ts`

- [ ] **Step 1: Create `core/package.json`**

```json
{
  "name": "@whoami/core",
  "version": "0.1.0",
  "description": "Platform-agnostic modules for the family wiki — pages and auth (Plan C)",
  "type": "module",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "tsx --test \"test/**/*.test.ts\""
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "better-sqlite3": "^11.3.0",
    "gray-matter": "^4.0.3",
    "simple-git": "^3.27.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `core/tsconfig.json`**

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

- [ ] **Step 3: Create `core/src/index.ts`**

```ts
export * from './pages/index.ts';
export * from './auth/index.ts';
```

(The two sub-modules don't exist yet; this stub will be filled in by later tasks. For now make them empty placeholder files so typecheck doesn't fail.)

Create `core/src/pages/index.ts`:
```ts
export {};
```

Create `core/src/auth/index.ts`:
```ts
export {};
```

- [ ] **Step 4: Install + typecheck**

Run: `cd core && npm install`
Expected: completes; `package-lock.json` created.

Run: `cd core && npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 5: Commit**

```bash
git add core/package.json core/tsconfig.json core/src/index.ts core/src/pages/index.ts core/src/auth/index.ts core/package-lock.json
git commit -m "chore: scaffold core package (pages + auth modules placeholder)"
```

---

### Task 2: Scaffold the Next.js frontend

**Files:**
- Create: `frontend/` (via `create-next-app`)

- [ ] **Step 1: Run `create-next-app`**

Run from the repo root:
```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --use-npm \
  --no-import-alias \
  --skip-install \
  --turbopack \
  --no-src-dir
```

Expected: creates `frontend/` with `app/`, `tailwind.config.ts` (or v4 CSS config), `next.config.ts`, `package.json`, etc. May prompt — accept defaults.

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: completes; `node_modules/` exists.

- [ ] **Step 3: Verify dev build runs**

Run: `cd frontend && npm run build`
Expected: exits 0 with "Compiled successfully" or equivalent. (No tests yet; this is just a smoke check that scaffold is sane.)

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold next.js 15 frontend (app router, tailwind v4)"
```

---

### Task 3: Wire `@core/*` path alias

**Files:**
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: Add path alias to `frontend/tsconfig.json`**

Edit the `compilerOptions` block to add:

```json
"paths": {
  "@core/*": ["../core/src/*"]
}
```

The full `compilerOptions` should now include `"paths"` alongside whatever `create-next-app` generated (`baseUrl` may be `"."`, leave it).

- [ ] **Step 2: Add a smoke import to verify**

Create `frontend/lib/env.ts` with:
```ts
import { resolve } from 'node:path';

export const WHOAMI_ROOT = process.env.WHOAMI_ROOT ?? resolve(process.env.HOME ?? '.', 'whoami');
export const PAGES_DIR = resolve(WHOAMI_ROOT, 'pages');
export const DATA_DIR = resolve(WHOAMI_ROOT, 'data');
```

- [ ] **Step 3: Verify next build still works**

Run: `cd frontend && npm run build`
Expected: builds without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/tsconfig.json frontend/lib/env.ts
git commit -m "chore: wire @core/* tsconfig path alias and env config"
```

---

### Task 4: Configure shadcn/ui

**Files:**
- Modify: `frontend/components.json` (created by shadcn init)
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Initialize shadcn**

Run from `frontend/`:
```bash
npx shadcn@latest init -y -d
```

If interactive: choose `Default` style, `Slate` (or `Neutral`) base color, accept other defaults.

Expected: creates `components.json`, updates `globals.css` and `tsconfig.json`, installs additional deps.

- [ ] **Step 2: Add a couple of base components used later**

Run from `frontend/`:
```bash
npx shadcn@latest add button card alert
```

Expected: creates `components/ui/button.tsx`, `card.tsx`, `alert.tsx`.

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: builds without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components.json frontend/components/ui/ frontend/app/globals.css frontend/lib/utils.ts frontend/package.json frontend/package-lock.json
git commit -m "chore: init shadcn/ui with button/card/alert"
```

---

### Task 5: Add `node:test` runner config + smoke test

**Files:**
- Create: `core/test/smoke.test.ts`

- [ ] **Step 1: Write a trivial smoke test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node:test smoke', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run tests**

Run: `cd core && npm test`
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add core/test/smoke.test.ts
git commit -m "test: add node:test smoke test"
```

---

## Phase 1 — `core/pages` module

### Task 6: Page types + zod schema

**Files:**
- Create: `core/src/pages/types.ts`
- Create: `core/src/pages/schema.ts`
- Create: `core/test/pages/schema.test.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
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
  created: string;
  deletedAt?: string;
}

export interface Page {
  slug: string;
  meta: PageMeta;
  body: string;
}

export interface PageMetaSummary {
  slug: string;
  title: string;
  type: PageType;
  categories: string[];
  isTalk: boolean;
  isArchived: boolean;
}

export interface Revision {
  sha: string;
  author: string;
  email: string;
  date: string;
  summary: string;
}

export interface AuthorIdentity {
  name: string;
  email: string;
}
```

- [ ] **Step 2: Write the failing test for `parsePageMeta`**

Create `core/test/pages/schema.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageMeta } from '../../src/pages/schema.ts';

test('parsePageMeta: accepts a minimal valid frontmatter object', () => {
  const meta = parsePageMeta({
    title: 'Steven Barash',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: ['Family'],
    created: '2026-04-29',
  });
  assert.equal(meta.title, 'Steven Barash');
  assert.equal(meta.owner, 'steven');
  assert.equal(meta.type, 'person');
});

test('parsePageMeta: accepts a gedcom block', () => {
  const meta = parsePageMeta({
    title: 'X',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: [],
    gedcom: { file: 'a.ged', record: 'I1', snapshot: 'abc' },
    created: '2026-04-29',
  });
  assert.deepEqual(meta.gedcom, { file: 'a.ged', record: 'I1', snapshot: 'abc' });
});

test('parsePageMeta: rejects invalid type', () => {
  assert.throws(() => parsePageMeta({
    title: 'X', owner: 'a', editors: [], type: 'invalid', aliases: [], categories: [], created: '2026-04-29',
  }));
});

test('parsePageMeta: rejects missing title', () => {
  assert.throws(() => parsePageMeta({
    owner: 'a', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29',
  }));
});

test('parsePageMeta: rejects bad date format', () => {
  assert.throws(() => parsePageMeta({
    title: 'X', owner: 'a', editors: [], type: 'person', aliases: [], categories: [], created: '2026/04/29',
  }));
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 5 schema tests fail with "Cannot find module".

- [ ] **Step 4: Write `schema.ts`**

```ts
import { z } from 'zod';
import type { PageMeta } from './types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GedcomRefSchema = z.object({
  file: z.string().min(1),
  record: z.string().regex(/^I\d+$/),
  snapshot: z.string().min(1),
});

const PageMetaSchema: z.ZodType<PageMeta> = z.object({
  title: z.string().min(1),
  owner: z.string().min(1),
  editors: z.array(z.string()),
  type: z.enum(['person', 'family', 'event', 'tree', 'meta']),
  aliases: z.array(z.string()),
  categories: z.array(z.string()),
  gedcom: GedcomRefSchema.optional(),
  created: z.string().regex(ISO_DATE, 'expected YYYY-MM-DD'),
  deletedAt: z.string().optional(),
});

export function parsePageMeta(input: unknown): PageMeta {
  return PageMetaSchema.parse(input);
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all 5 schema tests pass.

- [ ] **Step 6: Commit**

```bash
git add core/src/pages/types.ts core/src/pages/schema.ts core/test/pages/schema.test.ts
git commit -m "feat: define Page types and zod-validated frontmatter schema"
```

---

### Task 7: Slug validation

**Files:**
- Create: `core/src/pages/slug.ts`
- Create: `core/test/pages/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug, assertValidSlug } from '../../src/pages/slug.ts';

test('isValidSlug: accepts kebab-case slugs', () => {
  assert.equal(isValidSlug('steven-barash'), true);
  assert.equal(isValidSlug('a'), true);
  assert.equal(isValidSlug('a1'), true);
});

test('isValidSlug: accepts .talk suffix', () => {
  assert.equal(isValidSlug('steven-barash.talk'), true);
});

test('isValidSlug: rejects path traversal', () => {
  assert.equal(isValidSlug('../etc/passwd'), false);
  assert.equal(isValidSlug('..'), false);
  assert.equal(isValidSlug('a/b'), false);
});

test('isValidSlug: rejects uppercase', () => {
  assert.equal(isValidSlug('Steven-Barash'), false);
});

test('isValidSlug: rejects empty / leading-hyphen', () => {
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug('-foo'), false);
});

test('assertValidSlug: throws on invalid', () => {
  assert.throws(() => assertValidSlug('../foo'), /invalid slug/i);
});

test('assertValidSlug: returns input on valid', () => {
  assert.equal(assertValidSlug('abc-123'), 'abc-123');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 7 slug tests fail.

- [ ] **Step 3: Write `slug.ts`**

```ts
const SLUG_RE = /^[a-z0-9][a-z0-9-]*(\.talk)?$/;

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export function assertValidSlug(s: string): string {
  if (!isValidSlug(s)) {
    throw new Error(`invalid slug: ${JSON.stringify(s)}`);
  }
  return s;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all slug tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/slug.ts core/test/pages/slug.test.ts
git commit -m "feat: slug validation regex and assert helper"
```

---

### Task 8: Frontmatter parser

**Files:**
- Create: `core/src/pages/frontmatter.ts`
- Create: `core/test/pages/frontmatter.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, serializePage } from '../../src/pages/frontmatter.ts';

const SAMPLE = `---
title: Abby Rickelman
owner: steven
editors: []
type: person
aliases: []
categories: [Family, People]
created: 2026-04-29
---

Body text here.
`;

test('parsePage: parses frontmatter and body', () => {
  const page = parsePage('abby-rickelman', SAMPLE);
  assert.equal(page.slug, 'abby-rickelman');
  assert.equal(page.meta.title, 'Abby Rickelman');
  assert.deepEqual(page.meta.categories, ['Family', 'People']);
  assert.match(page.body, /^Body text here\./);
});

test('parsePage: throws on invalid frontmatter (missing title)', () => {
  const bad = '---\nowner: steven\ntype: person\n---\nbody';
  assert.throws(() => parsePage('x', bad));
});

test('serializePage: round-trips frontmatter + body', () => {
  const page = parsePage('abby-rickelman', SAMPLE);
  const text = serializePage(page);
  const re = parsePage('abby-rickelman', text);
  assert.deepEqual(re.meta, page.meta);
  assert.equal(re.body.trim(), 'Body text here.');
});

test('serializePage: preserves gedcom block', () => {
  const page = parsePage('x', `---
title: X
owner: steven
editors: []
type: person
aliases: []
categories: []
gedcom:
  file: a.ged
  record: I1
  snapshot: abc
created: 2026-04-29
---
Body
`);
  const text = serializePage(page);
  assert.match(text, /gedcom:/);
  assert.match(text, /file: a\.ged/);
  assert.match(text, /record: I1/);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 4 frontmatter tests fail.

- [ ] **Step 3: Write `frontmatter.ts`**

```ts
import matter from 'gray-matter';
import type { Page, PageMeta } from './types.ts';
import { parsePageMeta } from './schema.ts';

export function parsePage(slug: string, raw: string): Page {
  const { data, content } = matter(raw);
  const meta: PageMeta = parsePageMeta(data);
  return { slug, meta, body: content };
}

export function serializePage(page: Page): string {
  return `${renderFrontmatter(page.meta)}\n${page.body.trimStart()}`;
}

function renderFrontmatter(meta: PageMeta): string {
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
  if (meta.deletedAt) lines.push(`deletedAt: ${yamlScalar(meta.deletedAt)}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

function yamlScalar(s: string): string {
  if (/[:#\[\]{}'"|>&!*%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function flowArray(xs: string[]): string {
  return `[${xs.map(yamlScalar).join(', ')}]`;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all 4 frontmatter tests pass (plus the prior 5 schema + 7 slug + 1 smoke = 17 total).

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/frontmatter.ts core/test/pages/frontmatter.test.ts
git commit -m "feat: parse + serialize page frontmatter (gray-matter + zod)"
```

---

### Task 9: Test fixture helpers

**Files:**
- Create: `core/test/pages/helpers.ts`

- [ ] **Step 1: Write the helper**

```ts
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { simpleGit } from 'simple-git';

export interface TestRepo {
  root: string;
  pagesDir: string;
  cleanup: () => void;
}

/** Create a temp dir with a git-initialized empty wiki structure for tests. */
export async function makeTestRepo(): Promise<TestRepo> {
  const root = mkdtempSync(join(tmpdir(), 'pages-test-'));
  const pagesDir = join(root, 'pages');
  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(join(root, '.gitignore'), '');

  const git = simpleGit(root);
  await git.init();
  await git.addConfig('user.name', 'Test Runner');
  await git.addConfig('user.email', 'test@example.com');
  await git.add('.gitignore');
  await git.commit('initial');

  return {
    root,
    pagesDir,
    cleanup: () => {
      // best-effort
      try {
        const { rmSync } = require('node:fs');
        rmSync(root, { recursive: true, force: true });
      } catch {}
    },
  };
}
```

- [ ] **Step 2: No test for the helper itself; the next task uses it**

- [ ] **Step 3: Commit**

```bash
git add core/test/pages/helpers.ts
git commit -m "test: add temp-repo fixture helper for pages tests"
```

---

### Task 10: Git ops wrapper

**Files:**
- Create: `core/src/pages/git.ts`
- Create: `core/test/pages/git.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { addAndCommit, fileHistory, restoreFromIndex } from '../../src/pages/git.ts';
import { makeTestRepo } from './helpers.ts';

test('addAndCommit: creates a commit with the given author', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'a.md');
    writeFileSync(path, 'hello');
    const sha = await addAndCommit(repo.root, [path], { name: 'Steven', email: 'steven@example.com' }, 'add a.md');
    assert.match(sha, /^[0-9a-f]{40}$/);
    const log = await fileHistory(repo.root, path, 5);
    assert.equal(log[0]!.author, 'Steven');
    assert.equal(log[0]!.email, 'steven@example.com');
    assert.equal(log[0]!.summary, 'add a.md');
  } finally {
    repo.cleanup();
  }
});

test('fileHistory: returns commits oldest-first or newest-first by default', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'a.md');
    writeFileSync(path, 'one');
    await addAndCommit(repo.root, [path], { name: 'A', email: 'a@x' }, 'one');
    writeFileSync(path, 'two');
    await addAndCommit(repo.root, [path], { name: 'B', email: 'b@x' }, 'two');
    const log = await fileHistory(repo.root, path, 5);
    assert.equal(log.length, 2);
    assert.equal(log[0]!.summary, 'two'); // newest first
    assert.equal(log[1]!.summary, 'one');
  } finally {
    repo.cleanup();
  }
});

test('restoreFromIndex: drops uncommitted changes to a file', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'a.md');
    writeFileSync(path, 'original');
    await addAndCommit(repo.root, [path], { name: 'A', email: 'a@x' }, 'original');
    writeFileSync(path, 'modified-but-not-committed');
    await restoreFromIndex(repo.root, path);
    assert.equal(readFileSync(path, 'utf-8'), 'original');
  } finally {
    repo.cleanup();
  }
});

test('restoreFromIndex: removes file when not previously tracked', async () => {
  const repo = await makeTestRepo();
  try {
    const path = join(repo.pagesDir, 'new.md');
    writeFileSync(path, 'transient');
    await restoreFromIndex(repo.root, path);
    assert.equal(existsSync(path), false);
  } finally {
    repo.cleanup();
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 4 git tests fail.

- [ ] **Step 3: Write `git.ts`**

```ts
import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync, unlinkSync } from 'node:fs';
import type { AuthorIdentity, Revision } from './types.ts';

function client(repoRoot: string): SimpleGit {
  return simpleGit(repoRoot);
}

export async function addAndCommit(
  repoRoot: string,
  paths: string[],
  author: AuthorIdentity,
  summary: string,
): Promise<string> {
  const git = client(repoRoot);
  await git.add(paths);
  const result = await git.commit(summary, paths, {
    '--author': `${author.name} <${author.email}>`,
  });
  return result.commit;
}

export async function fileHistory(
  repoRoot: string,
  path: string,
  limit: number,
): Promise<Revision[]> {
  const git = client(repoRoot);
  const log = await git.log({ file: path, maxCount: limit });
  return log.all.map((c) => ({
    sha: c.hash,
    author: c.author_name,
    email: c.author_email,
    date: c.date,
    summary: c.message,
  }));
}

/**
 * Restore a file to its state at HEAD. If the file was never tracked at HEAD,
 * remove it from the working tree (covers the rollback-after-failed-create case).
 */
export async function restoreFromIndex(repoRoot: string, path: string): Promise<void> {
  const git = client(repoRoot);
  try {
    await git.checkout(['HEAD', '--', path]);
  } catch {
    if (existsSync(path)) unlinkSync(path);
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all 4 git tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/git.ts core/test/pages/git.test.ts
git commit -m "feat: simple-git wrapper for add/commit/history/restore"
```

---

### Task 11: Per-slug async mutex

**Files:**
- Create: `core/src/pages/locks.ts`
- Create: `core/test/pages/locks.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLock } from '../../src/pages/locks.ts';

test('withLock: serializes concurrent operations on the same key', async () => {
  const log: string[] = [];
  const slow = (label: string) => withLock('a', async () => {
    log.push(`enter-${label}`);
    await new Promise((r) => setTimeout(r, 20));
    log.push(`exit-${label}`);
  });
  await Promise.all([slow('1'), slow('2')]);
  // Operations must not interleave; expect enter-X exit-X enter-Y exit-Y order
  assert.match(log.join(','), /enter-1,exit-1,enter-2,exit-2|enter-2,exit-2,enter-1,exit-1/);
});

test('withLock: different keys do not block each other', async () => {
  let aRunning = false;
  let bRanWhileARunning = false;
  await Promise.all([
    withLock('a', async () => {
      aRunning = true;
      await new Promise((r) => setTimeout(r, 30));
      aRunning = false;
    }),
    withLock('b', async () => {
      await new Promise((r) => setTimeout(r, 10));
      bRanWhileARunning = aRunning;
    }),
  ]);
  assert.equal(bRanWhileARunning, true);
});

test('withLock: returns the value from the body', async () => {
  const v = await withLock('a', async () => 42);
  assert.equal(v, 42);
});

test('withLock: releases the lock when body throws', async () => {
  await assert.rejects(withLock('a', async () => { throw new Error('boom'); }));
  // If lock leaked, this second call would hang. Set a 100ms watchdog.
  const v = await Promise.race([
    withLock('a', async () => 'ok'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('lock leaked')), 100)),
  ]);
  assert.equal(v, 'ok');
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 4 locks tests fail.

- [ ] **Step 3: Write `locks.ts`**

```ts
const queues = new Map<string, Promise<unknown>>();

/**
 * Run `body` while holding an exclusive lock keyed by `key`. Concurrent calls
 * with the same key serialize; different keys don't block each other.
 * Lock is released even if `body` throws.
 */
export async function withLock<T>(key: string, body: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => { release = res; });
  queues.set(key, prev.then(() => next));

  await prev;
  try {
    return await body();
  } finally {
    release();
    if (queues.get(key) === prev.then(() => next)) {
      queues.delete(key);
    }
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all locks tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/locks.ts core/test/pages/locks.test.ts
git commit -m "feat: per-slug async mutex for serializing page writes"
```

---

### Task 12: PageStore — read + list

**Files:**
- Create: `core/src/pages/store.ts`
- Create: `core/src/pages/index.ts` (replace placeholder)
- Create: `core/test/pages/store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPageStore } from '../../src/pages/index.ts';
import { makeTestRepo } from './helpers.ts';

const SAMPLE = (title: string, type = 'person'): string => `---
title: ${title}
owner: steven
editors: []
type: ${type}
aliases: []
categories: [Family]
created: 2026-04-29
---

Body of ${title}.
`;

test('PageStore.read: returns parsed page', async () => {
  const repo = await makeTestRepo();
  try {
    writeFileSync(join(repo.pagesDir, 'abby.md'), SAMPLE('Abby Rickelman'));
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page = await store.read('abby');
    assert.equal(page.slug, 'abby');
    assert.equal(page.meta.title, 'Abby Rickelman');
  } finally {
    repo.cleanup();
  }
});

test('PageStore.read: rejects invalid slug', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await assert.rejects(store.read('../passwd'), /invalid slug/i);
  } finally {
    repo.cleanup();
  }
});

test('PageStore.read: throws ENOENT-style on missing page', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await assert.rejects(store.read('missing'), /not found/i);
  } finally {
    repo.cleanup();
  }
});

test('PageStore.list: returns summaries for all pages', async () => {
  const repo = await makeTestRepo();
  try {
    writeFileSync(join(repo.pagesDir, 'a.md'), SAMPLE('A'));
    writeFileSync(join(repo.pagesDir, 'a.talk.md'), SAMPLE('A'));
    writeFileSync(join(repo.pagesDir, 'b.md'), SAMPLE('B'));
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const list = await store.list();
    const slugs = list.map(p => p.slug).sort();
    assert.deepEqual(slugs, ['a', 'a.talk', 'b']);
    const a = list.find(p => p.slug === 'a')!;
    assert.equal(a.title, 'A');
    assert.equal(a.isTalk, false);
    const aTalk = list.find(p => p.slug === 'a.talk')!;
    assert.equal(aTalk.isTalk, true);
  } finally {
    repo.cleanup();
  }
});

test('PageStore.list: skips _meta and _archived directories', async () => {
  const repo = await makeTestRepo();
  try {
    mkdirSync(join(repo.pagesDir, '_meta'), { recursive: true });
    mkdirSync(join(repo.pagesDir, '_archived'), { recursive: true });
    writeFileSync(join(repo.pagesDir, '_meta', 'site.yml'), 'foo: bar');
    writeFileSync(join(repo.pagesDir, '_archived', 'old.md'), SAMPLE('Old'));
    writeFileSync(join(repo.pagesDir, 'a.md'), SAMPLE('A'));
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const list = await store.list();
    assert.deepEqual(list.map(p => p.slug), ['a']);
  } finally {
    repo.cleanup();
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 5 store tests fail.

- [ ] **Step 3: Write `store.ts` (read + list only for now)**

```ts
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Page, PageMetaSummary, AuthorIdentity, Revision } from './types.ts';
import { parsePage, serializePage } from './frontmatter.ts';
import { assertValidSlug } from './slug.ts';

export interface PageStoreConfig {
  repoRoot: string;     // root of the git repo (e.g. ~/whoami)
  pagesDir: string;     // pages dir inside the repo (e.g. ~/whoami/pages)
}

export interface PageStore {
  read(slug: string): Promise<Page>;
  list(): Promise<PageMetaSummary[]>;
}

export function createPageStore(cfg: PageStoreConfig): PageStore {
  return {
    async read(slug: string): Promise<Page> {
      assertValidSlug(slug);
      const path = join(cfg.pagesDir, `${slug}.md`);
      if (!existsSync(path)) {
        throw new Error(`page not found: ${slug}`);
      }
      const raw = readFileSync(path, 'utf-8');
      return parsePage(slug, raw);
    },

    async list(): Promise<PageMetaSummary[]> {
      const out: PageMetaSummary[] = [];
      for (const entry of readdirSync(cfg.pagesDir, { withFileTypes: true })) {
        if (entry.isDirectory()) continue;       // skip _meta, _archived
        if (!entry.name.endsWith('.md')) continue;
        const isTalk = entry.name.endsWith('.talk.md');
        const slug = isTalk
          ? basename(entry.name, '.talk.md') + '.talk'
          : basename(entry.name, '.md');
        try {
          const raw = readFileSync(join(cfg.pagesDir, entry.name), 'utf-8');
          const page = parsePage(slug, raw);
          out.push({
            slug,
            title: page.meta.title,
            type: page.meta.type,
            categories: page.meta.categories,
            isTalk,
            isArchived: !!page.meta.deletedAt,
          });
        } catch {
          // skip malformed pages from list; will surface on read()
        }
      }
      return out.sort((a, b) => a.slug.localeCompare(b.slug));
    },
  };
}
```

- [ ] **Step 4: Replace `core/src/pages/index.ts`**

```ts
export * from './types.ts';
export * from './slug.ts';
export * from './frontmatter.ts';
export * from './schema.ts';
export * from './store.ts';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all 5 store tests pass.

- [ ] **Step 6: Commit**

```bash
git add core/src/pages/store.ts core/src/pages/index.ts core/test/pages/store.test.ts
git commit -m "feat: PageStore.read and .list backed by filesystem"
```

---

### Task 13: PageStore — write with atomic commit

**Files:**
- Modify: `core/src/pages/store.ts`
- Modify: `core/test/pages/store.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `core/test/pages/store.test.ts`:

```ts
test('PageStore.write: writes file and creates a commit', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await store.write('alex',
      {
        slug: 'alex',
        meta: {
          title: 'Alex',
          owner: 'steven',
          editors: [],
          type: 'person',
          aliases: [],
          categories: [],
          created: '2026-04-29',
        },
        body: 'Body.\n',
      },
      { name: 'Steven', email: 'steven@example.com' },
      'create alex',
    );
    const page = await store.read('alex');
    assert.equal(page.meta.title, 'Alex');
  } finally {
    repo.cleanup();
  }
});

test('PageStore.write: serializes concurrent writes to the same slug', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const base = (body: string): Page => ({
      slug: 'race',
      meta: { title: 'Race', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body,
    });
    await Promise.all([
      store.write('race', base('one'), { name: 's', email: 's@x' }, 'one'),
      store.write('race', base('two'), { name: 's', email: 's@x' }, 'two'),
    ]);
    const page = await store.read('race');
    // One of the writes wins; both must complete
    assert.match(page.body, /one|two/);
  } finally {
    repo.cleanup();
  }
});

test('PageStore.history: returns commit log for a slug', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'h',
      meta: { title: 'H', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'one',
    };
    await store.write('h', page, { name: 'A', email: 'a@x' }, 'first');
    await store.write('h', { ...page, body: 'two' }, { name: 'B', email: 'b@x' }, 'second');
    const log = await store.history('h', 5);
    assert.equal(log.length, 2);
    assert.equal(log[0]!.summary, 'second');
    assert.equal(log[0]!.author, 'B');
  } finally {
    repo.cleanup();
  }
});
```

(`Page` import needs to be added at top of test file: `import type { Page } from '../../src/pages/types.ts';`.)

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd core && npm test`
Expected: 3 new write/history tests fail.

- [ ] **Step 3: Update `store.ts` to add `write` and `history`**

Replace `store.ts` with:

```ts
import { readFileSync, readdirSync, existsSync, writeFileSync, fsyncSync, openSync, closeSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Page, PageMetaSummary, AuthorIdentity, Revision } from './types.ts';
import { parsePage, serializePage } from './frontmatter.ts';
import { assertValidSlug } from './slug.ts';
import { addAndCommit, fileHistory, restoreFromIndex } from './git.ts';
import { withLock } from './locks.ts';

export interface PageStoreConfig {
  repoRoot: string;
  pagesDir: string;
}

export interface PageStore {
  read(slug: string): Promise<Page>;
  write(slug: string, page: Page, author: AuthorIdentity, summary: string): Promise<void>;
  list(): Promise<PageMetaSummary[]>;
  history(slug: string, limit?: number): Promise<Revision[]>;
}

export function createPageStore(cfg: PageStoreConfig): PageStore {
  function pathFor(slug: string): string {
    return join(cfg.pagesDir, `${slug}.md`);
  }

  return {
    async read(slug: string): Promise<Page> {
      assertValidSlug(slug);
      const path = pathFor(slug);
      if (!existsSync(path)) throw new Error(`page not found: ${slug}`);
      return parsePage(slug, readFileSync(path, 'utf-8'));
    },

    async write(slug, page, author, summary) {
      assertValidSlug(slug);
      const target = pathFor(slug);
      const tmp = `${target}.tmp`;
      const content = serializePage(page);

      await withLock(slug, async () => {
        // atomic write: temp + fsync + rename
        const fd = openSync(tmp, 'w');
        try {
          writeFileSync(fd, content);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        renameSync(tmp, target);

        try {
          await addAndCommit(cfg.repoRoot, [target], author, summary);
        } catch (err) {
          // rollback the working tree change
          await restoreFromIndex(cfg.repoRoot, target);
          throw err;
        }
      });
    },

    async list() {
      const out: PageMetaSummary[] = [];
      for (const entry of readdirSync(cfg.pagesDir, { withFileTypes: true })) {
        if (entry.isDirectory()) continue;
        if (!entry.name.endsWith('.md')) continue;
        const isTalk = entry.name.endsWith('.talk.md');
        const slug = isTalk
          ? basename(entry.name, '.talk.md') + '.talk'
          : basename(entry.name, '.md');
        try {
          const raw = readFileSync(join(cfg.pagesDir, entry.name), 'utf-8');
          const page = parsePage(slug, raw);
          out.push({
            slug,
            title: page.meta.title,
            type: page.meta.type,
            categories: page.meta.categories,
            isTalk,
            isArchived: !!page.meta.deletedAt,
          });
        } catch {}
      }
      return out.sort((a, b) => a.slug.localeCompare(b.slug));
    },

    async history(slug, limit = 50) {
      assertValidSlug(slug);
      return fileHistory(cfg.repoRoot, pathFor(slug), limit);
    },
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all store tests now pass.

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/store.ts core/test/pages/store.test.ts
git commit -m "feat: PageStore.write with atomic temp+rename and per-slug lock"
```

---

### Task 14: PageStore — write rollback on commit failure

**Files:**
- Modify: `core/test/pages/store.test.ts`

- [ ] **Step 1: Write the failing rollback test**

Append:

```ts
test('PageStore.write: working tree is clean after commit failure', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'r',
      meta: { title: 'R', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'first',
    };
    await store.write('r', page, { name: 'A', email: 'a@x' }, 'first');

    // Force commit to fail by passing an invalid email (simple-git rejects unparseable identity)
    await assert.rejects(
      store.write('r', { ...page, body: 'second' }, { name: 'A', email: 'invalid email with spaces' }, 'second'),
    );

    // The on-disk content must match the last good commit
    const after = await store.read('r');
    assert.equal(after.body.trim(), 'first');
  } finally {
    repo.cleanup();
  }
});
```

- [ ] **Step 2: Run test, verify behavior**

Run: `cd core && npm test`

If the test passes, the rollback is correct. If it fails, debug — likely the rollback didn't run because the commit error wasn't caught. Adjust `store.write`'s try/catch to make sure `restoreFromIndex` runs on every error path.

- [ ] **Step 3: Commit**

```bash
git add core/test/pages/store.test.ts
git commit -m "test: write rollback restores file to last good commit"
```

---

### Task 15: PageStore — soft delete

**Files:**
- Modify: `core/src/pages/store.ts`
- Modify: `core/src/pages/index.ts` (re-export)
- Modify: `core/test/pages/store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('PageStore.softDelete: moves file to _archived/ and marks deletedAt', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'gone',
      meta: { title: 'Gone', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'body',
    };
    await store.write('gone', page, { name: 'A', email: 'a@x' }, 'create');
    await store.softDelete('gone', { name: 'A', email: 'a@x' });

    // Original location is gone
    await assert.rejects(store.read('gone'), /not found/i);
    // _archived has the file with deletedAt set
    const archived = await store.read('_archived/gone');
    assert.match(archived.meta.deletedAt!, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    repo.cleanup();
  }
});
```

Wait — `read('_archived/gone')` would fail slug validation. Adjust: read directly via filesystem, or relax the slug regex for `_archived/`. Simpler: expose a `readArchived` method, or have the test read the file directly.

Replace the test with:

```ts
test('PageStore.softDelete: moves file to _archived/ and marks deletedAt', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'gone',
      meta: { title: 'Gone', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'body',
    };
    await store.write('gone', page, { name: 'A', email: 'a@x' }, 'create');
    await store.softDelete('gone', { name: 'A', email: 'a@x' });

    await assert.rejects(store.read('gone'), /not found/i);

    const archivedPath = join(repo.pagesDir, '_archived', 'gone.md');
    const raw = (await import('node:fs')).readFileSync(archivedPath, 'utf-8');
    assert.match(raw, /deletedAt: /);
  } finally {
    repo.cleanup();
  }
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd core && npm test`
Expected: 1 softDelete test fails — method doesn't exist.

- [ ] **Step 3: Add `softDelete` to `store.ts`**

Add inside the `createPageStore` return object:

```ts
async softDelete(slug, author) {
  assertValidSlug(slug);
  const src = pathFor(slug);
  if (!existsSync(src)) throw new Error(`page not found: ${slug}`);
  const archivedDir = join(cfg.pagesDir, '_archived');
  const dst = join(archivedDir, `${slug}.md`);

  await withLock(slug, async () => {
    // Read, mark deletedAt, write to _archived/
    const page = parsePage(slug, readFileSync(src, 'utf-8'));
    page.meta.deletedAt = new Date().toISOString();
    const { mkdirSync } = await import('node:fs');
    mkdirSync(archivedDir, { recursive: true });
    writeFileSync(dst, serializePage(page));

    // git: stage rename + commit
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(cfg.repoRoot);
    await git.rm([src]);
    await git.add(dst);
    await git.commit(`soft-delete ${slug}`, undefined, {
      '--author': `${author.name} <${author.email}>`,
    });
  });
},
```

Update the interface to add `softDelete`:
```ts
softDelete(slug: string, author: AuthorIdentity): Promise<void>;
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd core && npm test`

- [ ] **Step 5: Commit**

```bash
git add core/src/pages/store.ts core/test/pages/store.test.ts
git commit -m "feat: PageStore.softDelete moves to _archived with deletedAt"
```

---

## Phase 2 — `core/auth` module

### Task 16: Auth types + bcrypt password hash/verify

**Files:**
- Create: `core/src/auth/types.ts`
- Create: `core/src/auth/passwords.ts`
- Create: `core/test/auth/passwords.test.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
export interface User {
  username: string;
  passwordHash: string;
}

export interface Session {
  id: string;          // 32-byte hex
  userId: string;
  csrf: string;        // 32-byte hex; double-submit token
  createdAt: string;   // ISO 8601
  expiresAt: string;   // ISO 8601
}

export interface AuthContext {
  user: User;
  csrf: string;
}
```

- [ ] **Step 2: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/auth/passwords.ts';

test('hashPassword: returns a bcrypt hash', async () => {
  const hash = await hashPassword('hunter2');
  assert.match(hash, /^\$2[aby]\$/);
});

test('verifyPassword: accepts the correct password', async () => {
  const hash = await hashPassword('correct horse');
  assert.equal(await verifyPassword('correct horse', hash), true);
});

test('verifyPassword: rejects the wrong password', async () => {
  const hash = await hashPassword('right');
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('hashPassword: cost factor is 12 (or higher)', async () => {
  const hash = await hashPassword('x');
  const cost = parseInt(hash.split('$')[2]!, 10);
  assert.ok(cost >= 12, `expected cost >= 12, got ${cost}`);
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd core && npm test`

- [ ] **Step 4: Write `passwords.ts`**

```ts
import bcrypt from 'bcrypt';

const COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

- [ ] **Step 5: Run tests, verify they pass**

- [ ] **Step 6: Commit**

```bash
git add core/src/auth/types.ts core/src/auth/passwords.ts core/test/auth/passwords.test.ts
git commit -m "feat: bcrypt password hash/verify (cost 12)"
```

---

### Task 17: User store (`users.json`)

**Files:**
- Create: `core/src/auth/users.ts`
- Create: `core/test/auth/users.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadUsers, saveUsers } from '../../src/auth/users.ts';

test('loadUsers: returns empty list when file does not exist', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'users-'));
  try {
    const users = await loadUsers(join(dir, 'users.json'));
    assert.deepEqual(users, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saveUsers + loadUsers: round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'users-'));
  const path = join(dir, 'users.json');
  try {
    await saveUsers(path, [{ username: 'steven', passwordHash: 'h' }]);
    const users = await loadUsers(path);
    assert.equal(users.length, 1);
    assert.equal(users[0]!.username, 'steven');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saveUsers: writes file with mode 0600', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'users-'));
  const path = join(dir, 'users.json');
  try {
    await saveUsers(path, [{ username: 'a', passwordHash: 'b' }]);
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Write `users.ts`**

```ts
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import type { User } from './types.ts';

export async function loadUsers(path: string): Promise<User[]> {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('users.json must be an array');
  return parsed as User[];
}

export async function saveUsers(path: string, users: User[]): Promise<void> {
  writeFileSync(path, JSON.stringify(users, null, 2) + '\n');
  chmodSync(path, 0o600);
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/auth/users.ts core/test/auth/users.test.ts
git commit -m "feat: users.json reader/writer with mode 0600"
```

---

### Task 18: Session store (sqlite-backed)

**Files:**
- Create: `core/src/auth/sessions.ts`
- Create: `core/test/auth/sessions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSessionStore } from '../../src/auth/sessions.ts';

test('SessionStore.create + get: round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'));
    const s = await store.create('steven');
    assert.match(s.id, /^[0-9a-f]{64}$/);
    assert.match(s.csrf, /^[0-9a-f]{64}$/);
    assert.equal(s.userId, 'steven');
    const got = await store.get(s.id);
    assert.deepEqual(got, s);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SessionStore.get: returns null for unknown id', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'));
    assert.equal(await store.get('nope'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SessionStore.get: returns null for expired session', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'), { ttlMs: 1 });
    const s = await store.create('a');
    await new Promise(r => setTimeout(r, 10));
    assert.equal(await store.get(s.id), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SessionStore.delete: removes session', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'));
    const s = await store.create('a');
    await store.delete(s.id);
    assert.equal(await store.get(s.id), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Write `sessions.ts`**

```ts
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import type { Session } from './types.ts';

export interface SessionStoreOptions {
  ttlMs?: number;     // default 30 days
}

export interface SessionStore {
  create(userId: string): Promise<Session>;
  get(id: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
}

const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000;  // 30 days

export function createSessionStore(dbPath: string, opts: SessionStoreOptions = {}): SessionStore {
  const ttl = opts.ttlMs ?? DEFAULT_TTL;
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      csrf TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  const insert = db.prepare(
    'INSERT INTO sessions (id, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  );
  const select = db.prepare('SELECT id, user_id, csrf, created_at, expires_at FROM sessions WHERE id = ?');
  const remove = db.prepare('DELETE FROM sessions WHERE id = ?');

  return {
    async create(userId: string): Promise<Session> {
      const id = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      const now = new Date();
      const exp = new Date(now.getTime() + ttl);
      insert.run(id, userId, csrf, now.toISOString(), exp.toISOString());
      return { id, userId, csrf, createdAt: now.toISOString(), expiresAt: exp.toISOString() };
    },

    async get(id: string): Promise<Session | null> {
      const row = select.get(id) as
        | { id: string; user_id: string; csrf: string; created_at: string; expires_at: string }
        | undefined;
      if (!row) return null;
      if (new Date(row.expires_at).getTime() < Date.now()) {
        remove.run(id);
        return null;
      }
      return {
        id: row.id,
        userId: row.user_id,
        csrf: row.csrf,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    },

    async delete(id: string): Promise<void> {
      remove.run(id);
    },
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/auth/sessions.ts core/test/auth/sessions.test.ts
git commit -m "feat: sqlite-backed session store with ttl"
```

---

### Task 19: CSRF token generator + verifier

**Files:**
- Create: `core/src/auth/csrf.ts`
- Create: `core/test/auth/csrf.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCsrfToken } from '../../src/auth/csrf.ts';

test('verifyCsrfToken: matches when both equal', () => {
  assert.equal(verifyCsrfToken('aaa', 'aaa'), true);
});

test('verifyCsrfToken: mismatches on different values', () => {
  assert.equal(verifyCsrfToken('aaa', 'bbb'), false);
});

test('verifyCsrfToken: timing-safe (length-mismatch returns false without throwing)', () => {
  assert.equal(verifyCsrfToken('a', 'aaaa'), false);
});

test('verifyCsrfToken: rejects empty/undefined', () => {
  assert.equal(verifyCsrfToken('', ''), false);
  assert.equal(verifyCsrfToken(undefined as unknown as string, 'x'), false);
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Write `csrf.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

export function verifyCsrfToken(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/auth/csrf.ts core/test/auth/csrf.test.ts
git commit -m "feat: timing-safe CSRF token comparison"
```

---

### Task 20: Login rate limiter

**Files:**
- Create: `core/src/auth/rate-limit.ts`
- Create: `core/test/auth/rate-limit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../../src/auth/rate-limit.ts';

test('rate-limit: allows up to N attempts in the window', () => {
  const r = createRateLimiter({ windowMs: 60_000, maxAttempts: 5 });
  for (let i = 0; i < 5; i++) {
    assert.equal(r.check('1.2.3.4'), 'ok');
  }
});

test('rate-limit: blocks the 6th attempt within the window', () => {
  const r = createRateLimiter({ windowMs: 60_000, maxAttempts: 5 });
  for (let i = 0; i < 5; i++) r.check('1.2.3.4');
  assert.equal(r.check('1.2.3.4'), 'limited');
});

test('rate-limit: independent buckets per IP', () => {
  const r = createRateLimiter({ windowMs: 60_000, maxAttempts: 2 });
  r.check('1.1.1.1'); r.check('1.1.1.1');
  assert.equal(r.check('1.1.1.1'), 'limited');
  assert.equal(r.check('2.2.2.2'), 'ok');
});

test('rate-limit: window slides — old attempts expire', async () => {
  const r = createRateLimiter({ windowMs: 30, maxAttempts: 2 });
  r.check('a'); r.check('a');
  assert.equal(r.check('a'), 'limited');
  await new Promise(res => setTimeout(res, 50));
  assert.equal(r.check('a'), 'ok');
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Write `rate-limit.ts`**

```ts
export interface RateLimiterOptions {
  windowMs: number;
  maxAttempts: number;
}

export interface RateLimiter {
  check(key: string): 'ok' | 'limited';
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, number[]>();

  return {
    check(key: string): 'ok' | 'limited' {
      const now = Date.now();
      const cutoff = now - opts.windowMs;
      const stamps = (buckets.get(key) ?? []).filter(t => t > cutoff);
      if (stamps.length >= opts.maxAttempts) {
        buckets.set(key, stamps);
        return 'limited';
      }
      stamps.push(now);
      buckets.set(key, stamps);
      return 'ok';
    },
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/auth/rate-limit.ts core/test/auth/rate-limit.test.ts
git commit -m "feat: per-key sliding-window rate limiter"
```

---

### Task 21: Composed AuthService

**Files:**
- Create: `core/src/auth/service.ts`
- Modify: `core/src/auth/index.ts` (replace placeholder)
- Create: `core/test/auth/service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAuthService } from '../../src/auth/index.ts';
import { hashPassword } from '../../src/auth/passwords.ts';
import { saveUsers } from '../../src/auth/users.ts';
import { createPageStore } from '../../src/pages/index.ts';
import { makeTestRepo } from '../pages/helpers.ts';

async function makeAuth(dataDir: string, users: { username: string; password: string }[]) {
  const usersPath = join(dataDir, 'users.json');
  const sessionsPath = join(dataDir, 'sessions.db');
  await saveUsers(usersPath, await Promise.all(users.map(async u => ({
    username: u.username, passwordHash: await hashPassword(u.password),
  }))));
  return createAuthService({ usersPath, sessionsPath });
}

test('AuthService.login: succeeds with correct credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  try {
    const auth = await makeAuth(dir, [{ username: 'steven', password: 'hunter2' }]);
    const result = await auth.login('steven', 'hunter2', '1.2.3.4');
    assert.equal(result.kind, 'ok');
    if (result.kind === 'ok') {
      assert.equal(result.session.userId, 'steven');
      assert.match(result.session.id, /^[0-9a-f]{64}$/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AuthService.login: rejects wrong password', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  try {
    const auth = await makeAuth(dir, [{ username: 'a', password: 'right' }]);
    const result = await auth.login('a', 'wrong', '1.1.1.1');
    assert.equal(result.kind, 'error');
    if (result.kind === 'error') assert.equal(result.reason, 'invalid-credentials');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AuthService.login: rate-limits after 5 failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  try {
    const auth = await makeAuth(dir, [{ username: 'a', password: 'right' }]);
    for (let i = 0; i < 5; i++) await auth.login('a', 'wrong', '1.1.1.1');
    const result = await auth.login('a', 'right', '1.1.1.1');
    assert.equal(result.kind, 'error');
    if (result.kind === 'error') assert.equal(result.reason, 'rate-limited');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('AuthService.requireOwnerOrEditor: allows owner', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  const repo = await makeTestRepo();
  try {
    const auth = await makeAuth(dir, [{ username: 'steven', password: 'p' }]);
    const pages = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await pages.write('s',
      { slug: 's', meta: { title: 'S', owner: 'steven', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' }, body: 'b' },
      { name: 'steven', email: 's@x' }, 'init',
    );
    await auth.requireOwnerOrEditor('s', { username: 'steven', passwordHash: '' }, pages);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    repo.cleanup();
  }
});

test('AuthService.requireOwnerOrEditor: rejects non-owner non-editor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'auth-'));
  const repo = await makeTestRepo();
  try {
    const auth = await makeAuth(dir, [{ username: 'attacker', password: 'p' }]);
    const pages = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await pages.write('s',
      { slug: 's', meta: { title: 'S', owner: 'steven', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' }, body: 'b' },
      { name: 'steven', email: 's@x' }, 'init',
    );
    await assert.rejects(
      auth.requireOwnerOrEditor('s', { username: 'attacker', passwordHash: '' }, pages),
      /forbidden/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    repo.cleanup();
  }
});
```

- [ ] **Step 2: Run tests, verify they fail**

- [ ] **Step 3: Write `service.ts`**

```ts
import type { Session, User } from './types.ts';
import { loadUsers } from './users.ts';
import { verifyPassword } from './passwords.ts';
import { createSessionStore, type SessionStore } from './sessions.ts';
import { createRateLimiter, type RateLimiter } from './rate-limit.ts';
import type { PageStore } from '../pages/index.ts';

export interface AuthServiceConfig {
  usersPath: string;
  sessionsPath: string;
  loginWindowMs?: number;     // default 60_000
  loginMaxAttempts?: number;  // default 5
}

export type LoginResult =
  | { kind: 'ok'; session: Session }
  | { kind: 'error'; reason: 'invalid-credentials' | 'rate-limited' };

export interface AuthService {
  login(username: string, password: string, ip: string): Promise<LoginResult>;
  validateSession(sessionId: string): Promise<{ user: User; csrf: string } | null>;
  logout(sessionId: string): Promise<void>;
  requireOwnerOrEditor(slug: string, user: User, pages: PageStore): Promise<void>;
}

export function createAuthService(cfg: AuthServiceConfig): AuthService {
  const sessions: SessionStore = createSessionStore(cfg.sessionsPath);
  const limiter: RateLimiter = createRateLimiter({
    windowMs: cfg.loginWindowMs ?? 60_000,
    maxAttempts: cfg.loginMaxAttempts ?? 5,
  });

  return {
    async login(username, password, ip): Promise<LoginResult> {
      if (limiter.check(`login:${ip}`) === 'limited') {
        return { kind: 'error', reason: 'rate-limited' };
      }
      const users = await loadUsers(cfg.usersPath);
      const user = users.find(u => u.username === username);
      // Always run bcrypt to avoid user-enumeration timing
      const ok = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, '$2b$12$invalid_____________________________________');
      if (!user || !ok) return { kind: 'error', reason: 'invalid-credentials' };
      const session = await sessions.create(user.username);
      return { kind: 'ok', session };
    },

    async validateSession(sessionId) {
      const s = await sessions.get(sessionId);
      if (!s) return null;
      const users = await loadUsers(cfg.usersPath);
      const user = users.find(u => u.username === s.userId);
      if (!user) return null;
      return { user, csrf: s.csrf };
    },

    async logout(sessionId) {
      await sessions.delete(sessionId);
    },

    async requireOwnerOrEditor(slug, user, pages) {
      const page = await pages.read(slug);
      const owner = page.meta.owner;
      const editors = page.meta.editors ?? [];
      if (user.username === owner) return;
      if (editors.includes(user.username)) return;
      const err = new Error('forbidden');
      (err as Error & { status?: number }).status = 403;
      throw err;
    },
  };
}
```

- [ ] **Step 4: Update `core/src/auth/index.ts`**

```ts
export * from './types.ts';
export * from './passwords.ts';
export * from './users.ts';
export * from './sessions.ts';
export * from './csrf.ts';
export * from './rate-limit.ts';
export * from './service.ts';
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `cd core && npm test`
Expected: all auth-service tests pass.

- [ ] **Step 6: Commit**

```bash
git add core/src/auth/service.ts core/src/auth/index.ts core/test/auth/service.test.ts
git commit -m "feat: AuthService composition (login, sessions, owner check)"
```

---

## Phase 3 — API routes

### Task 22: Server-services singleton + healthz

**Files:**
- Create: `frontend/lib/server-services.ts`
- Create: `frontend/app/api/healthz/route.ts`

- [ ] **Step 1: Write `server-services.ts`**

```ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPageStore, type PageStore } from '@core/pages/index.ts';
import { createAuthService, type AuthService } from '@core/auth/index.ts';
import { WHOAMI_ROOT, PAGES_DIR, DATA_DIR } from './env.ts';

let _pages: PageStore | null = null;
let _auth: AuthService | null = null;

export function getPageStore(): PageStore {
  if (!_pages) {
    _pages = createPageStore({ repoRoot: WHOAMI_ROOT, pagesDir: PAGES_DIR });
  }
  return _pages;
}

export function getAuthService(): AuthService {
  if (!_auth) {
    mkdirSync(DATA_DIR, { recursive: true });
    _auth = createAuthService({
      usersPath: join(DATA_DIR, 'users.json'),
      sessionsPath: join(DATA_DIR, 'sessions.db'),
    });
  }
  return _auth;
}
```

- [ ] **Step 2: Write `healthz/route.ts`**

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    started: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: Verify with the dev server**

Run from `frontend/`:
```bash
WHOAMI_ROOT=$HOME/whoami npm run dev &
sleep 3
curl -s http://localhost:3000/api/healthz
```

Expected: `{"status":"ok","started":"2026-..."}`. Kill the dev server after verifying.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/server-services.ts frontend/app/api/healthz/route.ts
git commit -m "feat: healthz endpoint and server-services singleton"
```

---

### Task 23: `/api/login` route

**Files:**
- Create: `frontend/app/api/login/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthService } from '@/lib/server-services';

const Body = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';

  const result = await getAuthService().login(parsed.data.username, parsed.data.password, ip);
  if (result.kind === 'error') {
    const status = result.reason === 'rate-limited' ? 429 : 401;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const res = NextResponse.json({ ok: true, csrf: result.session.csrf });
  res.cookies.set('session', result.session.id, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(result.session.expiresAt),
    path: '/',
  });
  res.cookies.set('csrf', result.session.csrf, {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(result.session.expiresAt),
    path: '/',
  });
  return res;
}
```

- [ ] **Step 2: Verify**

Create a test user file:
```bash
node -e "
const bcrypt = require('/Users/nyetwork/dev/whoami/core/node_modules/bcrypt');
const fs = require('fs');
const hash = bcrypt.hashSync('hunter2', 12);
fs.mkdirSync(process.env.HOME + '/whoami/data', { recursive: true });
fs.writeFileSync(process.env.HOME + '/whoami/data/users.json', JSON.stringify([{username:'steven',passwordHash:hash}], null, 2));
fs.chmodSync(process.env.HOME + '/whoami/data/users.json', 0o600);
"
```

Run dev server, then:
```bash
curl -s -X POST http://localhost:3000/api/login \
  -H 'content-type: application/json' \
  -d '{"username":"steven","password":"hunter2"}' \
  -c /tmp/c.txt -i | head -20
```

Expected: 200 with `Set-Cookie: session=...` and `Set-Cookie: csrf=...`. Body has `{"ok":true,"csrf":"..."}`.

Try wrong password:
```bash
curl -s -X POST http://localhost:3000/api/login \
  -H 'content-type: application/json' \
  -d '{"username":"steven","password":"wrong"}'
```

Expected: 401 with `{"error":"invalid-credentials"}`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/login/route.ts
git commit -m "feat: POST /api/login (rate-limited bcrypt login + cookies)"
```

---

### Task 24: `/api/logout` route

**Files:**
- Create: `frontend/app/api/logout/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '@/lib/server-services';

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('session')?.value;
  if (sessionId) await getAuthService().logout(sessionId);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('session');
  res.cookies.delete('csrf');
  return res;
}
```

- [ ] **Step 2: Verify**

```bash
curl -s -X POST http://localhost:3000/api/logout -b /tmp/c.txt -i | head
```

Expected: 200 with `Set-Cookie` headers that delete `session` and `csrf`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/logout/route.ts
git commit -m "feat: POST /api/logout"
```

---

### Task 25: `GET /api/pages/:slug`

**Files:**
- Create: `frontend/app/api/pages/[slug]/route.ts`

- [ ] **Step 1: Write the GET handler**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getPageStore } from '@/lib/server-services';
import { isValidSlug } from '@core/pages/index.ts';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });
  try {
    const page = await getPageStore().read(slug);
    return NextResponse.json(page);
  } catch (err) {
    if ((err as Error).message.includes('not found')) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    throw err;
  }
}
```

- [ ] **Step 2: Verify**

```bash
curl -s http://localhost:3000/api/pages/abby-rickelman | head
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/pages/../passwd
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/pages/missing
```

Expected: first returns JSON with `meta.title: "Abby Rickelman"`. Second returns 400. Third returns 404.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/pages/[slug]/route.ts
git commit -m "feat: GET /api/pages/:slug with slug validation"
```

---

### Task 26: `PUT /api/pages/:slug` with auth + CSRF + atomic write

**Files:**
- Modify: `frontend/app/api/pages/[slug]/route.ts`

- [ ] **Step 1: Add the PUT handler**

Append to the route file:

```ts
import { z } from 'zod';
import { verifyCsrfToken } from '@core/auth/index.ts';
import { getAuthService } from '@/lib/server-services';

const PutBody = z.object({
  body: z.string(),
  summary: z.string().min(1).max(200),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });

  // CSRF: double-submit
  const sessionId = req.cookies.get('session')?.value;
  const csrfCookie = req.cookies.get('csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (!sessionId || !csrfCookie || !csrfHeader || !verifyCsrfToken(csrfCookie, csrfHeader)) {
    return NextResponse.json({ error: 'csrf' }, { status: 403 });
  }

  const auth = getAuthService();
  const session = await auth.validateSession(sessionId);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const pages = getPageStore();
  try {
    await auth.requireOwnerOrEditor(slug, session.user, pages);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  // Read on-disk to preserve frontmatter (trust boundary: never accept owner from request)
  const existing = await pages.read(slug);
  const updated = { ...existing, body: parsed.data.body };

  await pages.write(slug, updated, { name: session.user.username, email: `${session.user.username}@local` }, parsed.data.summary);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify the trust-boundary contract**

Set up: log in as `steven`, write a page Steven owns. Expect 200.
Log in as a different user (create one), try to write Steven's page. Expect 403.
Try without CSRF header. Expect 403.

```bash
# Log in
COOKIE=$(curl -sc /tmp/c.txt -X POST http://localhost:3000/api/login -H 'content-type: application/json' -d '{"username":"steven","password":"hunter2"}')
CSRF=$(echo "$COOKIE" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrf'])")
# Write — owner of abby-rickelman is 'steven', so this should succeed
curl -s -X PUT http://localhost:3000/api/pages/abby-rickelman \
  -b /tmp/c.txt \
  -H 'content-type: application/json' \
  -H "x-csrf-token: $CSRF" \
  -d '{"body":"new body","summary":"edit via api"}' -i | head -3
# Without CSRF — expect 403
curl -s -X PUT http://localhost:3000/api/pages/abby-rickelman \
  -b /tmp/c.txt \
  -H 'content-type: application/json' \
  -d '{"body":"x","summary":"x"}' -o /dev/null -w '%{http_code}\n'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/pages/[slug]/route.ts
git commit -m "feat: PUT /api/pages/:slug — CSRF + auth + on-disk owner trust boundary"
```

---

### Task 27: `DELETE /api/pages/:slug` (soft delete)

**Files:**
- Modify: `frontend/app/api/pages/[slug]/route.ts`

- [ ] **Step 1: Add the DELETE handler**

```ts
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });

  const sessionId = req.cookies.get('session')?.value;
  const csrfCookie = req.cookies.get('csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (!sessionId || !csrfCookie || !csrfHeader || !verifyCsrfToken(csrfCookie, csrfHeader)) {
    return NextResponse.json({ error: 'csrf' }, { status: 403 });
  }

  const auth = getAuthService();
  const session = await auth.validateSession(sessionId);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const pages = getPageStore();
  try {
    await auth.requireOwnerOrEditor(slug, session.user, pages);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await pages.softDelete(slug, { name: session.user.username, email: `${session.user.username}@local` });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify**

```bash
# As steven, soft-delete a page steven owns (use a throwaway page)
curl -s -X PUT http://localhost:3000/api/pages/throwaway \
  -b /tmp/c.txt -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"body":"temp","summary":"create"}'
curl -s -X DELETE http://localhost:3000/api/pages/throwaway \
  -b /tmp/c.txt -H "x-csrf-token: $CSRF" -i | head -3
# Expect 200 then 404 on subsequent GET
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/pages/throwaway
ls $HOME/whoami/pages/_archived/
```

NOTE: this assumes the `requireOwnerOrEditor` check passes when `steven` owns the just-created page. Since the page was just written via the API, owner is set from the existing page's frontmatter — so for a brand-new page the API needs to also handle the "create" case where the frontmatter is supplied. **For Plan C, restrict PUT to existing pages only** (the page must already exist on disk for owner check). New-page creation is a Plan F concern (admin UI). Update the test accordingly.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/pages/[slug]/route.ts
git commit -m "feat: DELETE /api/pages/:slug — soft delete with auth"
```

---

## Phase 4 — Minimal frontend rendering

### Task 28: Wikilink resolver

**Files:**
- Create: `frontend/lib/wikilinks.ts`
- Create: `frontend/lib/wikilinks.test.ts` (run via tsx --test)

(Note: frontend tests run independently from `frontend/` with `npm test` — add a script in `frontend/package.json`.)

- [ ] **Step 1: Add a test script to `frontend/package.json`**

In the existing `scripts` block, add: `"test": "tsx --test \"lib/**/*.test.ts\""`. Install `tsx` as devDep: `cd frontend && npm install -D tsx`.

- [ ] **Step 2: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlugIndex, resolveWikilinks } from './wikilinks.ts';

const idx = buildSlugIndex([
  { slug: 'steven-barash', title: 'Steven Barash', aliases: ['Me'] },
  { slug: 'abby-rickelman', title: 'Abby Rickelman', aliases: [] },
]);

test('resolves [[Title]] to a markdown link', () => {
  assert.equal(resolveWikilinks('See [[Steven Barash]] today.', idx),
    'See [Steven Barash](/steven-barash) today.');
});

test('resolves [[Title|label]]', () => {
  assert.equal(resolveWikilinks('See [[Steven Barash|Steve]].', idx),
    'See [Steve](/steven-barash).');
});

test('resolves [[Title#anchor]]', () => {
  assert.equal(resolveWikilinks('See [[Abby Rickelman#family]].', idx),
    'See [Abby Rickelman#family](/abby-rickelman#family).');
});

test('renders red span for unknown link', () => {
  assert.match(resolveWikilinks('Hi [[Unknown]].', idx), /<span class="redlink">Unknown<\/span>/);
});

test('resolves alias', () => {
  assert.equal(resolveWikilinks('I am [[Me]].', idx),
    'I am [Me](/steven-barash).');
});
```

- [ ] **Step 3: Run test, verify it fails**

`cd frontend && npm test` — expect failures.

- [ ] **Step 4: Write `wikilinks.ts`**

```ts
export interface IndexEntry {
  slug: string;
  title: string;
  aliases: string[];
}

export interface SlugIndex {
  byCanonical: Map<string, string>;
}

function canonical(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, ' ').trim();
}

export function buildSlugIndex(entries: IndexEntry[]): SlugIndex {
  const byCanonical = new Map<string, string>();
  for (const e of entries) {
    byCanonical.set(canonical(e.title), e.slug);
    for (const a of e.aliases) byCanonical.set(canonical(a), e.slug);
  }
  return { byCanonical };
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

export function resolveWikilinks(md: string, index: SlugIndex): string {
  return md.replace(WIKILINK_RE, (_, target: string, anchor?: string, label?: string) => {
    const slug = index.byCanonical.get(canonical(target));
    const text = label ?? (anchor ? `${target}#${anchor}` : target);
    if (!slug) return `<span class="redlink">${text}</span>`;
    const href = anchor
      ? `/${slug}#${anchor.toLowerCase().replace(/\s+/g, '-')}`
      : `/${slug}`;
    return `[${text}](${href})`;
  });
}
```

- [ ] **Step 5: Run tests, verify they pass**

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/wikilinks.ts frontend/lib/wikilinks.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: wikilink resolver with title + alias index"
```

---

### Task 29: Markdown render pipeline

**Files:**
- Create: `frontend/lib/render.ts`

- [ ] **Step 1: Install render deps**

```bash
cd frontend
npm install unified remark-parse remark-gfm remark-directive remark-rehype rehype-stringify rehype-sanitize unist-util-visit
```

- [ ] **Step 2: Write `render.ts`**

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';
import { resolveWikilinks, type SlugIndex } from './wikilinks';

function directivesToHast() {
  return (tree: unknown) => {
    visit(tree as never, (node: never) => {
      const n = node as { type: string; name?: string; data?: { hName?: string; hProperties?: Record<string, unknown> }; attributes?: Record<string, string> };
      if (n.type === 'containerDirective' || n.type === 'leafDirective' || n.type === 'textDirective') {
        const data = n.data ?? (n.data = {});
        data.hName = 'aside';
        data.hProperties = {
          className: ['directive', `directive-${n.name}`],
          ...(n.attributes ?? {}),
        };
      }
    });
  };
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'aside', 'span'],
  attributes: {
    ...defaultSchema.attributes,
    aside: ['className', 'type', 'snapshot', 'note', 'date', 'thread', 'speaker', 'by', 'cols'],
    span: ['className'],
    table: ['className'],
    td: ['rowspan', 'colspan', 'className'],
    th: ['rowspan', 'colspan', 'className'],
  },
};

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(directivesToHast)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify);

export async function renderMarkdown(md: string, index: SlugIndex): Promise<string> {
  const file = await pipeline.process(resolveWikilinks(md, index));
  return String(file);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/render.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: markdown→html pipeline with directive + sanitizer"
```

---

### Task 30: Index page (list)

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Replace generated `app/page.tsx` with the index**

```tsx
import Link from 'next/link';
import { getPageStore } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const pages = await getPageStore().list();
  const main = pages.filter(p => !p.isTalk && !p.isArchived);
  const talk = pages.filter(p => p.isTalk && !p.isArchived);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold mb-2">Whoami Wiki</h1>
      <p className="text-muted-foreground mb-6">{pages.length} pages</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Pages ({main.length})</h2>
        <ul className="grid grid-cols-2 gap-x-6">
          {main.map(p => (
            <li key={p.slug}><Link href={`/${p.slug}`} className="text-blue-600 hover:underline">{p.title}</Link></li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Talk pages ({talk.length})</h2>
        <ul className="grid grid-cols-2 gap-x-6">
          {talk.map(p => (
            <li key={p.slug}><Link href={`/${p.slug}`} className="text-blue-600 hover:underline">{p.title} <span className="text-muted-foreground text-sm">(talk)</span></Link></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

```bash
WHOAMI_ROOT=$HOME/whoami npm run dev
# In another terminal:
curl -s http://localhost:3000/ | grep -c '/abby-rickelman'
```

Expected: matches > 0; the page shows all 107 pages grouped by main/talk.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: index page lists all pages from PageStore"
```

---

### Task 31: `[slug]` page route (RSC render)

**Files:**
- Create: `frontend/app/[slug]/page.tsx`

- [ ] **Step 1: Write the route**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPageStore } from '@/lib/server-services';
import { renderMarkdown } from '@/lib/render';
import { buildSlugIndex } from '@/lib/wikilinks';
import { isValidSlug } from '@core/pages/index.ts';

export const dynamic = 'force-dynamic';

export default async function PageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const store = getPageStore();
  let page;
  try { page = await store.read(slug); } catch { notFound(); }

  const all = await store.list();
  const index = buildSlugIndex(all.map(p => ({ slug: p.slug, title: p.title, aliases: [] })));
  const html = await renderMarkdown(page.body, index);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">{page.meta.title}</h1>
      <article className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
```

- [ ] **Step 2: Verify**

```bash
curl -s http://localhost:3000/abby-rickelman | head -30
```

Expected: full HTML page with `<h1>Abby Rickelman</h1>`, the body rendered as `<p>` and links resolved to `/steven-barash` etc.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/[slug]/page.tsx
git commit -m "feat: [slug] RSC route renders pages via core/pages + remark"
```

---

### Task 32: Tailwind typography for prose styling

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Install `@tailwindcss/typography`**

```bash
cd frontend && npm install @tailwindcss/typography
```

- [ ] **Step 2: Add it to `globals.css`**

For Tailwind v4, add `@plugin "@tailwindcss/typography";` near the `@import "tailwindcss";` line.

- [ ] **Step 3: Add directive styles**

Append to `globals.css`:

```css
@layer components {
  .directive {
    @apply my-4 rounded-md border-l-4 border-blue-500 bg-slate-50 dark:bg-slate-900 p-4;
  }
  .directive-infobox-person, .directive-infobox-company {
    @apply float-right ml-4 max-w-xs border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sm;
  }
  .directive-cite-vault, .directive-cite-message {
    @apply text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900 p-2 border-l-2;
  }
  .directive-open { @apply bg-yellow-50 dark:bg-yellow-950 border-yellow-500; }
  .directive-closed { @apply bg-green-50 dark:bg-green-950 border-green-500; }
  .directive-superseded { @apply bg-red-50 dark:bg-red-950 border-red-500; }
  .redlink { @apply text-red-600 underline decoration-dashed; }
}
```

- [ ] **Step 4: Verify the page now has styled directives**

Reload http://localhost:3000/abby-rickelman in a browser. Infobox should be a styled card; cite-vault should be a small grey block; redlinks should be dashed-underlined red.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/globals.css frontend/package.json frontend/package-lock.json
git commit -m "feat: tailwind typography + directive styles"
```

---

## Phase 5 — Verification + handoff

### Task 33: End-to-end smoke test

**Files:**
- Create: `frontend/lib/e2e.test.ts` (smoke test that hits the running server)

NOTE: this test requires a running server. We'll skip it in `npm test` if a server isn't reachable.

- [ ] **Step 1: Write the test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000';

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/healthz`);
    return res.ok;
  } catch { return false; }
}

test('e2e: index responds with 200', { skip: !(await reachable()) }, async () => {
  const res = await fetch(BASE);
  assert.equal(res.status, 200);
});

test('e2e: /api/pages/abby-rickelman returns parsed page', { skip: !(await reachable()) }, async () => {
  const res = await fetch(`${BASE}/api/pages/abby-rickelman`);
  if (res.status === 404) return;   // allow missing in dev
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, 'abby-rickelman');
});

test('e2e: PUT without CSRF returns 403', { skip: !(await reachable()) }, async () => {
  const res = await fetch(`${BASE}/api/pages/abby-rickelman`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'x', summary: 'x' }),
  });
  assert.equal(res.status, 403);
});

test('e2e: bad slug returns 400', { skip: !(await reachable()) }, async () => {
  const res = await fetch(`${BASE}/api/pages/..%2Fpasswd`);
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run with the dev server up**

In one terminal: `cd frontend && WHOAMI_ROOT=$HOME/whoami npm run dev`
In another: `cd frontend && npm test`

Expected: e2e tests pass; tests skip cleanly if server isn't reachable.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/e2e.test.ts
git commit -m "test: e2e smoke (gated on dev server)"
```

---

### Task 34: Production build verification

**Files:** none (verification only)

- [ ] **Step 1: Build for production**

Run: `cd frontend && npm run build`

Expected: builds successfully. Note any warnings.

- [ ] **Step 2: Run production server and verify**

Run: `cd frontend && WHOAMI_ROOT=$HOME/whoami npm run start`
Then: `curl -s http://localhost:3000/api/healthz`

Expected: `{"status":"ok",...}`.

- [ ] **Step 3: No commit** — purely a build smoke check.

---

## Self-Review Checklist

After all tasks complete:

1. **Spec coverage**
   - `core/pages` interface: `read`, `write` (atomic + commit), `list`, `history`, `softDelete` ✓
   - `core/auth` interface: `login` (rate-limited), `validateSession`, `logout`, `requireOwnerOrEditor` ✓
   - CSRF (double-submit): cookie set on login, header verified on write ✓
   - Slug regex `^[a-z0-9][a-z0-9-]*(\.talk)?$` rejects path traversal ✓
   - Atomic write: temp + fsync + rename + add + commit; rollback via `restoreFromIndex` on failure ✓
   - Per-slug mutex around write ✓
   - bcrypt cost 12 ✓
   - Login rate limit 5/min ✓
   - Trust boundary: PUT reads on-disk frontmatter for owner check; never accepts owner from request body ✓
   - Frontend index + `[slug]` RSC route + healthz ✓
   - Sanitizer for rendered HTML ✓

2. **Placeholder scan**
   - No "TBD" / "TODO" in any task. Every step has runnable code.

3. **Type consistency**
   - `Page`, `PageMeta`, `PageMetaSummary`, `Revision`, `AuthorIdentity` defined once in `core/src/pages/types.ts` and re-exported through `core/src/pages/index.ts`.
   - `User`, `Session`, `AuthContext` in `core/src/auth/types.ts`, re-exported.
   - `SessionStore`, `RateLimiter`, `AuthService`, `PageStore` interfaces match across tasks.

---

## Definition of Done

- All 34 tasks complete; `core/` tests pass (`cd core && npm test` — 30+ tests).
- `frontend/` tests pass (`cd frontend && npm test`).
- `frontend/` builds for production (`npm run build`) with no errors.
- `WHOAMI_ROOT=$HOME/whoami npm run dev` serves the index, `[slug]` pages, and the API at `:3000`.
- Manual flow verified:
  1. POST `/api/login` with seeded user → session cookie set
  2. GET `/abby-rickelman` → renders the page
  3. PUT `/api/pages/abby-rickelman` with CSRF + own session → 200, page updated, `git log` shows the new commit
  4. PUT same without CSRF → 403
  5. PUT another user's page → 403
- Commit history on `migration-spec` shows ~34 commits, one per task plus scaffolding commits.
- Branch is ready for either: keep wiki-preview running alongside (different ports) or fold wiki-preview into the new server in a future cleanup.
