# Eval Foundation Implementation Plan (Plan H2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for a working markdown-aware eval suite. Two streams:
1. **Skills + agent docs** are migrated to markdown directives + new `wai` commands so editor agents can author the new wiki correctly.
2. **Eval harness + parser** are introduced — `evals/src/wiki.ts` spins up Next.js + a temp git repo, and a new `parsePageContent` helper extracts directives, headings, and wikilinks from markdown so graders (in Plan H2b) can consume structured data.

**Architecture:** The skills (`plugins/whoami/skills/editorial-guide/SKILL.md`) and the editor agent (`plugins/whoami/agents/editor.md`) are pure docs — rewrite-in-place. The harness wraps `next dev` per test against an isolated `mkdtemp()` vault with `pages/`, `genealogy/`, `data/` and `git init`. The directive parser uses `remark-parse` + `remark-directive` + `remark-gfm` + `unist-util-visit` (same toolchain as the frontend renderer) to walk the AST and emit a typed structured form.

**Tech Stack:** Node `node:test`, `tsx`, `gray-matter` (frontmatter), and remark/unified family for parsing. Tests use `fetch()` against the live dev server. No new runtime stack — these libraries are already present elsewhere in the monorepo.

**Reference spec:** `docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md` — Phase 5 ("Eval rewrite") and the "Authoring evolution" subsection of GEDCOM section.

## Out of scope (deferred to Plan H2b)

- Rewriting individual graders (`graders/*.ts`) to consume `parsePageContent`.
- Porting grader unit-test fixtures (`evals/test/{citations,completeness,reference,vault}.test.ts`) from wikitext to markdown.
- Updating `runner/e2e.ts` (1182 lines) to drive agents against the new wiki.
- Integration tests for security / GEDCOM / atomic write / performance (these need the harness from H2a).

H2a is a **foundation** — at the end, no eval actually runs against the new wiki yet. H2b consumes the foundation.

## Data-safety constraints

- **Never** modify `~/Library/Application Support/whoami/data/wiki.sqlite` (legacy MediaWiki DB).
- The harness creates per-test temp vaults under `os.tmpdir()` and removes them in `after()`. The user's real `~/whoami/` is never touched.
- Editing skills + agent docs touches only files in `plugins/whoami/`.

---

## File Structure

```
plugins/whoami/
├── skills/
│   └── editorial-guide/
│       ├── SKILL.md                        # MODIFY: wikitext → markdown directives
│       └── words-to-watch.md               # KEEP (no wikitext)
└── agents/
    └── editor.md                           # MODIFY: drop wai task/talk/source; new wai commands

evals/
├── package.json                            # MODIFY: add remark/unified deps + test:integration script
├── src/
│   ├── wiki.ts                             # REPLACE: Next.js + temp git harness
│   └── graders/
│       └── parse-page.ts                   # CREATE: directives + headings + wikilinks parser
└── test/
    ├── (existing grader tests left alone — H2b ports them)
    └── integration/
        └── harness.test.ts                 # CREATE: harness smoke
    └── parse-page.test.ts                  # CREATE: parser unit tests
```

---

## Phase 1 — Skills + agent docs

### Task 1: Rewrite `editorial-guide/SKILL.md`

**Files:**
- Modify: `plugins/whoami/skills/editorial-guide/SKILL.md`

219 lines, 26 wikitext patterns. Per the migration spec's Phase 1 mapping table:

