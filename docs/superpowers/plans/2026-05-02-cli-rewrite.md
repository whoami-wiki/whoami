# CLI Rewrite Implementation Plan (Plan G)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MediaWiki-coupled CLI (`cli/`) with a thin HTTP client against the new Next.js API (Plans C/D/F1). Ship only the commands whose backends exist today; drop or defer the rest. Result: `wai read`, `wai write`, `wai create`, `wai edit`, `wai delete`, `wai sync-gedcom`, `wai recite`, `wai healthz`.

**Architecture:** A `fetch`-based `ApiClient` in `cli/src/api-client.ts` calls the Next.js routes. No cookies, no auth (auth is out of scope per `309619a`). Server URL comes from `WHOAMI_SERVER` env or `~/.whoami/config.json`. Body input: file arg, stdin, or `$EDITOR`. The CLI is a pure HTTP client — never touches the filesystem-as-vault, never runs git directly. Existing scaffolding (`cli/src/output.ts`, `errors.ts`, `update.ts`, `index.ts` dispatcher) is reused; obsolete command files are deleted.

**Tech Stack:** Node 18+ built-in `fetch` (drops axios/tough-cookie/form-data/fast-xml-parser). TypeScript strict. `tsx` for tests. Bundled via existing `scripts/bundle.mjs` to a single `wai` binary.

**Reference:** The migration spec's Phase 4 table — the row "Day-1 commands new to this migration" lists the surface that ships now. Search/upload/lint/gc-assets remain stubs until Plans E and an assets module exist.

## Data-safety constraints

- **Never** modify `~/Library/Application Support/whoami/data/wiki.sqlite` (legacy MediaWiki DB; user-authored data).
- **Never** delete `~/whoami/data/users.json` or `~/whoami/data/sessions.db` if they exist (preserved per the auth-removal commit; user may re-enable auth later).
- The CLI only reads/writes via the API — it never touches files in `~/whoami/pages/` or `~/whoami/genealogy/` directly.
- Local config at `~/.whoami/config.json` is rewritten by `wai config set` only; never silently overwritten.

## Out of scope

These commands stay deleted or stubbed until their backends exist:

| Dropped | Why | Future plan |
|---|---|---|
| `wai search` | Plan E (search) hasn't shipped | Plan E |
| `wai upload` | Assets module doesn't exist | Plan A or new plan |
| `wai link` | No `/api/links` endpoint | Future |
| `wai changes` | No `/api/changes` endpoint | Future |
| `wai category` | Could derive from list endpoint; YAGNI | Future |
| `wai source` | MediaWiki Source: namespace; YAGNI in md world | n/a |
| `wai task` | MediaWiki Task: namespace; YAGNI | Re-think shape |
| `wai place` | Google Places — could ship as CLI-local later | Future |
| `wai snapshot` | Vault-write helper for MW; rethink shape | Future |
| `wai export` / `wai import` | MediaWiki dump format; backup is `git push` | Plan A |
| `wai talk read/create` | Talk pages = `<slug>.talk` regular pages now — use `wai read/write` | n/a |
| `wai section` | Markdown sectioning differs; defer | Future |
| `wai auth` | Auth removed entirely | n/a |

The dispatcher (`index.ts`) prints a helpful "not yet supported in markdown migration — track [link]" line for each removed command, so existing skills/agents that try `wai search` get a friendly error instead of "command not found".

---

## File Structure

```
cli/
├── package.json                    # MODIFY: drop axios/etc., bump version
├── src/
│   ├── index.ts                    # REPLACE: dispatcher with new command set
│   ├── api-client.ts               # CREATE: fetch-based client
│   ├── config.ts                   # CREATE: replaces auth.ts; server URL only
│   ├── slug.ts                     # CREATE: title→slug canonicalizer
│   ├── body-input.ts               # CREATE: file/stdin/EDITOR helpers
│   ├── output.ts                   # KEEP
│   ├── errors.ts                   # KEEP (drops AuthError usage)
│   ├── update.ts                   # KEEP
│   ├── content.ts                  # DELETE (MediaWiki content helpers)
│   ├── auth.ts                     # DELETE (replaced by config.ts)
│   ├── data-path.ts                # DELETE (only used by snapshot)
│   ├── wiki-client.ts              # DELETE (replaced by api-client.ts)
│   └── commands/
│       ├── read.ts                 # REWRITE
│       ├── write.ts                # REWRITE
│       ├── create.ts               # REWRITE (alias of write w/ create flag)
│       ├── edit.ts                 # REWRITE ($EDITOR over body)
│       ├── delete.ts               # CREATE
│       ├── sync-gedcom.ts          # CREATE
│       ├── recite.ts               # CREATE
│       ├── healthz.ts              # CREATE
│       └── auth.ts                 # DELETE
│       └── (all other command files DELETED — see "Out of scope")
└── test/
    ├── api-client.test.ts          # CREATE
    ├── slug.test.ts                # CREATE
    ├── body-input.test.ts          # CREATE
    ├── read.test.ts                # CREATE
    ├── write.test.ts               # REWRITE
    └── (all other test files DELETED)
```

---

## Phase 0 — Deps + scaffolding

### Task 1: Drop MediaWiki deps + bump version

