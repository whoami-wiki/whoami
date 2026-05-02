# Frontend: shadcn Directive Components Implementation Plan (Plan F1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<aside class="directive…">` HTML output with shadcn-styled React components, and have `<InfoboxPerson>` merge data from `~/whoami/genealogy/derived/<record>.yml` (Plan D output) so genealogy pages render a proper structured card. Out of scope for this plan: login/logout UI, edit UI, navigation polish — those are F2 / F3.

**Architecture:** The render pipeline shifts from `pipeline.process(md) → string → dangerouslySetInnerHTML` to `pipeline.run(md) → hast → toJsxRuntime(hast, { components })` so directive elements become real React components. The `[slug]` page reads `derived/<record>.yml` server-side when the page's frontmatter has `gedcom.record` and forwards it to `<InfoboxPerson>`. Sanitizer is kept; the directive "tag names" become `directive-cite-vault`, `directive-infobox-person`, etc., and the components map maps each to its corresponding React component.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (existing `Card`, `Alert`, `Button` from Plan C; we don't add more shadcn primitives in F1). `hast-util-to-jsx-runtime` for HAST→JSX conversion. `lucide-react` (already pulled in by shadcn) for admonition icons. `js-yaml` (frontend dep needed for derived-record reads). `node:test` for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md` — particularly the "Two-layer person page" subsection of "GEDCOM as canonical truth", and Phase 3's render pipeline.

## Data-safety constraints

- Never touch `~/Library/Application Support/whoami/data/wiki.sqlite`.
- This plan reads `derived/<record>.yml` files but never modifies them — Plan D owns that path.
- Page bodies stay untouched by all directive components — they receive the body as `children` and render around it.
- Any auth-related work (login UI, logout, edit gating from a browser form) is **out of scope**. The existing `/api/login` endpoint from Plan C remains the only login path; this plan does not change auth behavior.

---

## File Structure

```
frontend/
├── app/
│   └── [slug]/page.tsx                  # MODIFY: render via React tree, pass derived to renderer
├── lib/
│   ├── render.tsx                       # REPLACE: HAST→JSX pipeline; renamed from .ts to .tsx
│   └── derived.ts                       # CREATE: read derived/<record>.yml from disk
└── components/
    └── directives/                      # CREATE: directive React components
        ├── index.tsx                    # exports the components map for hast-util-to-jsx-runtime
        ├── admonition.tsx               # Open/Closed/Superseded/Gap → shadcn Alert variants
        ├── blockquote.tsx
        ├── cite-vault.tsx
        ├── cite-message.tsx
        ├── dialogue.tsx
        ├── columns-list.tsx
        ├── infobox-company.tsx
        └── infobox-person.tsx           # merges derived/<record>.yml when present
```

`globals.css` shrinks: the `.directive-*` rules from Plan C become dead weight (the new tag names are `directive-NAME` and the components own their styling) — Task 9 removes them.

---

## Phase 0 — Deps

### Task 1: Install render-pipeline + YAML deps

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install**

```bash
cd /Users/nyetwork/dev/whoami/frontend
npm install hast-util-to-jsx-runtime js-yaml
npm install -D @types/js-yaml
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add hast-util-to-jsx-runtime + js-yaml for directive rendering"
```

---

## Phase 1 — Helpers

### Task 2: `lib/derived.ts` — read derived YAML

**Files:**
- Create: `frontend/lib/derived.ts`
- Create: `frontend/lib/derived.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDerivedRecord } from './derived';