| Wikitext (today) | Markdown directive (tomorrow) |
|---|---|
| `{{Infobox person\|name=… birth=…}}` | `:::infobox-person`<br>`name: …`<br>`birth: …`<br>`:::` |
| `{{Cite vault\|type=X snapshot=H note=N}}` | `:::cite-vault{type=X snapshot=H note=N}:::` |
| `{{Cite message\|...}}` | `:::cite-message{...}:::` |
| `{{Open}}` `{{Closed}}` `{{Superseded}}` `{{Gap}}` | `:::open` / `:::closed` / `:::superseded` / `:::gap` (admonitions) |
| `{{Blockquote\|text\|by=Person}}` | `:::blockquote{by="Person"}`<br>`text`<br>`:::` |
| `{{Dialogue\|speaker\|line}}` | `:::dialogue{speaker="speaker"}`<br>`line`<br>`:::` |
| `{{Columns-list\|2\|item1\|item2}}` | `:::columns-list{cols="2"}`<br>`- item1`<br>`- item2`<br>`:::` |
| `<ref>X</ref>` `<ref name="x">X</ref>` `<references />` | `[^autoid]` / `[^x]` (Markdown footnotes) |
| `[[Page]]` `[[Page\|alt]]` | `[[Page]]` `[[Page\|alt]]` (preserved by `remark-wiki-link`) |
| `==Heading==` | `## Heading` |
| `'''bold'''` `''italic''` | `**bold**` `*italic*` |
| `[[File:photo.jpg\|thumb\|right\|caption]]` | `![caption](/assets/photo.jpg)` (asset paths TBD; for the SKILL doc just show the markdown form) |
| `#REDIRECT [[Target]]` | `aliases:` field in frontmatter on the target page |

- [ ] **Step 1: Read the file**

```bash
cat /Users/nyetwork/dev/whoami/plugins/whoami/skills/editorial-guide/SKILL.md
```

- [ ] **Step 2: Find every wikitext example and rewrite it to markdown using the table above**

Use targeted `Edit` calls per occurrence. Don't reflow surrounding prose — only change the code-block snippets and inline references like `{{Cite vault\|...}}`.

Specific transformations to apply (verbatim search→replace where reasonable):

- Replace any code-block fenced ` ```wikitext ` with ` ```markdown `.
- Replace `{{Cite vault\| ` style examples with `:::cite-vault{...}:::` blocks.
- Replace `{{Infobox person ... }}` with a `:::infobox-person` YAML body block.
- Replace `<ref>` / `<references />` with footnote syntax.
- Replace `==Heading==` style examples with `## Heading`.
- The "Episode references" example (`On 14 August, Jane described a disastrous shoot at Tempelhof in a series of five voice notes (see [[Jane and the Tempelhof Disaster]]).`) — wikilinks are preserved, so this snippet is fine as-is; just change the fence label.

If a section is fundamentally about MediaWiki concepts that no longer apply (namespaces, redirects-as-pages, transclusion), trim or rewrite for the new world. Section heading "Page types" stays; just the examples inside change.

- [ ] **Step 3: Verify zero remaining wikitext patterns**

```bash
grep -cE '\{\{(Cite|Infobox|Open|Closed|Blockquote|Dialogue|Gap|Superseded|Columns)|<ref>|wikitext' /Users/nyetwork/dev/whoami/plugins/whoami/skills/editorial-guide/SKILL.md
```