**Files:**
- Modify: `cli/package.json`

- [ ] **Step 1: Uninstall MW-coupled deps**

```bash
cd /Users/nyetwork/dev/whoami/cli
npm uninstall axios axios-cookiejar-support fast-xml-parser form-data tough-cookie
```

- [ ] **Step 2: Bump version + update description (manual edit)**

Set `cli/package.json` to:

```json
{
  "name": "wai",
  "version": "2.0.0-pre.0",
  "description": "whoami.wiki cli — http client for the family wiki API",
  "type": "module",
  "bin": {
    "wai": "dist/wai.cjs"
  },
  "scripts": {
    "build": "node scripts/bundle.mjs",
    "typecheck": "tsc --noEmit",
    "dev": "tsx src/index.ts",
    "test": "tsx --test \"test/**/*.test.ts\""
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^22.0.0",
    "esbuild": "^0.25.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Verify scripts/bundle.mjs still builds (will fail until later tasks rewrite imports — that's fine, just confirm the tool runs)**

```bash
cd /Users/nyetwork/dev/whoami/cli && node scripts/bundle.mjs 2>&1 | tail -5 || true
```

(Expected: errors about unresolved imports — we'll fix as we rewrite. Don't commit yet.)

- [ ] **Step 4: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/package.json cli/package-lock.json
git commit -m "chore: cli — drop MediaWiki deps, bump to 2.0.0-pre.0"
```

---

## Phase 1 — Core helpers

### Task 2: `cli/src/slug.ts` — title→slug canonicalizer

**Files:**
- Create: `cli/src/slug.ts`
- Create: `cli/test/slug.test.ts`

The user types "Steven Barash" or "steven-barash" or "Steven_Barash"; the API needs `steven-barash`. This matches `core/pages` slug rules (`^[a-z0-9][a-z0-9-]*(\.talk)?$`).

- [ ] **Step 1: Write failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSlug } from '../src/slug.js';

test('toSlug: spaces to hyphens, lowercase', () => {
  assert.equal(toSlug('Steven Barash'), 'steven-barash');
});

test('toSlug: underscores to hyphens', () => {
  assert.equal(toSlug('Steven_Barash'), 'steven-barash');
});

test('toSlug: collapse multiple separators', () => {
  assert.equal(toSlug('Steven  Barash'), 'steven-barash');
  assert.equal(toSlug('foo - bar'), 'foo-bar');
});

test('toSlug: preserves .talk suffix', () => {
  assert.equal(toSlug('Steven Barash.talk'), 'steven-barash.talk');
});

test('toSlug: passes through valid slugs', () => {
  assert.equal(toSlug('steven-barash'), 'steven-barash');
});

test('toSlug: strips leading/trailing whitespace', () => {
  assert.equal(toSlug('  Steven Barash  '), 'steven-barash');
});
```

- [ ] **Step 2: Run, expect 6 fail**

```bash
cd /Users/nyetwork/dev/whoami/cli && npm test
```

- [ ] **Step 3: Implement `cli/src/slug.ts`**

```ts
export function toSlug(input: string): string {
  const trimmed = input.trim();
  const talk = trimmed.endsWith('.talk');
  const base = talk ? trimmed.slice(0, -5) : trimmed;
  const slug = base
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return talk ? `${slug}.talk` : slug;
}
```

- [ ] **Step 4: Run, all 6 pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/slug.ts cli/test/slug.test.ts
git commit -m "feat: cli — toSlug canonicalizer for page titles"
```

---

### Task 3: `cli/src/config.ts` — server URL config

**Files:**
- Create: `cli/src/config.ts`
- Delete (later in Task 13): `cli/src/auth.ts`

Resolution order: `WHOAMI_SERVER` env → `~/.whoami/config.json` `server` field → `http://localhost:3001`.

- [ ] **Step 1: Implement `cli/src/config.ts`**

```ts
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.whoami');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_SERVER = 'http://localhost:3001';

export interface WaiConfig {
  server: string;
}

export function getServer(): string {
  const env = process.env.WHOAMI_SERVER;
  if (env) return env.replace(/\/$/, '');
  if (existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Partial<WaiConfig>;
      if (typeof data.server === 'string' && data.server.length > 0) {
        return data.server.replace(/\/$/, '');
      }
    } catch { /* fall through */ }
  }
  return DEFAULT_SERVER;
}

export function setServer(server: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({ server }, null, 2) + '\n', { mode: 0o600 });
}
```

- [ ] **Step 2: Verify it parses**

```bash
cd /Users/nyetwork/dev/whoami/cli
npx tsc --noEmit src/config.ts
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/config.ts
git commit -m "feat: cli — server URL config (env → ~/.whoami/config.json → default)"
```

---

### Task 4: `cli/src/api-client.ts` — fetch-based HTTP client

**Files:**
- Create: `cli/src/api-client.ts`
- Create: `cli/test/api-client.test.ts`

Minimal surface: `read(slug)`, `write(slug, body, summary)`, `delete(slug)`, `syncGedcom({gedFile, notes})`, `reciteDrift()`, `applyRecite()`, `healthz()`. Returns parsed JSON; throws typed errors for 404/400/5xx.