test('loadDerivedRecord: reads and parses YAML', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'der-'));
  try {
    mkdirSync(join(dir, 'genealogy', 'derived'), { recursive: true });
    writeFileSync(join(dir, 'genealogy', 'derived', 'I1.yml'),
      `record: I1\nname: John Doe\nbirth: { date: '1950', place: null }\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const r = await loadDerivedRecord(dir, 'I1');
    assert.equal(r?.record, 'I1');
    assert.equal(r?.name, 'John Doe');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadDerivedRecord: returns null for missing file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'der-'));
  try {
    mkdirSync(join(dir, 'genealogy', 'derived'), { recursive: true });
    assert.equal(await loadDerivedRecord(dir, 'I999'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadDerivedRecord: rejects malformed record id (path-traversal guard)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'der-'));
  try {
    assert.equal(await loadDerivedRecord(dir, '../etc/passwd'), null);
    assert.equal(await loadDerivedRecord(dir, 'I1; rm -rf'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run, expect 3 fail**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm test
```

- [ ] **Step 3: Implement `frontend/lib/derived.ts`**

```ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { DerivedRecord } from '@core/gedcom/types.ts';

export async function loadDerivedRecord(
  whoamiRoot: string,
  record: string,
): Promise<DerivedRecord | null> {
  if (!/^I\d+$/.test(record)) return null;
  const path = join(whoamiRoot, 'genealogy', 'derived', `${record}.yml`);
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, 'utf-8')) as DerivedRecord;
}
```

- [ ] **Step 4: Run, tests pass**

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add frontend/lib/derived.ts frontend/lib/derived.test.ts
git commit -m "feat: loadDerivedRecord reads genealogy/derived/<record>.yml"
```

---

## Phase 2 — Directive components

### Task 3: Admonition + Blockquote

**Files:**
- Create: `frontend/components/directives/admonition.tsx`
- Create: `frontend/components/directives/blockquote.tsx`
- Create: `frontend/components/directives/index.tsx`

- [ ] **Step 1: `frontend/components/directives/admonition.tsx`**

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  kind: 'open' | 'closed' | 'superseded' | 'gap';
  children?: ReactNode;
}

const PRESETS = {
  open:       { icon: HelpCircle,    label: 'Open',       className: 'border-yellow-500 [&>svg]:text-yellow-600' },
  closed:     { icon: CheckCircle2,  label: 'Closed',     className: 'border-green-500 [&>svg]:text-green-600' },
  superseded: { icon: AlertOctagon,  label: 'Superseded', className: 'border-red-500 [&>svg]:text-red-600' },
  gap:        { icon: AlertTriangle, label: 'Gap',        className: 'border-amber-500 [&>svg]:text-amber-600' },
} as const;

export function Admonition({ kind, children }: Props) {
  const p = PRESETS[kind];
  const Icon = p.icon;
  return (
    <Alert className={p.className}>
      <Icon className="h-4 w-4" />
      <AlertDescription>
        <span className="font-semibold mr-2">{p.label}.</span>
        {children}
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 2: `frontend/components/directives/blockquote.tsx`**

```tsx
import type { ReactNode } from 'react';

interface Props {
  by?: string;
  children?: ReactNode;
}

export function DirectiveBlockquote({ by, children }: Props) {
  return (
    <blockquote className="border-l-4 border-violet-500 pl-4 italic my-4">
      <div>{children}</div>
      {by ? <cite className="block not-italic text-sm text-muted-foreground mt-2">— {by}</cite> : null}
    </blockquote>
  );
}
```

- [ ] **Step 3: `frontend/components/directives/index.tsx` (initial barrel + map)**

```tsx
import type { ComponentType, ReactNode } from 'react';
import { Admonition } from './admonition';
import { DirectiveBlockquote } from './blockquote';

/**
 * Map keyed by directive name (the part after `:::` in markdown). Used by
 * `lib/render.tsx` to swap `directive-NAME` HAST elements for real React
 * components.
 */
export const directiveComponents: Record<string, ComponentType<{ children?: ReactNode; [k: string]: unknown }>> = {
  open:       (p) => <Admonition kind="open">{p.children}</Admonition>,
  closed:     (p) => <Admonition kind="closed">{p.children}</Admonition>,
  superseded: (p) => <Admonition kind="superseded">{p.children}</Admonition>,
  gap:        (p) => <Admonition kind="gap">{p.children}</Admonition>,
  blockquote: (p) => <DirectiveBlockquote by={typeof p.by === 'string' ? p.by : undefined}>{p.children}</DirectiveBlockquote>,
};
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add frontend/components/directives/
git commit -m "feat: admonition + blockquote directive components"
```

---

### Task 4: CiteVault + CiteMessage

**Files:**
- Create: `frontend/components/directives/cite-vault.tsx`
- Create: `frontend/components/directives/cite-message.tsx`
- Modify: `frontend/components/directives/index.tsx`

- [ ] **Step 1: `cite-vault.tsx`**

```tsx
interface Props {
  type?: string;
  snapshot?: string;
  note?: string;
}

export function CiteVault({ type, snapshot, note }: Props) {
  return (
    <aside className="text-xs text-slate-600 dark:text-slate-400 my-2 p-2 bg-slate-50 dark:bg-slate-900 border-l-2 border-slate-300 dark:border-slate-700 rounded-r">
      <div className="font-semibold mb-1">Vault citation</div>
      {type ? <div><span className="font-medium">type:</span> {type}</div> : null}
      {snapshot ? <div><span className="font-medium">snapshot:</span> <code className="text-[10px]">{snapshot}</code></div> : null}
      {note ? <div className="mt-1">{note}</div> : null}
    </aside>
  );
}
```

- [ ] **Step 2: `cite-message.tsx`**

```tsx
interface Props {
  snapshot?: string;
  date?: string;
  thread?: string;
  note?: string;
}

export function CiteMessage({ snapshot, date, thread, note }: Props) {
  return (
    <aside className="text-xs text-slate-600 dark:text-slate-400 my-2 p-2 bg-slate-50 dark:bg-slate-900 border-l-2 border-blue-300 dark:border-blue-700 rounded-r">
      <div className="font-semibold mb-1">Message citation</div>
      {date ? <div><span className="font-medium">date:</span> {date}</div> : null}
      {thread ? <div><span className="font-medium">thread:</span> {thread}</div> : null}
      {snapshot ? <div><span className="font-medium">snapshot:</span> <code className="text-[10px]">{snapshot}</code></div> : null}
      {note ? <div className="mt-1">{note}</div> : null}
    </aside>
  );
}
```

- [ ] **Step 3: Wire into `index.tsx`**

Add the imports and the two map entries. Resulting file:

```tsx
import type { ComponentType, ReactNode } from 'react';
import { Admonition } from './admonition';
import { DirectiveBlockquote } from './blockquote';
import { CiteVault } from './cite-vault';
import { CiteMessage } from './cite-message';

export const directiveComponents: Record<string, ComponentType<{ children?: ReactNode; [k: string]: unknown }>> = {
  open:           (p) => <Admonition kind="open">{p.children}</Admonition>,
  closed:         (p) => <Admonition kind="closed">{p.children}</Admonition>,
  superseded:     (p) => <Admonition kind="superseded">{p.children}</Admonition>,
  gap:            (p) => <Admonition kind="gap">{p.children}</Admonition>,
  blockquote:     (p) => <DirectiveBlockquote by={typeof p.by === 'string' ? p.by : undefined}>{p.children}</DirectiveBlockquote>,
  'cite-vault':   (p) => <CiteVault type={p.type as string | undefined} snapshot={p.snapshot as string | undefined} note={p.note as string | undefined} />,
  'cite-message': (p) => <CiteMessage snapshot={p.snapshot as string | undefined} date={p.date as string | undefined} thread={p.thread as string | undefined} note={p.note as string | undefined} />,
};
```

- [ ] **Step 4: Build verify + commit**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm run build 2>&1 | tail -5
cd /Users/nyetwork/dev/whoami
git add frontend/components/directives/
git commit -m "feat: cite-vault + cite-message directive components"
```

---

### Task 5: Dialogue + ColumnsList

**Files:**
- Create: `frontend/components/directives/dialogue.tsx`
- Create: `frontend/components/directives/columns-list.tsx`
- Modify: `frontend/components/directives/index.tsx`

- [ ] **Step 1: `dialogue.tsx`**

```tsx
import type { ReactNode } from 'react';

interface Props {
  speaker?: string;
  children?: ReactNode;
}

export function Dialogue({ speaker, children }: Props) {
  return (
    <figure className="my-4 pl-4 border-l-4 border-violet-400">
      {speaker ? <figcaption className="text-sm font-semibold text-violet-700 dark:text-violet-300 mb-1">{speaker}:</figcaption> : null}
      <div className="italic">{children}</div>
    </figure>
  );
}
```

- [ ] **Step 2: `columns-list.tsx`**

```tsx
import type { ReactNode } from 'react';

interface Props {
  cols?: string;
  children?: ReactNode;
}

export function ColumnsList({ cols, children }: Props) {
  const n = Number(cols ?? '2');
  const className = n >= 3 ? 'columns-3' : n === 2 ? 'columns-2' : '';
  return <div className={`${className} my-4`}>{children}</div>;
}
```

- [ ] **Step 3: Wire into `index.tsx`**

Add imports `import { Dialogue } from './dialogue';` and `import { ColumnsList } from './columns-list';`. Add map entries:

```tsx
dialogue:        (p) => <Dialogue speaker={p.speaker as string | undefined}>{p.children}</Dialogue>,
'columns-list':  (p) => <ColumnsList cols={p.cols as string | undefined}>{p.children}</ColumnsList>,
```

- [ ] **Step 4: Build verify + commit**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm run build 2>&1 | tail -5
cd /Users/nyetwork/dev/whoami
git add frontend/components/directives/
git commit -m "feat: dialogue + columns-list directive components"
```

---

### Task 6: InfoboxCompany — body-only structured rendering

**Files:**
- Create: `frontend/components/directives/infobox-company.tsx`
- Modify: `frontend/components/directives/index.tsx`

- [ ] **Step 1: `infobox-company.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import yaml from 'js-yaml';

/**
 * The infobox body is a YAML block emitted by the wikitext converter
 * (Plan B). Children come through as a parsed React tree, but for the
 * structured key/value display we re-parse the underlying text.
 */
interface Props {
  fields?: Record<string, string>;
  children?: ReactNode;
}

export function InfoboxCompany({ fields, children }: Props) {
  const parsed = fields ?? extractFieldsFromChildren(children);
  return (
    <Card className="float-right ml-4 max-w-xs my-2 text-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{parsed.name ?? 'Company'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {Object.entries(parsed)
          .filter(([k]) => k !== 'name')
          .map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}:</span> {v}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function extractFieldsFromChildren(children: ReactNode): Record<string, string> {
  const text = childrenToText(children).trim();
  try {
    const parsed = yaml.load(text);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
      );
    }
  } catch { /* ignore */ }
  return {};
}

function childrenToText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('\n');
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return childrenToText(props.children ?? null);
  }
  return '';
}
```

- [ ] **Step 2: Wire into `index.tsx`**

```tsx
import { InfoboxCompany } from './infobox-company';
```

```tsx
'infobox-company': (p) => <InfoboxCompany>{p.children}</InfoboxCompany>,
```

- [ ] **Step 3: Build verify + commit**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm run build 2>&1 | tail -5
cd /Users/nyetwork/dev/whoami
git add frontend/components/directives/
git commit -m "feat: infobox-company directive with structured fields"
```