Expected: `0`. (`==Heading==` style might appear in prose mentions; that's OK as long as the EXAMPLE blocks all use markdown.)

- [ ] **Step 4: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add plugins/whoami/skills/editorial-guide/SKILL.md
git commit -m "docs: editorial-guide — convert wikitext examples to markdown directives"
```

---

### Task 2: Rewrite `agents/editor.md`

**Files:**
- Modify: `plugins/whoami/agents/editor.md`

100 lines, 12 wikitext refs, plus references to `wai task` / `wai talk` / `wai source` commands that no longer exist (Plan G dropped them — see `cli/src/index.ts` `REMOVED` set).

- [ ] **Step 1: Read the file**

```bash
cat /Users/nyetwork/dev/whoami/plugins/whoami/agents/editor.md
```

- [ ] **Step 2: Drop the dead-command workflow**

The "Phase 0: Task intake" section uses `wai task claim/read/complete/fail` — those commands are gone. Three options:
- **(a)** Drop the section entirely.
- **(b)** Replace the task workflow with a "task tracking is out-of-band (e.g. Linear, Things, GitHub Issues)" note.
- **(c)** Replace with: tasks are markdown pages under `pages/_meta/tasks/` (a convention) — but the wiki layer doesn't enforce anything.

Pick **(a)** for this rewrite — simplest, and the user can re-introduce a task system later if desired.

The "Phase 2: Source research" section uses `wai source list` and `wai search "..."` — `wai source` is gone, but `wai search` was added in Plan E. Replace `wai source list` with: source pages are regular wiki pages in the `Source` (or however you organize them — the markdown world has no namespaces, so it's just `pages/source-whatsapp.md` etc.); use `wai search` to find them. Note that fenced examples like `{{Cite vault}}` are now `:::cite-vault{...}:::`.

The "Phase 1: Context gathering" uses `wai talk read "Page"` and `wai talk create "Page" -s "Working on page" -c "..."`. Talk pages still exist as `<slug>.talk` markdown pages. Replace with:
- `wai read <slug>.talk` (read)
- Concatenate new content + `wai write <slug>.talk --summary "..."` (append; CLI doesn't have an `append` command — agents use read→edit→write or just `wai edit <slug>.talk`)

A minimum viable pass: rewrite the editor agent to fit into the **read → search → edit → write** vocabulary the new CLI supports. Keep the editorial flow (Phase 1 context, Phase 2 research, Phase 3 drafting, Phase 4 publishing).

- [ ] **Step 3: Convert all `{{wikitext}}` examples to markdown directives**

Same table as Task 1. The `{{Cite vault}}` cross-reference pattern in "Phase 2" — show `:::cite-vault{type=... snapshot=... note=...}:::` instead.

- [ ] **Step 4: Verify**

```bash
grep -cE '\{\{(Cite|Infobox|Open|Closed|Blockquote|Dialogue|Gap|Superseded|Columns)|<ref>|wikitext|wai (task|talk|source|upload|link|changes|category|snapshot|export|import|section|place|auth)' /Users/nyetwork/dev/whoami/plugins/whoami/agents/editor.md
```

Expected: `0`.

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add plugins/whoami/agents/editor.md
git commit -m "docs: editor agent — drop dead wai commands, use markdown directives"
```

---

## Phase 2 — Test harness

### Task 3: Replace `evals/src/wiki.ts` with Next.js harness

**Files:**
- Replace: `evals/src/wiki.ts`
- Modify: `evals/package.json` — add `gray-matter` dep + `test:integration` script

- [ ] **Step 1: Add `gray-matter` and remark deps + integration script**

```bash
cd /Users/nyetwork/dev/whoami/evals
npm install gray-matter
npm install remark-parse remark-directive remark-gfm unified unist-util-visit
```

Edit `evals/package.json` `scripts`:

```json
"test:integration": "tsx --test \"test/integration/**/*.test.ts\""
```

(Keep `"test"` glob unchanged — integration tests are slow and opt-in.)

- [ ] **Step 2: Replace `evals/src/wiki.ts` verbatim**

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import net from 'node:net';
import http from 'node:http';
import matter from 'gray-matter';

const HEALTH_POLL_MS = 200;
const HEALTH_TIMEOUT_MS = 60_000;

const FRONTEND_ROOT = resolve(import.meta.dirname ?? '.', '..', '..', 'frontend');

export interface WikiInstance {
  url: string;
  port: number;
  vaultPath: string;
  env: Record<string, string>;
  stop: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface PageMetaInput {
  title?: string;
  owner?: string;
  editors?: string[];
  type?: string;
  aliases?: string[];
  categories?: string[];
  gedcom?: { file: string; record: string; snapshot: string };
  created?: string;
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on('error', reject);
  });
}

function waitForServer(url: string): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > HEALTH_TIMEOUT_MS) {
        reject(new Error(`Wiki server failed to start within ${HEALTH_TIMEOUT_MS}ms`));
        return;
      }
      const req = http.get(`${url}/api/healthz`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else setTimeout(check, HEALTH_POLL_MS);
      });
      req.on('error', () => setTimeout(check, HEALTH_POLL_MS));
      req.end();
    };
    check();
  });
}