- [ ] **Step 1: Write failing test (uses Node's built-in HTTP server as a stub)**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ApiClient, NotFound, BadRequest } from '../src/api-client.js';

function withServer<T>(handler: (req: any, res: any) => void, fn: (base: string) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      try { resolve(await fn(`http://127.0.0.1:${port}`)); }
      catch (err) { reject(err); }
      finally { server.close(); }
    });
  });
}

test('ApiClient.read: parses 200 JSON', async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, '/api/pages/foo');
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ slug: 'foo', meta: { title: 'Foo' }, body: 'hi' }));
    },
    async (base) => {
      const c = new ApiClient(base);
      const page = await c.read('foo');
      assert.equal(page.slug, 'foo');
    },
  );
});

test('ApiClient.read: 404 throws NotFound', async () => {
  await withServer(
    (_req, res) => { res.statusCode = 404; res.setHeader('content-type', 'application/json'); res.end('{"error":"not-found"}'); },
    async (base) => {
      const c = new ApiClient(base);
      await assert.rejects(() => c.read('nope'), (err: Error) => err instanceof NotFound);
    },
  );
});

test('ApiClient.write: PUTs JSON body', async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.method, 'PUT');
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', () => {
        assert.deepEqual(JSON.parse(body), { body: 'new', summary: 'add' });
        res.setHeader('content-type', 'application/json');
        res.end('{"ok":true}');
      });
    },
    async (base) => {
      const c = new ApiClient(base);
      await c.write('foo', 'new', 'add');
    },
  );
});

test('ApiClient.write: 400 throws BadRequest', async () => {
  await withServer(
    (_req, res) => { res.statusCode = 400; res.setHeader('content-type', 'application/json'); res.end('{"error":"bad-request"}'); },
    async (base) => {
      const c = new ApiClient(base);
      await assert.rejects(() => c.write('foo', '', 'x'), (err: Error) => err instanceof BadRequest);
    },
  );
});
```

- [ ] **Step 2: Run, expect 4 fail**

```bash
cd /Users/nyetwork/dev/whoami/cli && npm test
```

- [ ] **Step 3: Implement `cli/src/api-client.ts`**

```ts
export class ApiError extends Error {
  constructor(public status: number, public detail?: string) {
    super(`HTTP ${status}${detail ? `: ${detail}` : ''}`);
  }
}
export class NotFound extends ApiError {}
export class BadRequest extends ApiError {}
export class ServerError extends ApiError {}

export interface PageMeta {
  title: string;
  owner: string;
  editors: string[];
  type: string;
  aliases: string[];
  categories: string[];
  gedcom?: { file: string; record: string; snapshot: string };
  created: string;
  deletedAt?: string;
}

export interface Page {
  slug: string;
  meta: PageMeta;
  body: string;
}

export interface SyncResult {
  kind: 'wrote' | 'no-op';
  diff?: { added: string[]; changed: string[]; removed: string[] };
  commit?: string;
  reason?: string;
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async healthz(): Promise<{ status: string; started: string }> {
    return this.json('GET', '/api/healthz');
  }

  async read(slug: string): Promise<Page> {
    return this.json<Page>('GET', `/api/pages/${slug}`);
  }

  async write(slug: string, body: string, summary: string): Promise<{ ok: true }> {
    return this.json('PUT', `/api/pages/${slug}`, { body, summary });
  }

  async delete(slug: string): Promise<{ ok: true }> {
    return this.json('DELETE', `/api/pages/${slug}`);
  }

  async syncGedcom(gedFile: string, notes: string): Promise<SyncResult> {
    return this.json('POST', '/api/gedcom/sync', { gedFile, notes });
  }

  async reciteDrift(): Promise<{ drift: { slug: string; record: string; cited: string; current: string }[] }> {
    return this.json('GET', '/api/gedcom/recite');
  }

  async applyRecite(): Promise<{ updated: string[] }> {
    return this.json('POST', '/api/gedcom/recite', { apply: true });
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { /* keep as text */ }
    if (!res.ok) {
      const detail = parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : text || undefined;
      if (res.status === 404) throw new NotFound(404, detail);
      if (res.status === 400) throw new BadRequest(400, detail);
      throw new ServerError(res.status, detail);
    }
    return parsed as T;
  }
}
```

- [ ] **Step 4: Run, all 4 pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/api-client.ts cli/test/api-client.test.ts
git commit -m "feat: cli — fetch-based ApiClient with typed error mapping"
```

---

### Task 5: `cli/src/body-input.ts` — file/stdin/$EDITOR helpers

**Files:**
- Create: `cli/src/body-input.ts`
- Create: `cli/test/body-input.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFromFile } from '../src/body-input.js';

test('readFromFile: reads utf-8 contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'body-'));
  try {
    const p = join(dir, 'a.md');
    writeFileSync(p, '# Heading\n\nbody\n');
    assert.equal(readFromFile(p), '# Heading\n\nbody\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readFromFile: throws on missing', () => {
  assert.throws(() => readFromFile('/nope/does-not-exist.md'));
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Implement `cli/src/body-input.ts`**

```ts
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

export function readFromFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

export async function readFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