---

### Task 7: InfoboxPerson — merge `derived/<record>.yml`

**Files:**
- Create: `frontend/components/directives/infobox-person.tsx`
- Modify: `frontend/components/directives/index.tsx`

This is the payoff for Plan D: when `gedcom.record` is present on a page, the renderer passes the derived record down so the InfoboxPerson can show structured data.

- [ ] **Step 1: `infobox-person.tsx`**

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { DerivedRecord } from '@core/gedcom/types.ts';
import yaml from 'js-yaml';

interface Props {
  derived?: DerivedRecord | null;
  children?: ReactNode;
}

export function InfoboxPerson({ derived, children }: Props) {
  const fields = extractFieldsFromChildren(children);
  const name = derived?.name ?? fields.name ?? 'Person';

  return (
    <Card className="float-right ml-4 max-w-xs my-2 text-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {derived ? <DerivedRows d={derived} /> : <FallbackRows fields={fields} />}
      </CardContent>
    </Card>
  );
}

function DerivedRows({ d }: { d: DerivedRecord }) {
  return (
    <>
      {d.birth ? <Row label="born">{[d.birth.date, d.birth.place].filter(Boolean).join(', ') || '—'}</Row> : null}
      {d.death ? <Row label="died">{[d.death.date, d.death.place].filter(Boolean).join(', ') || '—'}</Row> : null}
      {d.parents.length > 0 ? <Row label="parents"><PersonList items={d.parents} /></Row> : null}
      {d.spouses.length > 0 ? <Row label="spouses"><PersonList items={d.spouses} /></Row> : null}
      {d.children.length > 0 ? <Row label="children"><PersonList items={d.children} /></Row> : null}
      {d.residences.length > 0 ? (
        <Row label="residences">
          <ul className="list-none space-y-0.5">
            {d.residences.map((r, i) => (
              <li key={i}>{[r.date, r.place].filter(Boolean).join(', ')}</li>
            ))}
          </ul>
        </Row>
      ) : null}
      {d.occupations.length > 0 ? (
        <Row label="occupations">
          <ul className="list-none space-y-0.5">
            {d.occupations.map((o, i) => (
              <li key={i}>{o.title}{o.date ? ` (${o.date})` : ''}</li>
            ))}
          </ul>
        </Row>
      ) : null}
    </>
  );
}