function gitInit(vault: string): void {
  execSync(`git init -q "${vault}"`, { stdio: 'ignore' });
  execSync(`git -C "${vault}" config user.email eval@local`, { stdio: 'ignore' });
  execSync(`git -C "${vault}" config user.name eval`, { stdio: 'ignore' });
  execSync(`git -C "${vault}" commit --allow-empty -q -m "init"`, { stdio: 'ignore' });
}

export async function startWiki(opts: { port?: number } = {}): Promise<WikiInstance> {
  const vaultPath = mkdtempSync(join(tmpdir(), 'whoami-eval-'));
  for (const sub of ['pages', 'genealogy', 'data', 'assets']) {
    mkdirSync(join(vaultPath, sub), { recursive: true });
  }
  gitInit(vaultPath);

  const port = opts.port ?? await findFreePort();
  const url = `http://127.0.0.1:${port}`;
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    WHOAMI_ROOT: vaultPath,
    PORT: String(port),
    NODE_ENV: 'development',
  };

  const child: ChildProcess = spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderrBuf = '';
  child.stderr?.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });

  try {
    await waitForServer(url);
  } catch (err) {
    child.kill();
    rmSync(vaultPath, { recursive: true, force: true });
    throw new Error(`startWiki: ${(err as Error).message}\n--- stderr tail ---\n${stderrBuf.slice(-2000)}`);
  }

  const stop = async (): Promise<void> => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } resolve(); }, 2000);
        child.once('exit', () => { clearTimeout(t); resolve(); });
      });
    }
  };

  const destroy = async (): Promise<void> => {
    await stop();
    rmSync(vaultPath, { recursive: true, force: true });
  };

  return {
    url,
    port,
    vaultPath,
    env: { WHOAMI_SERVER: url, WHOAMI_ROOT: vaultPath },
    stop,
    destroy,
  };
}

/**
 * Write a page directly to <vault>/pages/<slug>.md and commit. Bypasses the
 * API — used by tests to seed pages without going through the agent under test.
 */