export function editInEditor(initial: string): string {
  const editor = process.env.EDITOR ?? 'vi';
  const dir = mkdtempSync(join(tmpdir(), 'wai-edit-'));
  const file = join(dir, 'page.md');
  try {
    writeFileSync(file, initial, 'utf-8');
    const r = spawnSync(editor, [file], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`editor exited with status ${r.status}`);
    return readFileSync(file, 'utf-8');
  } finally {
    try { unlinkSync(file); } catch { /* ignore */ }
    try { rmdirSync(dir); } catch { /* ignore */ }
  }
}
```

- [ ] **Step 4: Run, all pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/body-input.ts cli/test/body-input.test.ts
git commit -m "feat: cli — body input helpers (file, stdin, \$EDITOR)"
```

---

## Phase 2 — Page commands

### Task 6: `wai read <slug>`

**Files:**
- Create: `cli/src/commands/read.ts` (rewrite — file currently exists)
- Create: `cli/test/read.test.ts`

Note: the existing `cli/src/commands/read.ts` is MediaWiki-coupled. Overwrite it (don't preserve any of the old code).

- [ ] **Step 1: Failing integration-style test (uses a fake ApiClient)**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRead } from '../src/commands/read.js';

test('read: prints body to stdout (default)', async () => {
  let out = '';
  await runRead({
    slug: 'foo',
    json: false,
    write: (s: string) => { out += s; },
    client: { read: async () => ({ slug: 'foo', meta: { title: 'Foo' }, body: 'hello' }) } as any,
  });
  assert.equal(out, 'hello\n');
});