function FallbackRows({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields)
        .filter(([k]) => k !== 'name')
        .map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> {children}
    </div>
  );
}

function PersonList({ items }: { items: { record: string; name: string }[] }) {
  return (
    <span>
      {items.map((p, i) => (
        <span key={p.record}>
          {i > 0 ? ', ' : ''}
          <Link href={`/${slugifyName(p.name)}`} className="text-blue-600 hover:underline">{p.name}</Link>
        </span>
      ))}
    </span>
  );
}

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

function extractFieldsFromChildren(children: ReactNode): Record<string, string> {
  const text = childrenToText(children).trim();
  try {
    const parsed = yaml.load(text);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
      );
    }
  } catch { /* ignore */ }
  return {};
}

function childrenToText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('\n');
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return childrenToText(props.children ?? null);
  }
  return '';
}
```

- [ ] **Step 2: Wire into `index.tsx`**

```tsx
import { InfoboxPerson } from './infobox-person';
import type { DerivedRecord } from '@core/gedcom/types.ts';
```

```tsx
'infobox-person': (p) => <InfoboxPerson derived={p.derived as DerivedRecord | null | undefined}>{p.children}</InfoboxPerson>,
```

(The page passes `derived={…}` via the renderer's component-binding shim — see Task 8.)

- [ ] **Step 3: Build verify + commit**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm run build 2>&1 | tail -5
cd /Users/nyetwork/dev/whoami
git add frontend/components/directives/
git commit -m "feat: infobox-person component with derived/ data merge"
```