export async function writePageDirect(
  vaultPath: string,
  slug: string,
  body: string,
  meta: PageMetaInput = {},
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const fullMeta = {
    title: meta.title ?? slug,
    owner: meta.owner ?? 'eval',
    editors: meta.editors ?? [],
    type: meta.type ?? 'meta',
    aliases: meta.aliases ?? [],
    categories: meta.categories ?? [],
    ...(meta.gedcom ? { gedcom: meta.gedcom } : {}),
    created: meta.created ?? today,
  };
  const file = matter.stringify(body, fullMeta);
  const path = join(vaultPath, 'pages', `${slug}.md`);
  writeFileSync(path, file, 'utf-8');
  execSync(`git -C "${vaultPath}" add "${path}"`, { stdio: 'ignore' });
  execSync(`git -C "${vaultPath}" commit -q -m "seed: ${slug}"`, { stdio: 'ignore' });
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/nyetwork/dev/whoami/evals && npx tsc --noEmit 2>&1 | tail -10
```

If errors mention `src/runner/e2e.ts` or `src/harnesses/*` (those import from `wiki.ts` and use removed fields like `username/password/dataPath`), that's expected — those files are H2b's responsibility. As long as `src/wiki.ts` itself reports no errors, proceed.

If the `tsc` errors are blocking the package's typecheck CI, the pragmatic fix is to add `// @ts-nocheck` at the top of `runner/e2e.ts` and the affected harness files with a `// TODO(plan-h2b): rewrite for new WikiInstance shape` comment. Document the workaround in the commit message.

- [ ] **Step 4: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add evals/src/wiki.ts evals/package.json evals/package-lock.json
git commit -m "feat: evals — replace MW harness with Next.js + temp git repo"
```

If you needed `// @ts-nocheck` on runner/harnesses files, add them in this same commit and mention it in the message.

---

### Task 4: Harness smoke test

**Files:**
- Create: `evals/test/integration/harness.test.ts`

- [ ] **Step 1: Write the test verbatim**

```ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;

before(async () => {
  wiki = await startWiki();
});

after(async () => {
  await wiki.destroy();
});

test('harness: healthz returns 200', async () => {
  const res = await fetch(`${wiki.url}/api/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json() as { status: string };
  assert.equal(body.status, 'ok');
});

test('harness: writePageDirect seeds a readable page', async () => {
  await writePageDirect(wiki.vaultPath, 'seeded-page', 'hello from seed', { title: 'Seeded Page' });
  const res = await fetch(`${wiki.url}/api/pages/seeded-page`);
  assert.equal(res.status, 200);
  const page = await res.json() as { slug: string; meta: { title: string }; body: string };
  assert.equal(page.slug, 'seeded-page');
  assert.equal(page.meta.title, 'Seeded Page');
  assert.match(page.body, /hello from seed/);
});

test('harness: PUT writes a page; GET reads it', async () => {
  const res = await fetch(`${wiki.url}/api/pages/api-write`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'via api', summary: 'first' }),
  });
  assert.equal(res.status, 200);
  const got = await fetch(`${wiki.url}/api/pages/api-write`);
  const page = await got.json() as { body: string };
  assert.match(page.body, /via api/);
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm run test:integration 2>&1 | tail -15
```

Expected: 3 passes; ~10–15 seconds (dev server start dominates).

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add evals/test/integration/harness.test.ts
git commit -m "test: evals harness smoke (healthz + writePageDirect + PUT/GET)"
```

---

## Phase 3 — Page parser

### Task 5: `evals/src/graders/parse-page.ts` — directive + heading + wikilink parser

**Files:**
- Create: `evals/src/graders/parse-page.ts`
- Create: `evals/test/parse-page.test.ts`

This helper walks markdown via remark, returns a typed structure that future graders consume. It does NOT consume frontmatter — graders read frontmatter via `gray-matter` separately.

- [ ] **Step 1: Write the test verbatim**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageContent } from '../src/graders/parse-page.js';

test('parsePageContent: extracts container directives with attrs and body', () => {
  const md = `
Some prose.

:::cite-vault{type=photo snapshot=abc123 note="From the WhatsApp export"}
:::

More prose.

:::infobox-person
name: Jane Doe
birth: 1991-03-04
:::
`;
  const out = parsePageContent(md);
  const cite = out.directives.find(d => d.name === 'cite-vault');
  assert.ok(cite, 'cite-vault directive found');
  assert.equal(cite!.attrs.type, 'photo');
  assert.equal(cite!.attrs.snapshot, 'abc123');
  assert.match(cite!.attrs.note ?? '', /WhatsApp/);

  const ibox = out.directives.find(d => d.name === 'infobox-person');
  assert.ok(ibox, 'infobox-person directive found');
  assert.match(ibox!.body ?? '', /name: Jane Doe/);
  assert.match(ibox!.body ?? '', /birth: 1991-03-04/);
});

test('parsePageContent: extracts leaf directives', () => {
  const md = `
::open

Some open question.

::closed
`;
  const out = parsePageContent(md);
  assert.equal(out.directives.filter(d => d.name === 'open').length, 1);
  assert.equal(out.directives.filter(d => d.name === 'closed').length, 1);
});

test('parsePageContent: extracts headings with depth', () => {
  const md = `
# Title

## Background

Some prose.

### Education

More prose.
`;
  const out = parsePageContent(md);
  assert.deepEqual(
    out.headings.map(h => ({ depth: h.depth, text: h.text })),
    [
      { depth: 1, text: 'Title' },
      { depth: 2, text: 'Background' },
      { depth: 3, text: 'Education' },
    ],
  );
});

test('parsePageContent: extracts wikilinks', () => {
  const md = 'See [[Jane Doe]] and [[Tempelhof Disaster|the disaster]] for details.';
  const out = parsePageContent(md);
  assert.deepEqual(out.wikilinks, [
    { target: 'Jane Doe' },
    { target: 'Tempelhof Disaster', alt: 'the disaster' },
  ]);
});

test('parsePageContent: empty input → empty arrays', () => {
  const out = parsePageContent('');
  assert.deepEqual(out.directives, []);
  assert.deepEqual(out.headings, []);
  assert.deepEqual(out.wikilinks, []);
});

test('parsePageContent: malformed directive (no closing fence) is tolerated', () => {
  const md = `
:::cite-vault{type=photo}
no close fence here
`;
  // Should not throw; partial extraction is acceptable
  const out = parsePageContent(md);
  assert.ok(Array.isArray(out.directives));
});
```

- [ ] **Step 2: Run, expect all to fail**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -15
```

(They'll fail because the module doesn't exist.)

- [ ] **Step 3: Implement `evals/src/graders/parse-page.ts` verbatim**

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

export interface DirectiveNode {
  name: string;
  type: 'container' | 'leaf' | 'text';
  attrs: Record<string, string>;
  /** Inner text for container directives; undefined for leaf/text. */
  body?: string;
}