test('read: --json emits full page', async () => {
  let out = '';
  await runRead({
    slug: 'foo',
    json: true,
    write: (s: string) => { out += s; },
    client: { read: async () => ({ slug: 'foo', meta: { title: 'Foo' }, body: 'hello' }) } as any,
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.slug, 'foo');
  assert.equal(parsed.body, 'hello');
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Implement `cli/src/commands/read.ts`**

```ts
import type { ApiClient } from '../api-client.js';

export interface ReadOptions {
  slug: string;
  json: boolean;
  client: Pick<ApiClient, 'read'>;
  write: (s: string) => void;
}

export async function runRead(opts: ReadOptions): Promise<void> {
  const page = await opts.client.read(opts.slug);
  if (opts.json) {
    opts.write(JSON.stringify(page, null, 2));
  } else {
    opts.write(`${page.body}\n`);
  }
}
```

- [ ] **Step 4: Run, both pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/commands/read.ts cli/test/read.test.ts
git commit -m "feat: cli — wai read via ApiClient (default body, --json full)"
```

---

### Task 7: `wai write <slug> [file]`

**Files:**
- Create: `cli/src/commands/write.ts` (rewrite)
- Create: `cli/test/write.test.ts` (rewrite — replaces existing)

- [ ] **Step 1: Failing test (delete the existing test first; rewrite atomically)**

```bash
cd /Users/nyetwork/dev/whoami/cli && rm -f test/write.test.ts
```

Write `cli/test/write.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWrite } from '../src/commands/write.js';

function fakeClient(captured: { slug?: string; body?: string; summary?: string }): any {
  return {
    write: async (slug: string, body: string, summary: string) => {
      captured.slug = slug;
      captured.body = body;
      captured.summary = summary;
      return { ok: true };
    },
  };
}

test('write: PUTs body and summary', async () => {
  const captured: { slug?: string; body?: string; summary?: string } = {};
  await runWrite({
    slug: 'foo',
    body: 'hello world',
    summary: 'init',
    client: fakeClient(captured),
    write: () => {},
  });
  assert.equal(captured.slug, 'foo');
  assert.equal(captured.body, 'hello world');
  assert.equal(captured.summary, 'init');
});

test('write: errors when summary missing', async () => {
  await assert.rejects(
    () => runWrite({
      slug: 'foo',
      body: 'x',
      summary: '',
      client: fakeClient({}),
      write: () => {},
    }),
    /summary/i,
  );
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Implement `cli/src/commands/write.ts`**

```ts
import type { ApiClient } from '../api-client.js';

export interface WriteOptions {
  slug: string;
  body: string;
  summary: string;
  client: Pick<ApiClient, 'write'>;
  write: (s: string) => void;
}

export async function runWrite(opts: WriteOptions): Promise<void> {
  if (!opts.summary) throw new Error('--summary is required');
  await opts.client.write(opts.slug, opts.body, opts.summary);
  opts.write(`wrote ${opts.slug}\n`);
}
```

- [ ] **Step 4: Run, all pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/commands/write.ts cli/test/write.test.ts
git commit -m "feat: cli — wai write via ApiClient PUT"
```

---

### Task 8: `wai create <slug>` and `wai edit <slug>`

**Files:**
- Create: `cli/src/commands/create.ts` (rewrite)
- Create: `cli/src/commands/edit.ts` (rewrite)

Both are thin wrappers over write. `create` reads body from stdin or file, errors if the page already exists. `edit` opens `$EDITOR` on the current body.

- [ ] **Step 1: Implement `cli/src/commands/create.ts`**

```ts
import type { ApiClient } from '../api-client.js';
import { NotFound } from '../api-client.js';

export interface CreateOptions {
  slug: string;
  body: string;
  summary: string;
  client: Pick<ApiClient, 'read' | 'write'>;
  write: (s: string) => void;
}

export async function runCreate(opts: CreateOptions): Promise<void> {
  if (!opts.summary) throw new Error('--summary is required');
  let exists = true;
  try { await opts.client.read(opts.slug); } catch (err) {
    if (err instanceof NotFound) exists = false;
    else throw err;
  }
  if (exists) throw new Error(`page ${opts.slug} already exists — use 'wai write' to overwrite or 'wai edit' to modify`);
  await opts.client.write(opts.slug, opts.body, opts.summary);
  opts.write(`created ${opts.slug}\n`);
}
```

- [ ] **Step 2: Implement `cli/src/commands/edit.ts`**

```ts
import type { ApiClient } from '../api-client.js';
import { editInEditor } from '../body-input.js';

export interface EditOptions {
  slug: string;
  summary: string;
  client: Pick<ApiClient, 'read' | 'write'>;
  write: (s: string) => void;
  openEditor?: (initial: string) => string;
}

export async function runEdit(opts: EditOptions): Promise<void> {
  if (!opts.summary) throw new Error('--summary is required');
  const page = await opts.client.read(opts.slug);
  const editor = opts.openEditor ?? editInEditor;
  const next = editor(page.body);
  if (next === page.body) {
    opts.write('no changes\n');
    return;
  }
  await opts.client.write(opts.slug, next, opts.summary);
  opts.write(`updated ${opts.slug}\n`);
}
```

- [ ] **Step 3: Add tests `cli/test/create.test.ts` (overwrite refused)** and `cli/test/edit.test.ts` (no-change → no-op):

```ts
// cli/test/create.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCreate } from '../src/commands/create.js';
import { NotFound } from '../src/api-client.js';

test('create: refuses when page exists', async () => {
  const client: any = {
    read: async () => ({ slug: 'foo', meta: {}, body: '' }),
    write: async () => { throw new Error('should not be called'); },
  };
  await assert.rejects(() => runCreate({ slug: 'foo', body: 'x', summary: 's', client, write: () => {} }), /already exists/);
});

test('create: writes when page missing', async () => {
  let wrote = false;
  const client: any = {
    read: async () => { throw new NotFound(404); },
    write: async () => { wrote = true; return { ok: true }; },
  };
  await runCreate({ slug: 'foo', body: 'x', summary: 's', client, write: () => {} });
  assert.equal(wrote, true);
});
```

```ts
// cli/test/edit.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEdit } from '../src/commands/edit.js';

test('edit: no change → no write', async () => {
  let wrote = false;
  const client: any = {
    read: async () => ({ slug: 'foo', meta: {}, body: 'same' }),
    write: async () => { wrote = true; return { ok: true }; },
  };
  let out = '';
  await runEdit({ slug: 'foo', summary: 's', client, write: (s) => { out += s; }, openEditor: (init) => init });
  assert.equal(wrote, false);
  assert.match(out, /no changes/);
});

test('edit: changed → write', async () => {
  let wrote = false;
  const client: any = {
    read: async () => ({ slug: 'foo', meta: {}, body: 'old' }),
    write: async (_s: string, body: string) => { wrote = body === 'new'; return { ok: true }; },
  };
  await runEdit({ slug: 'foo', summary: 's', client, write: () => {}, openEditor: () => 'new' });
  assert.equal(wrote, true);
});
```

- [ ] **Step 4: Run all tests**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/commands/create.ts cli/src/commands/edit.ts cli/test/create.test.ts cli/test/edit.test.ts
git commit -m "feat: cli — wai create (no-overwrite) and wai edit (\$EDITOR)"
```

---

### Task 9: `wai delete <slug>`

**Files:**
- Create: `cli/src/commands/delete.ts`
- Create: `cli/test/delete.test.ts`

- [ ] **Step 1: Write test + implementation in one shot**

```ts
// cli/src/commands/delete.ts
import type { ApiClient } from '../api-client.js';

export interface DeleteOptions {
  slug: string;
  yes: boolean;
  client: Pick<ApiClient, 'delete'>;
  write: (s: string) => void;
}

export async function runDelete(opts: DeleteOptions): Promise<void> {
  if (!opts.yes) throw new Error(`refusing to delete without --yes (would soft-delete ${opts.slug})`);
  await opts.client.delete(opts.slug);
  opts.write(`deleted ${opts.slug}\n`);
}
```

```ts
// cli/test/delete.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDelete } from '../src/commands/delete.js';

test('delete: refuses without --yes', async () => {
  await assert.rejects(
    () => runDelete({ slug: 'foo', yes: false, client: { delete: async () => ({ ok: true } as const) } as any, write: () => {} }),
    /--yes/,
  );
});

test('delete: calls API with --yes', async () => {
  let called = false;
  await runDelete({
    slug: 'foo',
    yes: true,
    client: { delete: async () => { called = true; return { ok: true } as const; } } as any,
    write: () => {},
  });
  assert.equal(called, true);
});
```

- [ ] **Step 2: Tests pass**

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/commands/delete.ts cli/test/delete.test.ts
git commit -m "feat: cli — wai delete with --yes guard"
```

---

## Phase 3 — GEDCOM commands

### Task 10: `wai sync-gedcom`

**Files:**
- Create: `cli/src/commands/sync-gedcom.ts`
- Create: `cli/test/sync-gedcom.test.ts`

- [ ] **Step 1: Implementation**

```ts
import type { ApiClient } from '../api-client.js';

export interface SyncGedcomOptions {
  gedFile: string;
  notes: string;
  client: Pick<ApiClient, 'syncGedcom'>;
  write: (s: string) => void;
}

export async function runSyncGedcom(opts: SyncGedcomOptions): Promise<void> {
  if (!opts.gedFile) throw new Error('--ged-file is required');
  if (!opts.notes) throw new Error('--notes is required');
  const result = await opts.client.syncGedcom(opts.gedFile, opts.notes);
  if (result.kind === 'no-op') {
    opts.write(`no-op: ${result.reason ?? 'unchanged'}\n`);
  } else {
    const d = result.diff!;
    opts.write(`commit ${result.commit?.slice(0, 8)}: +${d.added.length} ~${d.changed.length} -${d.removed.length}\n`);
  }
}
```

- [ ] **Step 2: Test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSyncGedcom } from '../src/commands/sync-gedcom.js';

test('sync-gedcom: prints diff summary on wrote', async () => {
  let out = '';
  await runSyncGedcom({
    gedFile: 'tree.ged',
    notes: 'test',
    client: { syncGedcom: async () => ({ kind: 'wrote' as const, diff: { added: ['I1'], changed: [], removed: [] }, commit: 'abcdef1234' }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /\+1 ~0 -0/);
});

test('sync-gedcom: prints no-op message', async () => {
  let out = '';
  await runSyncGedcom({
    gedFile: 'tree.ged',
    notes: 'test',
    client: { syncGedcom: async () => ({ kind: 'no-op' as const, reason: 'unchanged-hash' }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /no-op/);
});
```

- [ ] **Step 3: Tests pass; commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/commands/sync-gedcom.ts cli/test/sync-gedcom.test.ts
git commit -m "feat: cli — wai sync-gedcom"
```

---

### Task 11: `wai recite [--apply]` and `wai healthz`

**Files:**
- Create: `cli/src/commands/recite.ts`
- Create: `cli/src/commands/healthz.ts`
- Create: `cli/test/recite.test.ts`

- [ ] **Step 1: `recite.ts`**

```ts
import type { ApiClient } from '../api-client.js';

export interface ReciteOptions {
  apply: boolean;
  client: Pick<ApiClient, 'reciteDrift' | 'applyRecite'>;
  write: (s: string) => void;
}

export async function runRecite(opts: ReciteOptions): Promise<void> {
  if (opts.apply) {
    const r = await opts.client.applyRecite();
    opts.write(`updated ${r.updated.length} pages: ${r.updated.join(', ') || '(none)'}\n`);
    return;
  }
  const r = await opts.client.reciteDrift();
  if (r.drift.length === 0) {
    opts.write('no drift\n');
    return;
  }
  for (const d of r.drift) {
    opts.write(`${d.slug}: ${d.cited.slice(0, 8)} → ${d.current.slice(0, 8)} (${d.record})\n`);
  }
}
```

- [ ] **Step 2: `healthz.ts`**

```ts
import type { ApiClient } from '../api-client.js';

export interface HealthzOptions {
  client: Pick<ApiClient, 'healthz'>;
  write: (s: string) => void;
}

export async function runHealthz(opts: HealthzOptions): Promise<void> {
  const h = await opts.client.healthz();
  opts.write(`${h.status} (${h.started})\n`);
}
```

- [ ] **Step 3: Test recite**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRecite } from '../src/commands/recite.js';

test('recite: prints "no drift" when empty', async () => {
  let out = '';
  await runRecite({ apply: false, client: { reciteDrift: async () => ({ drift: [] }) } as any, write: (s) => { out += s; } });
  assert.match(out, /no drift/);
});

test('recite --apply: prints updated count', async () => {
  let out = '';
  await runRecite({ apply: true, client: { applyRecite: async () => ({ updated: ['a', 'b'] }) } as any, write: (s) => { out += s; } });
  assert.match(out, /updated 2 pages/);
});
```

- [ ] **Step 4: Tests pass; commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/commands/recite.ts cli/src/commands/healthz.ts cli/test/recite.test.ts
git commit -m "feat: cli — wai recite (drift report + --apply) and wai healthz"
```

---

## Phase 4 — Dispatcher + cleanup

### Task 12: Rewrite `cli/src/index.ts` dispatcher

**Files:**
- Create: `cli/src/index.ts` (rewrite)

The dispatcher parses argv, routes to the new commands, and prints a friendly stub message for dropped commands.

- [ ] **Step 1: Replace `cli/src/index.ts` verbatim**

```ts
#!/usr/bin/env node

import { ApiClient } from './api-client.js';
import { getServer, setServer } from './config.js';
import { toSlug } from './slug.js';
import { readFromFile, readFromStdin } from './body-input.js';
import { runRead } from './commands/read.js';
import { runWrite } from './commands/write.js';
import { runCreate } from './commands/create.js';
import { runEdit } from './commands/edit.js';
import { runDelete } from './commands/delete.js';
import { runSyncGedcom } from './commands/sync-gedcom.js';
import { runRecite } from './commands/recite.js';
import { runHealthz } from './commands/healthz.js';
import { ApiError } from './api-client.js';

const VERSION = '2.0.0-pre.0';

const HELP = `wai — whoami.wiki cli (markdown migration)

Usage:
  wai <command> [args]

Pages:
  read <slug>                 Read a page (body to stdout; --json for full)
  write <slug> [--file F]     Write (overwrite) a page
                                body from --file F, --stdin, or positional arg
                                requires --summary
  create <slug> [--file F]    Create a new page (refuses if exists)
  edit <slug>                 Edit a page in \$EDITOR
  delete <slug> --yes         Soft-delete a page (moves to _archived)

GEDCOM:
  sync-gedcom --ged-file F    Sync GEDCOM .ged → derived/ + commit
              --notes "..."
  recite                      Report stale snapshot pointers
  recite --apply              Advance pointers in pages

Server:
  healthz                     Ping the API
  config server <url>         Set server URL in ~/.whoami/config.json

Common flags:
  --json                      JSON output (where applicable)
  --summary <text>            Edit summary (required for write/create/edit)

Server URL: ${getServer()}  (override: WHOAMI_SERVER, ~/.whoami/config.json)

Removed in this migration (track future plans for replacements):
  search, upload, link, changes, category, source, task, place,
  snapshot, export, import, talk, section, auth
`;

interface Args {
  cmd: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let cmd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (cmd === undefined) {
      cmd = a;
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

async function resolveBody(args: Args): Promise<string> {
  if (typeof args.flags.file === 'string') return readFromFile(args.flags.file);
  if (args.flags.stdin) return await readFromStdin();
  if (args.positional[1] !== undefined) return args.positional[1];
  return await readFromStdin();
}

const REMOVED = new Set([
  'search', 'upload', 'link', 'changes', 'category', 'source', 'task',
  'place', 'snapshot', 'export', 'import', 'talk', 'section', 'auth',
]);

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.version || args.cmd === 'version' || args.cmd === '--version') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (!args.cmd || args.cmd === 'help' || args.flags.help) {
    process.stdout.write(HELP);
    return 0;
  }

  if (REMOVED.has(args.cmd)) {
    process.stderr.write(`wai: '${args.cmd}' is not yet supported in the markdown migration.\n`);
    return 2;
  }

  const client = new ApiClient(getServer());
  const write = (s: string) => process.stdout.write(s);

  try {
    switch (args.cmd) {
      case 'read': {
        const slug = toSlug(args.positional[0] ?? '');
        await runRead({ slug, json: !!args.flags.json, client, write });
        break;
      }
      case 'write': {
        const slug = toSlug(args.positional[0] ?? '');
        const body = await resolveBody(args);
        const summary = String(args.flags.summary ?? '');
        await runWrite({ slug, body, summary, client, write });
        break;
      }
      case 'create': {
        const slug = toSlug(args.positional[0] ?? '');
        const body = await resolveBody(args);
        const summary = String(args.flags.summary ?? '');
        await runCreate({ slug, body, summary, client, write });
        break;
      }
      case 'edit': {
        const slug = toSlug(args.positional[0] ?? '');
        const summary = String(args.flags.summary ?? '');
        await runEdit({ slug, summary, client, write });
        break;
      }
      case 'delete': {
        const slug = toSlug(args.positional[0] ?? '');
        await runDelete({ slug, yes: !!args.flags.yes, client, write });
        break;
      }
      case 'sync-gedcom': {
        const gedFile = String(args.flags['ged-file'] ?? '');
        const notes = String(args.flags.notes ?? '');
        await runSyncGedcom({ gedFile, notes, client, write });
        break;
      }
      case 'recite': {
        await runRecite({ apply: !!args.flags.apply, client, write });
        break;
      }
      case 'healthz': {
        await runHealthz({ client, write });
        break;
      }
      case 'config': {
        if (args.positional[0] === 'server' && args.positional[1]) {
          setServer(args.positional[1]);
          write(`saved server=${args.positional[1]}\n`);
        } else {
          write(`server=${getServer()}\n`);
        }
        break;
      }
      default: {
        process.stderr.write(`wai: unknown command '${args.cmd}'. Run 'wai help' for usage.\n`);
        return 2;
      }
    }
    return 0;
  } catch (err) {
    if (err instanceof ApiError) {
      process.stderr.write(`wai: ${err.message}\n`);
      return 1;
    }
    process.stderr.write(`wai: ${(err as Error).message}\n`);
    return 1;
  }
}

main().then(code => process.exit(code));
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/nyetwork/dev/whoami/cli && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add cli/src/index.ts
git commit -m "feat: cli — new dispatcher routing to ApiClient commands"
```

---

### Task 13: Delete obsolete files + tests

**Files (DELETE):**
- `cli/src/wiki-client.ts`
- `cli/src/auth.ts`
- `cli/src/content.ts`
- `cli/src/data-path.ts`
- `cli/src/commands/auth.ts`
- `cli/src/commands/category.ts`
- `cli/src/commands/changes.ts`
- `cli/src/commands/export.ts`
- `cli/src/commands/import.ts`
- `cli/src/commands/link.ts`
- `cli/src/commands/place.ts`
- `cli/src/commands/search.ts`
- `cli/src/commands/section.ts`
- `cli/src/commands/snapshot.ts`
- `cli/src/commands/source.ts`
- `cli/src/commands/talk.ts`
- `cli/src/commands/task.ts`
- `cli/src/commands/upload.ts`
- `cli/test/content.test.ts`
- `cli/test/export.test.ts`
- `cli/test/import.test.ts`
- `cli/test/snapshot.test.ts`
- `cli/test/source.test.ts`

- [ ] **Step 1: git rm**

```bash
cd /Users/nyetwork/dev/whoami
git rm cli/src/wiki-client.ts cli/src/auth.ts cli/src/content.ts cli/src/data-path.ts \
       cli/src/commands/auth.ts cli/src/commands/category.ts cli/src/commands/changes.ts \
       cli/src/commands/export.ts cli/src/commands/import.ts cli/src/commands/link.ts \
       cli/src/commands/place.ts cli/src/commands/search.ts cli/src/commands/section.ts \
       cli/src/commands/snapshot.ts cli/src/commands/source.ts cli/src/commands/talk.ts \
       cli/src/commands/task.ts cli/src/commands/upload.ts \
       cli/test/content.test.ts cli/test/export.test.ts cli/test/import.test.ts \
       cli/test/snapshot.test.ts cli/test/source.test.ts
```

- [ ] **Step 2: typecheck + test**

```bash
cd /Users/nyetwork/dev/whoami/cli && npx tsc --noEmit && npm test
```

- [ ] **Step 3: Bundle check**

```bash
cd /Users/nyetwork/dev/whoami/cli && node scripts/bundle.mjs 2>&1 | tail -10
```

Expected: clean build of `dist/wai.cjs`.

- [ ] **Step 4: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git commit -m "chore: cli — delete MediaWiki-coupled files (wiki-client + 14 commands)"
```

---

## Phase 5 — Verification

### Task 14: End-to-end smoke against real backend

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
pkill -f "next dev" 2>/dev/null; sleep 1
cd /Users/nyetwork/dev/whoami/frontend
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
sleep 8
curl -s -o /dev/null -w 'frontend HTTP=%{http_code}\n' http://localhost:3001/api/healthz
```

- [ ] **Step 2: Run the bundled CLI**

```bash
cd /Users/nyetwork/dev/whoami/cli
node scripts/bundle.mjs
WAI=./dist/wai.cjs

WHOAMI_SERVER=http://localhost:3001 node $WAI healthz
WHOAMI_SERVER=http://localhost:3001 node $WAI read abby-rickelman | head -3
WHOAMI_SERVER=http://localhost:3001 node $WAI read abby-rickelman --json | head -10

# Round-trip test on a throwaway slug
SLUG=cli-smoke-$(date +%s)
echo "# CLI smoke\n\nbody from cli" | WHOAMI_SERVER=http://localhost:3001 node $WAI create $SLUG --summary "smoke" --stdin
WHOAMI_SERVER=http://localhost:3001 node $WAI read $SLUG
WHOAMI_SERVER=http://localhost:3001 node $WAI delete $SLUG --yes
```

Expected:
- `healthz` prints `ok (...)`
- `read abby-rickelman` prints page body to stdout
- `read --json` prints JSON with `slug`, `meta`, `body` fields
- `create $SLUG` succeeds
- `read $SLUG` shows the body
- `delete $SLUG --yes` reports deleted

- [ ] **Step 3: Cleanup**

```bash
pkill -f "next dev" 2>/dev/null; sleep 1; echo done
```

- [ ] **Step 4: No commit** — purely verification.

---

## Self-Review Checklist

After all 14 tasks complete:

1. **Spec coverage**
   - CLI is a pure HTTP client: ✓ (Task 4)
   - Existing slug rules respected: ✓ (Task 2)
   - Page CRUD via API: ✓ (Tasks 6–9)
   - GEDCOM commands route to existing endpoints: ✓ (Tasks 10–11)
   - No auth (per `309619a`): ✓ (no auth code anywhere in `cli/`)
   - Dropped commands report friendly errors: ✓ (Task 12 dispatcher)

2. **Placeholder scan** — every step has runnable code or exact commands.

3. **Type consistency** — `ApiClient` method signatures match what commands import; `Page`/`SyncResult` types align with the API responses.

4. **Bundle** — `scripts/bundle.mjs` produces a single `dist/wai.cjs` that runs.

---

## Definition of Done

- All 14 tasks complete; `cli/` typechecks and tests pass.
- `wai healthz`, `wai read`, `wai write`, `wai create`, `wai edit`, `wai delete`, `wai sync-gedcom`, `wai recite` all work end-to-end against a running frontend.
- `wai search` (and the other dropped commands) report a friendly "not yet supported" message.
- The CLI bundles cleanly to `dist/wai.cjs`.
- `cli/package.json` has zero runtime dependencies.
- Branch `migration-spec` has ~14 new commits on top of `309619a`.
- Out of scope (deferred): search (Plan E), upload (assets module), link/changes/category/lint (future endpoints).