---

## Phase 3 — Renderer switch

### Task 8: Replace `lib/render.ts` with HAST→JSX runtime

**Files:**
- Delete: `frontend/lib/render.ts`
- Create: `frontend/lib/render.tsx`
- Modify: `frontend/app/[slug]/page.tsx`

- [ ] **Step 1: Write `frontend/lib/render.tsx`**

```tsx
import type { ReactElement } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit } from 'unist-util-visit';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { DerivedRecord } from '@core/gedcom/types.ts';
import { directiveComponents } from '@/components/directives';
import { resolveWikilinks, type SlugIndex } from './wikilinks';

function directivesToHast() {
  return (tree: unknown) => {
    visit(tree as never, (node: never) => {
      const n = node as { type: string; name?: string; data?: { hName?: string; hProperties?: Record<string, unknown> }; attributes?: Record<string, string> };
      if (n.type === 'containerDirective' || n.type === 'leafDirective' || n.type === 'textDirective') {
        const data = n.data ?? (n.data = {});
        // Synthetic tag name — routed through our React components map
        data.hName = `directive-${n.name}`;
        data.hProperties = { ...(n.attributes ?? {}) };
      }
    });
  };
}

const directiveTagNames = Object.keys(directiveComponents).map(n => `directive-${n}`);

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...directiveTagNames, 'aside', 'span', 'figure', 'figcaption', 'cite'],
  attributes: {
    ...defaultSchema.attributes,
    ...Object.fromEntries(directiveTagNames.map(t => [t, ['type', 'snapshot', 'note', 'date', 'thread', 'speaker', 'by', 'cols']])),
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
  .use(rehypeSanitize, sanitizeSchema);

interface RenderContext {
  derived?: DerivedRecord | null;
}

/**
 * Render markdown into a React tree, mapping `:::name{…}` directives to the
 * components in `components/directives/`. The `context.derived` value, when
 * provided, is forwarded to the InfoboxPerson component so it can render
 * structured fields from `genealogy/derived/<record>.yml` instead of (or in
 * addition to) the YAML body the converter emitted.
 */
export async function renderMarkdown(
  md: string,
  index: SlugIndex,
  context: RenderContext = {},
): Promise<ReactElement> {
  const tree = pipeline.parse(resolveWikilinks(md, index));
  const hast = await pipeline.run(tree);
  // Build a wrapping component map that injects `derived` into infobox-person
  const components: Record<string, (p: Record<string, unknown>) => ReactElement> = {};
  for (const [name, Comp] of Object.entries(directiveComponents)) {
    const tag = `directive-${name}`;
    if (name === 'infobox-person') {
      components[tag] = (p) => <Comp {...p} derived={context.derived} />;
    } else {
      components[tag] = (p) => <Comp {...p} />;
    }
  }
  return toJsxRuntime(hast as never, {
    Fragment,
    jsx: jsx as never,
    jsxs: jsxs as never,
    components: components as never,
  }) as ReactElement;
}
```