export interface HeadingEntry {
  depth: number;
  text: string;
}

export interface WikilinkEntry {
  target: string;
  alt?: string;
}

export interface ParsedPage {
  directives: DirectiveNode[];
  headings: HeadingEntry[];
  wikilinks: WikilinkEntry[];
}

const WIKILINK_RE = /\[\[([^\]|#]+?)(?:\|([^\]]+?))?\]\]/g;

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

export function parsePageContent(md: string): ParsedPage {
  const directives: DirectiveNode[] = [];
  const headings: HeadingEntry[] = [];
  const wikilinks: WikilinkEntry[] = [];

  if (md.trim() === '') return { directives, headings, wikilinks };

  const tree = processor.parse(md);
  visit(tree as never, (node: never) => {
    const n = node as { type: string; depth?: number; name?: string; attributes?: Record<string, string>; children?: unknown[] };
    if (n.type === 'heading' && typeof n.depth === 'number') {
      headings.push({ depth: n.depth, text: textOf(n.children) });
      return;
    }
    if (n.type === 'containerDirective' || n.type === 'leafDirective' || n.type === 'textDirective') {
      const dirType =
        n.type === 'containerDirective' ? 'container' :
        n.type === 'leafDirective' ? 'leaf' : 'text';
      directives.push({
        name: n.name ?? '',
        type: dirType,
        attrs: { ...(n.attributes ?? {}) },
        body: dirType === 'container' ? textOf(n.children) : undefined,
      });
      return;
    }
  });

  for (const m of md.matchAll(WIKILINK_RE)) {
    const target = m[1]!.trim();
    const alt = m[2]?.trim();
    wikilinks.push(alt ? { target, alt } : { target });
  }

  return { directives, headings, wikilinks };
}

function textOf(children: unknown): string {
  if (!Array.isArray(children)) return '';
  const parts: string[] = [];
  for (const c of children) {
    const node = c as { type: string; value?: string; children?: unknown[] };
    if (node.type === 'text' && typeof node.value === 'string') {
      parts.push(node.value);
    } else if (Array.isArray(node.children)) {
      parts.push(textOf(node.children));
    } else if (typeof node.value === 'string') {
      parts.push(node.value);
    }
  }
  return parts.join('').trim();
}
```

- [ ] **Step 4: Run, all 6 pass**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -15
```

Notes for the implementer:
- The wikilink regex extracts targets even if they appear inside directive bodies — that's intentional (graders need to count cross-refs anywhere in the page).
- `textOf` walks children to flatten nested formatting (e.g. `## **Bold Heading**` returns "Bold Heading"). It's a best-effort flatten; not a full markdown-to-text renderer.
- For container directives, `body` is the flattened plain text — not the original markdown. That's enough for graders that look for keys/values inside infobox bodies. If a future grader needs the original markdown, extend the helper.

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add evals/src/graders/parse-page.ts evals/test/parse-page.test.ts
git commit -m "feat: evals — parsePageContent extracts directives, headings, wikilinks"
```

---

## Phase 4 — Verify

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm existing grader unit tests are unchanged and still pass**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -10
```

Expected: existing 4 grader test files green, plus the new `parse-page.test.ts` green. Runtime should be similar to before (these are fast unit tests, no spinning up wikis).

- [ ] **Step 2: Run integration smoke (the harness test)**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm run test:integration 2>&1 | tail -10
```

Expected: 3 harness tests pass. Runtime ~10–15s.

- [ ] **Step 3: Confirm typecheck is clean (or that documented `// @ts-nocheck` markers are limited to H2b's territory)**

```bash
cd /Users/nyetwork/dev/whoami/evals && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean. If errors remain in `runner/e2e.ts` or `harnesses/*`, ensure those files have `// @ts-nocheck` headers with `// TODO(plan-h2b)` comments.

- [ ] **Step 4: Sanity-check the skills + agent migrations by reading them top-to-bottom**

Read both files end-to-end and confirm:
- No `{{wikitext}}` patterns remain in code blocks
- No references to removed `wai` commands (`wai task/talk/source/upload/link/changes/category/snapshot/export/import/section/place/auth`)
- All directive examples follow the `:::name{attrs}` shape
- Footnote examples use `[^id]` syntax

```bash
cd /Users/nyetwork/dev/whoami
echo "--- SKILL.md residual wikitext ---"
grep -nE '\{\{(Cite|Infobox|Open|Closed|Blockquote|Dialogue|Gap|Superseded|Columns)' plugins/whoami/skills/editorial-guide/SKILL.md
echo "--- editor.md residual wikitext + dead commands ---"
grep -nE '\{\{(Cite|Infobox|Open|Closed|Blockquote|Dialogue|Gap|Superseded|Columns)|wai (task|talk|source|upload|link|changes|category|snapshot|export|import|section|place|auth)\b' plugins/whoami/agents/editor.md
```

Both `grep` calls should produce zero output.

- [ ] **Step 5: No commit** — verification only.

---

## Self-Review Checklist

After all 6 tasks complete:

1. **Spec coverage**
   - Skills + agents migrated to markdown directives + new wai commands: ✓ (Tasks 1–2)
   - Harness rewritten to Next.js + temp git: ✓ (Task 3)
   - Harness smoke test green: ✓ (Task 4)
   - Page parser exposes directives + headings + wikilinks: ✓ (Task 5)

2. **Placeholder scan** — every step has runnable code or exact commands.

3. **Type consistency** — `WikiInstance` shape stable across `wiki.ts` and `harness.test.ts`. `parsePageContent` return type is the canonical structure graders will consume.

4. **Out of scope confirmed** — no graders are rewritten; no integration tests beyond the harness smoke; `runner/e2e.ts` is left for H2b (with `// @ts-nocheck` if needed).

---

## Definition of Done

- All 6 tasks complete; both `npm test` (unit, fast) and `npm run test:integration` (harness smoke) are green.
- `editorial-guide/SKILL.md` and `agents/editor.md` contain zero wikitext examples and zero references to removed `wai` commands.
- `evals/src/wiki.ts` exports `startWiki/writePageDirect/findFreePort/WikiInstance/PageMetaInput` and works against the real Next.js stack.
- `evals/src/graders/parse-page.ts` exports `parsePageContent(md): ParsedPage` consumable by future graders.
- Branch `migration-spec` has ~6 new commits on top of `e32daca` (or wherever main is).
- Plan H2b (graders + runner + new integration tests) builds on this foundation.