- [ ] **Step 2: Update `frontend/app/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPageStore, getCachedList } from '@/lib/server-services';
import { renderMarkdown } from '@/lib/render';
import { loadDerivedRecord } from '@/lib/derived';
import { isValidSlug } from '@core/pages/index.ts';
import { WHOAMI_ROOT } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function PageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const store = getPageStore();
  const [page, { index }] = await Promise.all([
    store.read(slug).catch(() => null),
    getCachedList(),
  ]);
  if (!page) notFound();

  const derived = page.meta.gedcom?.record
    ? await loadDerivedRecord(WHOAMI_ROOT, page.meta.gedcom.record)
    : null;

  const tree = await renderMarkdown(page.body, index, { derived });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/" className="text-sm text-muted-foreground">← Index</Link>
      <h1 className="text-3xl font-bold mt-4 mb-6">{page.meta.title}</h1>
      <article className="prose dark:prose-invert max-w-none">{tree}</article>
    </main>
  );
}
```

- [ ] **Step 3: Verify against the real wiki**

```bash
cd /Users/nyetwork/dev/whoami/frontend
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
NEXT_PID=$!; sleep 6

echo "--- abby has shadcn Card markup ---"
curl -s http://localhost:3001/abby-rickelman | grep -oE '(data-slot="card"|class="[^"]*\bcard\b)' | head -3

echo "--- abby has parent links from derived/ ---"
curl -s http://localhost:3001/abby-rickelman | grep -oE '(Yaroslav Steven Rickelman|Irene Burmenko)' | sort -u

echo "--- a talk page admonition renders the Alert ---"
curl -s http://localhost:3001/aidele.talk | grep -oE '(role="alert"|directive-open)' | head -3

kill $NEXT_PID 2>/dev/null; wait $NEXT_PID 2>/dev/null || true
```

Expected:
- shadcn Card markup is present (data-slot or className with "card")
- Both "Yaroslav Steven Rickelman" and "Irene Burmenko" appear (parents from derived data)
- Talk page Alerts have `role="alert"`

- [ ] **Step 4: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git rm frontend/lib/render.ts
git add frontend/lib/render.tsx frontend/app/[slug]/page.tsx
git commit -m "feat: render markdown to react via hast-util-to-jsx-runtime; merge derived data"
```

---

## Phase 4 — Cleanup + verification

### Task 9: Drop dead `.directive-*` CSS

**Files:**
- Modify: `frontend/app/globals.css`

The `.directive`, `.directive-infobox-person`, etc. rules from Plan C styled the old `<aside class="directive…">` markup. With React components now owning their styling via Tailwind, those rules are dead — the new tag names are `directive-NAME` and the classes don't match anymore.

- [ ] **Step 1: Read and edit `frontend/app/globals.css`**

Remove from inside the `@layer components { … }` block:
- `.directive { … }`
- `.directive-infobox-person, .directive-infobox-company { … }`
- `.directive-cite-vault, .directive-cite-message { … }`
- `.directive-open { … }`
- `.directive-closed { … }`
- `.directive-superseded { … }`

Keep `.redlink` (wikilinks still use it). If the `@layer components` block becomes empty, remove the wrapping block too.

- [ ] **Step 2: Verify build**

```bash
cd /Users/nyetwork/dev/whoami/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add frontend/app/globals.css
git commit -m "chore: drop dead .directive-* CSS now that React components own styling"
```

---

### Task 10: End-to-end smoke against real data

**Files:** none (verification only)

- [ ] **Step 1: Run dev server**

```bash
cd /Users/nyetwork/dev/whoami/frontend
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
NEXT_PID=$!; sleep 6

echo "=== abby-rickelman ==="
curl -s http://localhost:3001/abby-rickelman > /tmp/abby.html
grep -oE 'data-slot="card[a-z-]*"' /tmp/abby.html | sort -u
grep -oE '(Yaroslav Steven Rickelman|Irene Burmenko)' /tmp/abby.html | sort -u

echo
echo "=== a page with cite-vault ==="
grep -c 'Vault citation' /tmp/abby.html

echo
echo "=== aidele.talk admonition ==="
curl -s http://localhost:3001/aidele.talk > /tmp/aidele.html
grep -oE '(role="alert"|Open\.|Closed\.)' /tmp/aidele.html | head -3

echo
echo "=== gedalya-barash renders ==="
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/gedalya-barash

echo
echo "=== index renders ==="
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/

kill $NEXT_PID 2>/dev/null; wait $NEXT_PID 2>/dev/null || true
```

Expected:
- Card data-slots present on Abby's page
- Both "Yaroslav Steven Rickelman" and "Irene Burmenko" appear (derived merge working)
- "Vault citation" appears at least once
- Alert role + "Open." label on the talk page
- Gedalya page is 200; index is 200

- [ ] **Step 2: Open in a browser** (manual)

`http://100.85.23.19:3001` from any device on the tailnet:
- Person pages with `gedcom.record` show a styled Card on the right with parents/spouses/children clickable
- An Open admonition renders as a yellow Alert with a "?" icon
- A blockquote has a left violet bar with attribution underneath
- Cite-vault renders as a small grey block with snapshot hash

If any of those visibly regress vs. Plan C output, debug.

- [ ] **Step 3: No commit** — purely verification.

---

## Self-Review Checklist

After all 10 tasks complete:

1. **Spec coverage**
   - shadcn-styled directive components: ✓ (Tasks 3-7)
   - InfoboxPerson reads `derived/<record>.yml`: ✓ (Task 7)
   - Render pipeline switched to React components via `hast-util-to-jsx-runtime`: ✓ (Task 8)
   - Sanitizer kept; directive tag-names allow-listed: ✓ (Task 8)

2. **Placeholder scan** — no TBDs, every step has runnable code/exact commands.

3. **Type consistency**
   - `DerivedRecord` imported from `@core/gedcom/types.ts` consistently
   - All directive components export named functions and live in `components/directives/`
   - `directiveComponents` map keys match the directive names emitted by Plan B (cite-vault, infobox-person, etc.)

---

## Definition of Done

- All 10 tasks complete; `frontend/` builds cleanly.
- Plan C tests still pass (90+ in `core/`, plus the 9-ish in `frontend/lib/*.test.ts`); F1 adds 3 new tests in `lib/derived.test.ts`.
- Person pages with `gedcom.record` render parents/spouses/children resolved from `derived/<record>.yml` in their infobox.
- Admonitions, cite-vault, cite-message, blockquote, dialogue, columns-list all render via shadcn-styled components rather than raw `<aside>`s.
- Branch `migration-spec` has ~10 new commits on top of Plan D.
- Out of scope (deferred to F2/F3): login UI, edit UI, header, navigation polish, history viewer, tree visualization.
