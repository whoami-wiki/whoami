# GEDCOM Module + Sync + Recite Implementation Plan (Plan D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `core/gedcom` module + HTTP endpoints (`POST /api/gedcom/sync`, `GET/POST /api/gedcom/recite`) so the `.ged` file under `~/whoami/genealogy/` becomes the canonical structural truth. Each individual is materialized as a `derived/<record>.yml` sidecar; pages can render structured infobox data and tree fragments from these sidecars in a future plan; citations on pages can be reconciled against the current `.ged` via `recite`.

**Architecture:** `core/gedcom` is a platform-agnostic TypeScript module (matches `core/pages` and `core/auth` patterns from Plan C). It parses GEDCOM 5.5.1 UTF-8 only (rejects ANSEL and 7.0 with a clear error per spec), derives one structured YAML per `INDI` record into `genealogy/derived/<record>.yml`, manages the snapshots manifest, and exposes a `recite` operation that uses **git history** in the `genealogy/` directory to diff cited snapshots against current state. Each sync writes a git commit; recite finds the corresponding commit by date (`git log --before=<cited.date> -- snapshots.yml`) rather than recording the commit SHA in the manifest — avoids the chicken-and-egg of a commit knowing its own hash. Frontend exposes the operations via `app/api/gedcom/*` route handlers gated by the same auth as `pages` writes.

**Tech Stack:** Node 22, TypeScript 5.5+ strict, ESM. `parse-gedcom` (npm) for the line-by-line parse; we walk the result tree ourselves to derive into our schema. `js-yaml` (already in `core` deps) for reading/writing manifest + derived files. `simple-git` (already in `core` deps) for the commits and history. `node:test` for tests, with synthetic `.ged` fixtures committed in `core/test/gedcom/fixtures/`.

**Reference spec:** `docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md` — particularly the "GEDCOM as canonical truth" section (two-layer page model, snapshots manifest, multi-tree forward-compat) and Phase 4 (`wai sync-gedcom`, `wai recite` semantics).

## Data-safety constraints (read first)

- **Never touch `~/Library/Application Support/whoami/data/wiki.sqlite`.** That is the legacy MediaWiki database — the source-of-truth for the Plan B migration. Plan D does NOT read, modify, or delete it. The `.ged` is the only canonical source for genealogy structural data; the SQLite is preserved as the rollback path for the wikitext content.
- The `.ged` file at `~/whoami/genealogy/barash-tree.ged` is read but never modified. Sync only writes to `genealogy/derived/*.yml` and `genealogy/snapshots.yml`.
- The `~/whoami/pages/` directory is only modified by `applyRecite`, which targets a single line (the `snapshot:` value in frontmatter). Body content and other frontmatter fields are never touched.
- All writes happen in `~/whoami/.git`; the project repo (`~/dev/whoami`) gains only source code under `core/src/gedcom/` and `frontend/app/api/gedcom/`.

---

## File Structure

```
core/
├── src/gedcom/
│   ├── index.ts              # public API + factory
│   ├── types.ts              # GedcomIndividual, GedcomFamily, DerivedRecord
│   ├── parser.ts             # parse-gedcom wrapper; rejects non-5.5.1-UTF-8
│   ├── derive.ts             # tree → DerivedRecord per individual
│   ├── snapshots.ts          # snapshots.yml manifest read/write
│   ├── sync.ts               # syncGedcom: parse, derive, diff, write, commit
│   └── recite.ts             # reciteDrift: walk pages, git-show old derived, diff
└── test/gedcom/
    ├── fixtures/
    │   ├── tiny.ged                # 2 individuals, 1 family — smoke test
    │   ├── multi-event.ged         # 1 individual with BIRT/DEAT/RESI/OCCU/FAMC/FAMS
    │   └── ansel-rejected.ged      # GEDCOM with `1 CHAR ANSEL` — must be rejected
    ├── parser.test.ts
    ├── derive.test.ts
    ├── snapshots.test.ts
    ├── sync.test.ts
    └── recite.test.ts

frontend/
└── app/api/gedcom/
    ├── sync/route.ts           # POST: re-parse .ged, write derived/, commit
    └── recite/route.ts         # GET: report drift; POST: apply (advance snapshot pointers)
```

---

## Phase 0 — Scaffold

### Task 1: Add `parse-gedcom` + scaffold `core/src/gedcom/`

**Files:**
- Modify: `core/package.json` (add `parse-gedcom` dependency)
- Create: `core/src/gedcom/types.ts`
- Create: `core/src/gedcom/index.ts`

- [ ] **Step 1: Install parse-gedcom**

```bash
cd /Users/nyetwork/dev/whoami/core && npm install parse-gedcom
```

Expected: completes; `package-lock.json` updated.

- [ ] **Step 2: Create `core/src/gedcom/types.ts`**

```ts
/** Internal parsed-tree types from parse-gedcom (the npm package). */
export interface GedcomNode {
  tag: string;
  pointer?: string;       // "@I123@" on top-level records
  data?: string;          // raw value (line tail)
  tree: GedcomNode[];     // children
}

/** Reference to another individual by GEDCOM record id. */
export interface IndividualRef {
  record: string;         // "I123" (without surrounding @)
  name: string;
}

/** A dated event such as BIRT, DEAT, MARR. Date and place are both optional. */
export interface DatedEvent {
  date: string | null;          // raw GEDCOM DATE value, e.g. "12 JAN 1950" or "ABT 1880"
  place: string | null;
}

/** RESI event — when/where someone lived. */
export interface ResidenceEvent extends DatedEvent {}

/** OCCU event — occupation, with optional date range. */
export interface OccupationEvent {
  title: string;
  date: string | null;
}

/** Source citation — pointer to a SOUR record. */
export interface SourceRef {
  record: string;         // "S1"
}

/** The structured shape we emit per individual into `genealogy/derived/<record>.yml`. */
export interface DerivedRecord {
  record: string;                       // "I28906361734"
  name: string;                         // "Abby Rickelman"
  birth: DatedEvent | null;
  death: DatedEvent | null;
  parents: IndividualRef[];
  spouses: { record: string; name: string; married: string | null }[];
  children: { record: string; name: string; born: string | null }[];
  residences: ResidenceEvent[];
  occupations: OccupationEvent[];
  sources: SourceRef[];
}

/** Snapshots manifest entry shape. Compatible with what tools/wikitext-to-md/
 *  wrote during the Plan B migration import (no extra fields added by Plan D).
 *  recite finds the corresponding commit via git log on `date` rather than a
 *  recorded SHA — avoids the chicken-and-egg of a commit knowing its own hash. */
export interface SnapshotEntry {
  hash: string;           // SHA-256 hex of the .ged file at sync time
  date: string;           // ISO 8601 timestamp — used by recite to find the commit
  file: string;           // e.g. "barash-tree.ged"
  notes: string;
}

/** Difference summary returned by syncGedcom. */
export interface SyncDiff {
  added: string[];        // record ids
  changed: string[];
  removed: string[];
}

/** Drift entry returned by reciteDrift. */
export interface ReciteEntry {
  slug: string;
  record: string;
  citedSnapshot: string;
  latestSnapshot: string;
  changedFields: string[];   // names of fields that differ between cited and current
}
```

- [ ] **Step 3: Create `core/src/gedcom/index.ts` (placeholder)**

```ts
export * from './types.ts';
```

- [ ] **Step 4: Re-export from `core/src/index.ts`**

Read `core/src/index.ts`, append:

```ts
export * from './gedcom/index.ts';
```

- [ ] **Step 5: Verify typecheck**

Run: `cd core && npm run typecheck`
Expected: exits 0 with no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add core/package.json core/package-lock.json core/src/gedcom/types.ts core/src/gedcom/index.ts core/src/index.ts
git commit -m "chore: scaffold core/gedcom with shared types"
```

- [ ] **Step 7: Add `.DS_Store` to the wiki repo's gitignore**

`git add -A` (used by sync) would otherwise track macOS Finder metadata files inside `~/whoami/genealogy/derived/`. Append to `~/whoami/.gitignore`:

```bash
cd ~/whoami
if ! grep -q '^\.DS_Store$' .gitignore; then
  printf '\n# macOS Finder metadata\n.DS_Store\n' >> .gitignore
  git add .gitignore
  git commit -m "chore: ignore .DS_Store"
fi
```

This commit goes into the wiki repo (`~/whoami/.git`), not the project repo. The conditional is defensive; this script is safe to run on a machine that already has the line.

---

## Phase 1 — Parser

### Task 2: Tiny `.ged` fixture

**Files:**
- Create: `core/test/gedcom/fixtures/tiny.ged`
- Create: `core/test/gedcom/fixtures/ansel-rejected.ged`

- [ ] **Step 1: Write `core/test/gedcom/fixtures/tiny.ged`**

```
0 HEAD
1 SOUR test-fixture
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 BIRT
2 DATE 12 JAN 1950
2 PLAC Pittsburgh, PA, USA
1 FAMS @F1@
0 @I2@ INDI
1 NAME Jane /Doe/
1 SEX F
1 BIRT
2 DATE 5 MAR 1952
1 FAMS @F1@
0 @I3@ INDI
1 NAME Junior /Doe/
1 SEX M
1 BIRT
2 DATE 1 JUN 1980
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 14 FEB 1975
2 PLAC Pittsburgh, PA, USA
0 TRLR
```

- [ ] **Step 2: Write `core/test/gedcom/fixtures/ansel-rejected.ged`**

```
0 HEAD
1 SOUR test-fixture
1 GEDC
2 VERS 5.5
2 FORM LINEAGE-LINKED
1 CHAR ANSEL
0 @I1@ INDI
1 NAME X /Y/
0 TRLR
```

- [ ] **Step 3: Commit**

```bash
git add core/test/gedcom/fixtures/
git commit -m "test: add tiny.ged and ansel-rejected.ged fixtures"
```

---

### Task 3: GEDCOM parser (with version+encoding gate)

**Files:**
- Create: `core/src/gedcom/parser.ts`
- Create: `core/test/gedcom/parser.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGedcomFile } from '../../src/gedcom/parser.ts';

const FIX = (n: string) => join(import.meta.dirname, 'fixtures', n);

test('parseGedcomFile: returns INDI and FAM records by id', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  assert.equal(result.individuals.size, 3);
  assert.equal(result.families.size, 1);
  assert.ok(result.individuals.has('I1'));
  assert.ok(result.families.has('F1'));
});

test('parseGedcomFile: rejects ANSEL-encoded GEDCOM', async () => {
  await assert.rejects(parseGedcomFile(FIX('ansel-rejected.ged')), /ANSEL/i);
});

test('parseGedcomFile: rejects when CHAR is missing', async () => {
  const tmpFile = join(import.meta.dirname, 'fixtures', '_tmp-no-char.ged');
  const { writeFileSync, unlinkSync } = await import('node:fs');
  writeFileSync(tmpFile, '0 HEAD\n0 @I1@ INDI\n1 NAME X /Y/\n0 TRLR\n');
  try {
    await assert.rejects(parseGedcomFile(tmpFile), /CHAR/i);
  } finally {
    unlinkSync(tmpFile);
  }
});

test('parseGedcomFile: each individual exposes its raw children tree', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const nameNode = i1.tree.find(n => n.tag === 'NAME');
  assert.equal(nameNode?.data, 'John /Doe/');
});
```

- [ ] **Step 2: Run, expect 4 fail**

`cd core && npm test`

- [ ] **Step 3: Implement `core/src/gedcom/parser.ts`**

```ts
import { readFileSync } from 'node:fs';
import * as parseGedcomLib from 'parse-gedcom';
import type { GedcomNode } from './types.ts';

export interface ParseResult {
  individuals: Map<string, GedcomNode>;   // "I123" → its tree
  families: Map<string, GedcomNode>;      // "F1" → its tree
  raw: GedcomNode[];                      // all top-level records (for sources, etc.)
}

/**
 * parse-gedcom's published shape varies by version: older (0.1.x) emits
 * `{ tag, data, tree }`; newer (3.x) emits `{ tag, value, children }`.
 * Normalize to our internal `GedcomNode` shape (tag/data/tree) so derive.ts
 * doesn't need to care which version is installed.
 */
type RawNode = {
  tag: string;
  pointer?: string;
  data?: string;
  value?: string;
  tree?: RawNode[];
  children?: RawNode[];
};

function normalize(node: RawNode): GedcomNode {
  const kids = node.children ?? node.tree ?? [];
  return {
    tag: node.tag,
    pointer: node.pointer,
    data: node.value ?? node.data,
    tree: kids.map(normalize),
  };
}

/** Parse a GEDCOM 5.5.1 UTF-8 file. Throws on missing/unsupported CHAR. */
export async function parseGedcomFile(path: string): Promise<ParseResult> {
  const text = readFileSync(path, 'utf-8');
  // parse-gedcom may expose `parse` as a named export, default export, or
  // single-function module export. Try all three.
  const lib = parseGedcomLib as unknown as Record<string, unknown> & { default?: unknown };
  const candidates: unknown[] = [
    lib.parse,
    typeof lib.default === 'object' && lib.default !== null ? (lib.default as Record<string, unknown>).parse : undefined,
    lib.default,
  ];
  const parser = candidates.find(c => typeof c === 'function') as ((s: string) => RawNode[]) | undefined;
  if (!parser) throw new Error('parse-gedcom: could not locate parse function (incompatible version?)');

  const rawTop = parser(text);
  const top: GedcomNode[] = rawTop.map(normalize);

  const head = top.find(n => n.tag === 'HEAD');
  if (!head) throw new Error('GEDCOM: no HEAD record');
  const charNode = head.tree.find(n => n.tag === 'CHAR');
  if (!charNode) throw new Error('GEDCOM: missing CHAR (encoding); only UTF-8 is supported');
  const encoding = (charNode.data ?? '').trim().toUpperCase();
  if (encoding !== 'UTF-8' && encoding !== 'UTF8') {
    throw new Error(`GEDCOM: ${encoding} encoding not supported (this tool only accepts UTF-8); ANSEL and other encodings are out of scope`);
  }

  const gedcNode = head.tree.find(n => n.tag === 'GEDC');
  const versNode = gedcNode?.tree.find(n => n.tag === 'VERS');
  const version = (versNode?.data ?? '').trim();
  if (version && !version.startsWith('5.5')) {
    throw new Error(`GEDCOM: version ${version} not supported (this tool only accepts 5.5.x)`);
  }

  const individuals = new Map<string, GedcomNode>();
  const families = new Map<string, GedcomNode>();
  for (const record of top) {
    if (record.tag === 'INDI' && record.pointer) {
      individuals.set(stripPointer(record.pointer), record);
    } else if (record.tag === 'FAM' && record.pointer) {
      families.set(stripPointer(record.pointer), record);
    }
  }

  return { individuals, families, raw: top };
}

function stripPointer(p: string): string {
  return p.replace(/^@|@$/g, '');
}
```

- [ ] **Step 4: Run, expect tests pass**

The `normalize()` adapter handles both old and new parse-gedcom shapes. If tests still fail because of an unexpected shape (e.g., `pointer` lives elsewhere), inspect a single record from the parsed result and adapt.

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/parser.ts core/test/gedcom/parser.test.ts
git commit -m "feat: parse GEDCOM 5.5.1 UTF-8 with strict encoding gate"
```

---

## Phase 2 — Derivation

### Task 4: Derive name + sex + simple events (BIRT, DEAT)

**Files:**
- Create: `core/src/gedcom/derive.ts`
- Create: `core/test/gedcom/derive.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseGedcomFile } from '../../src/gedcom/parser.ts';
import { deriveIndividual } from '../../src/gedcom/derive.ts';

const FIX = (n: string) => join(import.meta.dirname, 'fixtures', n);

test('deriveIndividual: extracts name and birth', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const derived = deriveIndividual(i1, 'I1', result);
  assert.equal(derived.record, 'I1');
  assert.equal(derived.name, 'John Doe');
  assert.deepEqual(derived.birth, { date: '12 JAN 1950', place: 'Pittsburgh, PA, USA' });
  assert.equal(derived.death, null);
});

test('deriveIndividual: name handles "/Surname/" wrapper', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i2 = result.individuals.get('I2')!;
  const derived = deriveIndividual(i2, 'I2', result);
  assert.equal(derived.name, 'Jane Doe');
});

test('deriveIndividual: birth without place keeps place null', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i2 = result.individuals.get('I2')!;
  const derived = deriveIndividual(i2, 'I2', result);
  assert.deepEqual(derived.birth, { date: '5 MAR 1952', place: null });
});
```

- [ ] **Step 2: Run, expect 3 fail**

- [ ] **Step 3: Implement `core/src/gedcom/derive.ts`** (initial — only name/birth/death; rest stubbed)

```ts
import type { GedcomNode, DerivedRecord, DatedEvent } from './types.ts';
import type { ParseResult } from './parser.ts';

export function deriveIndividual(node: GedcomNode, record: string, ctx: ParseResult): DerivedRecord {
  return {
    record,
    name: deriveName(node),
    birth: deriveDatedEvent(node, 'BIRT'),
    death: deriveDatedEvent(node, 'DEAT'),
    parents: [],
    spouses: [],
    children: [],
    residences: [],
    occupations: [],
    sources: [],
  };
}

function deriveName(node: GedcomNode): string {
  const nameNode = node.tree.find(n => n.tag === 'NAME');
  if (!nameNode?.data) return '';
  // GEDCOM names are formatted "Given /Surname/ Suffix"
  return nameNode.data.replace(/\//g, '').replace(/\s+/g, ' ').trim();
}

function deriveDatedEvent(node: GedcomNode, tag: string): DatedEvent | null {
  const eventNode = node.tree.find(n => n.tag === tag);
  if (!eventNode) return null;
  const dateNode = eventNode.tree.find(n => n.tag === 'DATE');
  const placeNode = eventNode.tree.find(n => n.tag === 'PLAC');
  const date = dateNode?.data?.trim() || null;
  const place = placeNode?.data?.trim() || null;
  if (!date && !place) return null;
  return { date, place };
}
```

- [ ] **Step 4: Run, expect tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/derive.ts core/test/gedcom/derive.test.ts
git commit -m "feat: derive name + birth + death from INDI record"
```

---

### Task 5: Derive parents from FAMC

**Files:**
- Modify: `core/src/gedcom/derive.ts`
- Modify: `core/test/gedcom/derive.test.ts`

- [ ] **Step 1: Append failing test**

```ts
test('deriveIndividual: extracts parents from FAMC', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const child = result.individuals.get('I3')!;
  const derived = deriveIndividual(child, 'I3', result);
  const records = derived.parents.map(p => p.record).sort();
  assert.deepEqual(records, ['I1', 'I2']);
  const names = derived.parents.map(p => p.name).sort();
  assert.deepEqual(names, ['Jane Doe', 'John Doe']);
});

test('deriveIndividual: returns empty parents for top of tree', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const derived = deriveIndividual(i1, 'I1', result);
  assert.deepEqual(derived.parents, []);
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Add `deriveParents` and call it from `deriveIndividual`**

In `core/src/gedcom/derive.ts`, replace the empty `parents: []` with `parents: deriveParents(node, ctx)` and add:

```ts
import type { IndividualRef } from './types.ts';

function deriveParents(node: GedcomNode, ctx: ParseResult): IndividualRef[] {
  const out: IndividualRef[] = [];
  for (const famc of node.tree.filter(n => n.tag === 'FAMC')) {
    const famPointer = (famc.data ?? '').replace(/^@|@$/g, '');
    const fam = ctx.families.get(famPointer);
    if (!fam) continue;
    for (const tag of ['HUSB', 'WIFE'] as const) {
      const link = fam.tree.find(n => n.tag === tag);
      if (!link?.data) continue;
      const parentRecord = link.data.replace(/^@|@$/g, '');
      const parent = ctx.individuals.get(parentRecord);
      if (!parent) continue;
      out.push({ record: parentRecord, name: deriveName(parent) });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/derive.ts core/test/gedcom/derive.test.ts
git commit -m "feat: derive parents from FAMC links"
```

---

### Task 6: Derive spouses + children from FAMS

**Files:**
- Modify: `core/src/gedcom/derive.ts`
- Modify: `core/test/gedcom/derive.test.ts`

- [ ] **Step 1: Append failing test**

```ts
test('deriveIndividual: extracts spouses and children from FAMS', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const derived = deriveIndividual(i1, 'I1', result);
  // John has one spouse (Jane) and one child (Junior)
  assert.equal(derived.spouses.length, 1);
  assert.equal(derived.spouses[0]!.record, 'I2');
  assert.equal(derived.spouses[0]!.name, 'Jane Doe');
  assert.equal(derived.spouses[0]!.married, '14 FEB 1975');
  assert.equal(derived.children.length, 1);
  assert.equal(derived.children[0]!.record, 'I3');
  assert.equal(derived.children[0]!.born, '1 JUN 1980');
});

test('deriveIndividual: spouse "married" is null when FAM has no MARR DATE', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  // Patch the FAM in memory: drop MARR for this assertion.
  const fam = result.families.get('F1')!;
  const original = fam.tree;
  fam.tree = original.filter(n => n.tag !== 'MARR');
  try {
    const derived = deriveIndividual(result.individuals.get('I1')!, 'I1', result);
    assert.equal(derived.spouses[0]!.married, null);
  } finally {
    fam.tree = original;
  }
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Add `deriveSpousesAndChildren` and update `deriveIndividual`**

In `derive.ts`:

```ts
function deriveSpousesAndChildren(
  node: GedcomNode,
  selfRecord: string,
  ctx: ParseResult,
): Pick<DerivedRecord, 'spouses' | 'children'> {
  const spouses: DerivedRecord['spouses'] = [];
  const children: DerivedRecord['children'] = [];

  for (const fams of node.tree.filter(n => n.tag === 'FAMS')) {
    const famPointer = (fams.data ?? '').replace(/^@|@$/g, '');
    const fam = ctx.families.get(famPointer);
    if (!fam) continue;
    const married = fam.tree.find(n => n.tag === 'MARR')?.tree.find(n => n.tag === 'DATE')?.data?.trim() || null;

    // The other spouse is whichever HUSB/WIFE pointer isn't selfRecord
    for (const tag of ['HUSB', 'WIFE'] as const) {
      const link = fam.tree.find(n => n.tag === tag);
      if (!link?.data) continue;
      const partnerRecord = link.data.replace(/^@|@$/g, '');
      if (partnerRecord === selfRecord) continue;
      const partner = ctx.individuals.get(partnerRecord);
      if (!partner) continue;
      spouses.push({ record: partnerRecord, name: deriveName(partner), married });
    }

    for (const chil of fam.tree.filter(n => n.tag === 'CHIL')) {
      const childRecord = (chil.data ?? '').replace(/^@|@$/g, '');
      const child = ctx.individuals.get(childRecord);
      if (!child) continue;
      const born = child.tree.find(n => n.tag === 'BIRT')?.tree.find(n => n.tag === 'DATE')?.data?.trim() || null;
      children.push({ record: childRecord, name: deriveName(child), born });
    }
  }

  return { spouses, children };
}
```

Update `deriveIndividual`:

```ts
export function deriveIndividual(node: GedcomNode, record: string, ctx: ParseResult): DerivedRecord {
  const sc = deriveSpousesAndChildren(node, record, ctx);
  return {
    record,
    name: deriveName(node),
    birth: deriveDatedEvent(node, 'BIRT'),
    death: deriveDatedEvent(node, 'DEAT'),
    parents: deriveParents(node, ctx),
    spouses: sc.spouses,
    children: sc.children,
    residences: [],
    occupations: [],
    sources: [],
  };
}
```

- [ ] **Step 4: Run, tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/derive.ts core/test/gedcom/derive.test.ts
git commit -m "feat: derive spouses and children via FAMS"
```

---

### Task 7: Derive RESI, OCCU, SOUR

**Files:**
- Create: `core/test/gedcom/fixtures/multi-event.ged`
- Modify: `core/src/gedcom/derive.ts`
- Modify: `core/test/gedcom/derive.test.ts`

- [ ] **Step 1: Write the multi-event fixture**

`core/test/gedcom/fixtures/multi-event.ged`:

```
0 HEAD
1 SOUR test-fixture
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @S1@ SOUR
1 TITL 1928 Teofipol Census
0 @I1@ INDI
1 NAME Aidele /Ayzman/
1 RESI
2 DATE FROM 1881 TO 1928
2 PLAC Teofipol, Khmelnytsky, Ukraine
1 OCCU Seamstress
2 DATE FROM 1900
1 SOUR @S1@
0 TRLR
```

- [ ] **Step 2: Append failing tests**

```ts
test('deriveIndividual: extracts residences', async () => {
  const result = await parseGedcomFile(FIX('multi-event.ged'));
  const derived = deriveIndividual(result.individuals.get('I1')!, 'I1', result);
  assert.equal(derived.residences.length, 1);
  assert.equal(derived.residences[0]!.date, 'FROM 1881 TO 1928');
  assert.equal(derived.residences[0]!.place, 'Teofipol, Khmelnytsky, Ukraine');
});

test('deriveIndividual: extracts occupations', async () => {
  const result = await parseGedcomFile(FIX('multi-event.ged'));
  const derived = deriveIndividual(result.individuals.get('I1')!, 'I1', result);
  assert.equal(derived.occupations.length, 1);
  assert.equal(derived.occupations[0]!.title, 'Seamstress');
  assert.equal(derived.occupations[0]!.date, 'FROM 1900');
});

test('deriveIndividual: extracts source citations', async () => {
  const result = await parseGedcomFile(FIX('multi-event.ged'));
  const derived = deriveIndividual(result.individuals.get('I1')!, 'I1', result);
  assert.deepEqual(derived.sources, [{ record: 'S1' }]);
});
```

- [ ] **Step 3: Run, expect 3 fail**

- [ ] **Step 4: Implement extractors and wire up**

Add to `derive.ts`:

```ts
import type { ResidenceEvent, OccupationEvent, SourceRef } from './types.ts';

function deriveResidences(node: GedcomNode): ResidenceEvent[] {
  return node.tree
    .filter(n => n.tag === 'RESI')
    .map(resi => ({
      date: resi.tree.find(n => n.tag === 'DATE')?.data?.trim() || null,
      place: resi.tree.find(n => n.tag === 'PLAC')?.data?.trim() || null,
    }))
    .filter(r => r.date || r.place);
}

function deriveOccupations(node: GedcomNode): OccupationEvent[] {
  return node.tree
    .filter(n => n.tag === 'OCCU')
    .map(occu => ({
      title: (occu.data ?? '').trim(),
      date: occu.tree.find(n => n.tag === 'DATE')?.data?.trim() || null,
    }))
    .filter(o => o.title);
}

function deriveSources(node: GedcomNode): SourceRef[] {
  return node.tree
    .filter(n => n.tag === 'SOUR' && n.data)
    .map(s => ({ record: (s.data ?? '').replace(/^@|@$/g, '') }));
}
```

Update `deriveIndividual` to use these:

```ts
return {
  record,
  name: deriveName(node),
  birth: deriveDatedEvent(node, 'BIRT'),
  death: deriveDatedEvent(node, 'DEAT'),
  parents: deriveParents(node, ctx),
  spouses: sc.spouses,
  children: sc.children,
  residences: deriveResidences(node),
  occupations: deriveOccupations(node),
  sources: deriveSources(node),
};
```

- [ ] **Step 5: Run, tests pass**

- [ ] **Step 6: Commit**

```bash
git add core/src/gedcom/derive.ts core/test/gedcom/derive.test.ts core/test/gedcom/fixtures/multi-event.ged
git commit -m "feat: derive residences, occupations, source citations"
```

---

## Phase 3 — Snapshots manifest

### Task 8: Snapshots reader/writer

**Files:**
- Create: `core/src/gedcom/snapshots.ts`
- Create: `core/test/gedcom/snapshots.test.ts`

The Plan B converter (`tools/wikitext-to-md/src/gedcom-snapshot.ts`) already wrote `~/whoami/genealogy/snapshots.yml` once during migration. Plan D reads/writes the same format unchanged — recite uses date-based git lookup to find each entry's commit rather than recording a SHA in the manifest, so the existing Plan B entry is forward-compatible without modification.

- [ ] **Step 1: Failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readManifest, appendSnapshot } from '../../src/gedcom/snapshots.ts';

test('readManifest: returns empty array when file does not exist', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    assert.deepEqual(await readManifest(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readManifest: parses existing manifest', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    writeFileSync(join(dir, 'snapshots.yml'),
      `- hash: aaaa\n  date: '2026-01-01T00:00:00Z'\n  file: x.ged\n  notes: first\n`);
    const m = await readManifest(dir);
    assert.equal(m.length, 1);
    assert.equal(m[0]!.hash, 'aaaa');
    assert.equal(m[0]!.notes, 'first');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendSnapshot: appends new entry, preserves existing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    await appendSnapshot(dir, { hash: 'aaa', date: '2026-01-01T00:00:00Z', file: 'x.ged', notes: 'first' });
    await appendSnapshot(dir, { hash: 'bbb', date: '2026-01-02T00:00:00Z', file: 'x.ged', notes: 'second' });
    const m = await readManifest(dir);
    assert.equal(m.length, 2);
    assert.equal(m[0]!.hash, 'aaa');
    assert.equal(m[1]!.hash, 'bbb');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendSnapshot: skips when latest entry has same hash (no-op)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    await appendSnapshot(dir, { hash: 'aaa', date: '2026-01-01T00:00:00Z', file: 'x.ged', notes: 'first' });
    const wrote = await appendSnapshot(dir, { hash: 'aaa', date: '2026-01-02T00:00:00Z', file: 'x.ged', notes: 'duplicate' });
    assert.equal(wrote, false);
    assert.equal((await readManifest(dir)).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run, expect 4 fail**

- [ ] **Step 3: Implement `core/src/gedcom/snapshots.ts`**

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { SnapshotEntry } from './types.ts';

export async function readManifest(genealogyDir: string): Promise<SnapshotEntry[]> {
  const path = join(genealogyDir, 'snapshots.yml');
  if (!existsSync(path)) return [];
  const parsed = yaml.load(readFileSync(path, 'utf-8'));
  if (!Array.isArray(parsed)) return [];
  return parsed as SnapshotEntry[];
}

/**
 * Append a snapshot entry. If the latest existing entry already has the same
 * hash, this is a no-op and returns false (the .ged hasn't changed).
 */
export async function appendSnapshot(
  genealogyDir: string,
  entry: SnapshotEntry,
): Promise<boolean> {
  const existing = await readManifest(genealogyDir);
  const last = existing[existing.length - 1];
  if (last && last.hash === entry.hash) return false;
  const out = [...existing, entry];
  writeFileSync(join(genealogyDir, 'snapshots.yml'), yaml.dump(out, { lineWidth: 200 }));
  return true;
}

export async function latestSnapshot(genealogyDir: string): Promise<SnapshotEntry | null> {
  const m = await readManifest(genealogyDir);
  return m[m.length - 1] ?? null;
}
```

- [ ] **Step 4: Run, tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/snapshots.ts core/test/gedcom/snapshots.test.ts
git commit -m "feat: snapshots manifest reader/appender (no-op on duplicate hash)"
```

---

## Phase 4 — Sync

### Task 9: Hash + write a derived YAML file

**Files:**
- Modify: `core/src/gedcom/derive.ts`
- Modify: `core/test/gedcom/derive.test.ts`

- [ ] **Step 1: Failing tests**

Append to `derive.test.ts`:

```ts
import { mkdtempSync, rmSync, readFileSync as fsReadSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { writeDerivedYaml, hashGedcomFile } from '../../src/gedcom/derive.ts';

test('writeDerivedYaml: writes a stable YAML file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'derived-'));
  try {
    const result = await parseGedcomFile(FIX('tiny.ged'));
    const derived = deriveIndividual(result.individuals.get('I1')!, 'I1', result);
    const path = await writeDerivedYaml(dir, derived);
    const round1 = fsReadSync(path, 'utf-8');
    await writeDerivedYaml(dir, derived);
    const round2 = fsReadSync(path, 'utf-8');
    assert.equal(round1, round2);
    assert.match(round1, /record: I1/);
    assert.match(round1, /name: John Doe/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashGedcomFile: returns 64-char hex digest', async () => {
  const hash = await hashGedcomFile(FIX('tiny.ged'));
  assert.match(hash, /^[0-9a-f]{64}$/);
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Add to `derive.ts`**

```ts
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import yaml from 'js-yaml';

export async function writeDerivedYaml(derivedDir: string, derived: DerivedRecord): Promise<string> {
  mkdirSync(derivedDir, { recursive: true });
  const path = join(derivedDir, `${derived.record}.yml`);
  // sortKeys for stable output across runs
  const text = yaml.dump(derived, { lineWidth: 200, sortKeys: false, noRefs: true });
  writeFileSync(path, text);
  return path;
}

export async function hashGedcomFile(path: string): Promise<string> {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
```

- [ ] **Step 4: Run, tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/derive.ts core/test/gedcom/derive.test.ts
git commit -m "feat: writeDerivedYaml and hashGedcomFile helpers"
```

---

### Task 10: `syncGedcom` — first run

**Files:**
- Create: `core/src/gedcom/sync.ts`
- Create: `core/test/gedcom/sync.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { simpleGit } from 'simple-git';
import { syncGedcom } from '../../src/gedcom/sync.ts';
import { readManifest } from '../../src/gedcom/snapshots.ts';

const FIX = (n: string) => join(import.meta.dirname, 'fixtures', n);

async function makeGenealogyRepo(): Promise<{ root: string; cleanup: () => void }> {
  const root = mkdtempSync(join(tmpdir(), 'sync-'));
  mkdirSync(join(root, 'genealogy'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '');
  const git = simpleGit(root);
  await git.init();
  await git.addConfig('user.name', 'Test');
  await git.addConfig('user.email', 'test@example.com');
  await git.add('.gitignore');
  await git.commit('initial');
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('syncGedcom: first run writes derived/, snapshot, and a commit', async () => {
  const { root, cleanup } = await makeGenealogyRepo();
  try {
    const gedDest = join(root, 'genealogy', 'tiny.ged');
    copyFileSync(FIX('tiny.ged'), gedDest);
    const result = await syncGedcom({
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      gedFile: 'tiny.ged',
      author: { name: 'Test', email: 'test@example.com' },
      notes: 'first sync',
    });
    if (result.kind !== 'wrote') throw new Error('expected wrote');
    assert.equal(result.diff.added.length, 3);   // I1, I2, I3
    assert.equal(result.diff.changed.length, 0);
    assert.equal(result.diff.removed.length, 0);
    assert.match(result.commit, /^[0-9a-f]{40}$/);
    assert.match(result.snapshot.hash, /^[0-9a-f]{64}$/);

    const derivedFiles = readdirSync(join(root, 'genealogy', 'derived'));
    assert.deepEqual(derivedFiles.sort(), ['I1.yml', 'I2.yml', 'I3.yml']);

    const manifest = await readManifest(join(root, 'genealogy'));
    assert.equal(manifest.length, 1);
    assert.equal(manifest[0]!.hash, result.snapshot.hash);
  } finally {
    cleanup();
  }
});

test('syncGedcom: second run with same .ged is a no-op', async () => {
  const { root, cleanup } = await makeGenealogyRepo();
  try {
    copyFileSync(FIX('tiny.ged'), join(root, 'genealogy', 'tiny.ged'));
    const cfg = {
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      gedFile: 'tiny.ged',
      author: { name: 'Test', email: 'test@example.com' },
      notes: 'sync',
    };
    await syncGedcom(cfg);
    const second = await syncGedcom(cfg);
    assert.equal(second.kind, 'no-op');
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Implement `core/src/gedcom/sync.ts`**

```ts
import { existsSync, readdirSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import yaml from 'js-yaml';
import type { DerivedRecord, SyncDiff, SnapshotEntry } from './types.ts';
import type { AuthorIdentity } from '../pages/types.ts';
import { parseGedcomFile } from './parser.ts';
import { deriveIndividual, writeDerivedYaml, hashGedcomFile } from './derive.ts';
import { appendSnapshot, latestSnapshot } from './snapshots.ts';

export interface SyncConfig {
  repoRoot: string;
  genealogyDir: string;          // typically `${repoRoot}/genealogy`
  gedFile: string;               // basename inside genealogyDir
  author: AuthorIdentity;
  notes: string;
}

export type SyncResult =
  | {
      kind: 'wrote';
      diff: SyncDiff;
      commit: string;
      snapshot: SnapshotEntry;
    }
  | {
      kind: 'no-op';
      reason: 'unchanged-hash';
    };

export async function syncGedcom(cfg: SyncConfig): Promise<SyncResult> {
  const gedPath = join(cfg.genealogyDir, cfg.gedFile);
  const hash = await hashGedcomFile(gedPath);
  const last = await latestSnapshot(cfg.genealogyDir);
  if (last && last.hash === hash) {
    return { kind: 'no-op', reason: 'unchanged-hash' };
  }

  const parsed = await parseGedcomFile(gedPath);
  const derivedDir = join(cfg.genealogyDir, 'derived');

  // Read existing derived/ (if any) for diff
  const existing = new Map<string, string>();   // record id → on-disk text
  if (existsSync(derivedDir)) {
    for (const entry of readdirSync(derivedDir)) {
      if (!entry.endsWith('.yml')) continue;
      existing.set(basename(entry, '.yml'), readFileSync(join(derivedDir, entry), 'utf-8'));
    }
  }

  // Derive every individual; track diff against on-disk state
  const diff: SyncDiff = { added: [], changed: [], removed: [] };
  const newDerived = new Map<string, DerivedRecord>();
  for (const [record, node] of parsed.individuals) {
    newDerived.set(record, deriveIndividual(node, record, parsed));
  }

  for (const [record, derived] of newDerived) {
    const newText = yaml.dump(derived, { lineWidth: 200, noRefs: true });
    const oldText = existing.get(record);
    if (oldText === undefined) diff.added.push(record);
    else if (oldText !== newText) diff.changed.push(record);
  }
  for (const record of existing.keys()) {
    if (!newDerived.has(record)) diff.removed.push(record);
  }

  // Write all derived files; remove obsolete ones from disk
  mkdirSync(derivedDir, { recursive: true });
  for (const [, derived] of newDerived) {
    await writeDerivedYaml(derivedDir, derived);
  }
  for (const removed of diff.removed) {
    const path = join(derivedDir, `${removed}.yml`);
    if (existsSync(path)) unlinkSync(path);
  }

  // Append snapshot manifest entry. Identification by date (no commit SHA
  // recorded — recite finds the commit via git log on the date).
  const entry: SnapshotEntry = {
    hash,
    date: new Date().toISOString(),
    file: cfg.gedFile,
    notes: cfg.notes,
  };
  await appendSnapshot(cfg.genealogyDir, entry);

  // Single commit. Use `add -A` on derivedDir + explicit paths so deletions
  // are staged correctly (plain `git add <dir>` doesn't stage deletions).
  const git = simpleGit(cfg.repoRoot);
  await git.raw(['add', '-A', derivedDir]);
  await git.add([join(cfg.genealogyDir, 'snapshots.yml'), gedPath]);
  const result = await git.commit(`gedcom: sync ${cfg.gedFile} (${cfg.notes})`, undefined, {
    '--author': `${cfg.author.name} <${cfg.author.email}>`,
  });

  return {
    kind: 'wrote',
    diff,
    commit: result.commit,
    snapshot: entry,
  };
}
```

Two important changes from the first draft:
1. **Deletions are staged correctly** via `git add -A <derivedDir>` (plain `git add <dir>` only stages adds and modifications).
2. **No `--amend` dance.** The snapshot manifest no longer carries the commit SHA — `recite` looks up the commit by `date` instead. Single commit per sync.

- [ ] **Step 4: Run, tests pass**


- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/sync.ts core/test/gedcom/sync.test.ts
git commit -m "feat: syncGedcom — parse + derive + diff + commit + snapshot"
```

---

### Task 11: `syncGedcom` — change detection

**Files:**
- Modify: `core/test/gedcom/sync.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
test('syncGedcom: detects added record', async () => {
  const { root, cleanup } = await makeGenealogyRepo();
  try {
    const gedPath = join(root, 'genealogy', 'tiny.ged');
    copyFileSync(FIX('tiny.ged'), gedPath);
    const cfg = {
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      gedFile: 'tiny.ged',
      author: { name: 'Test', email: 'test@example.com' },
      notes: 'sync',
    };
    await syncGedcom(cfg);

    // Append a new individual to the .ged
    const text = readFileSync(gedPath, 'utf-8').replace(
      '0 TRLR',
      '0 @I4@ INDI\n1 NAME New /Person/\n0 TRLR',
    );
    writeFileSync(gedPath, text);

    const second = await syncGedcom(cfg);
    if (second.kind !== 'wrote') throw new Error('expected wrote');
    assert.deepEqual(second.diff.added, ['I4']);
    assert.equal(second.diff.changed.length, 0);
    assert.equal(second.diff.removed.length, 0);
  } finally {
    cleanup();
  }
});

test('syncGedcom: detects changed record', async () => {
  const { root, cleanup } = await makeGenealogyRepo();
  try {
    const gedPath = join(root, 'genealogy', 'tiny.ged');
    copyFileSync(FIX('tiny.ged'), gedPath);
    const cfg = {
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      gedFile: 'tiny.ged',
      author: { name: 'Test', email: 'test@example.com' },
      notes: 'sync',
    };
    await syncGedcom(cfg);

    // Change John's birth place
    const text = readFileSync(gedPath, 'utf-8').replace(
      'Pittsburgh, PA, USA',
      'Cleveland, OH, USA',
    );
    writeFileSync(gedPath, text);

    const second = await syncGedcom(cfg);
    if (second.kind !== 'wrote') throw new Error('expected wrote');
    // I1 has birth.place changed; I3 also has birth.place changed (his FAMC parent's name same, but FAM record's MARR PLAC changed if it appeared)
    // For tiny.ged, only I1 has Pittsburgh in BIRT; the FAM has Pittsburgh in MARR PLAC.
    // Since we don't include marriage place in DerivedRecord, only I1 should change.
    assert.ok(second.diff.changed.includes('I1'));
    assert.equal(second.diff.added.length, 0);
    assert.equal(second.diff.removed.length, 0);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run, expect tests pass (sync already detects added/changed correctly)**

If they don't pass, debug the diff logic — the most common issue is YAML serialization producing different whitespace between identical-meaning data.

- [ ] **Step 3: Commit**

```bash
git add core/test/gedcom/sync.test.ts
git commit -m "test: syncGedcom detects added and changed records"
```

---

## Phase 5 — Recite

### Task 12: `reciteDrift` — basic walk

**Files:**
- Create: `core/src/gedcom/recite.ts`
- Create: `core/test/gedcom/recite.test.ts`

`recite` walks `pages/` for any `.md` whose `gedcom.snapshot` is older than the latest snapshot's hash. For each match, it computes the changed fields by `git show <old-commit>:genealogy/derived/<record>.yml` and diffing against the on-disk current `derived/<record>.yml`.

- [ ] **Step 1: Failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { simpleGit } from 'simple-git';
import { syncGedcom } from '../../src/gedcom/sync.ts';
import { reciteDrift } from '../../src/gedcom/recite.ts';

const FIX = (n: string) => join(import.meta.dirname, 'fixtures', n);

async function setupRepoWithFirstSync() {
  const root = mkdtempSync(join(tmpdir(), 'recite-'));
  mkdirSync(join(root, 'genealogy'));
  mkdirSync(join(root, 'pages'));
  writeFileSync(join(root, '.gitignore'), '');
  const git = simpleGit(root);
  await git.init();
  await git.addConfig('user.name', 'Test');
  await git.addConfig('user.email', 'test@example.com');
  await git.add('.gitignore');
  await git.commit('initial');
  copyFileSync(FIX('tiny.ged'), join(root, 'genealogy', 'tiny.ged'));
  const first = await syncGedcom({
    repoRoot: root, genealogyDir: join(root, 'genealogy'),
    gedFile: 'tiny.ged', author: { name: 'Test', email: 'test@example.com' },
    notes: 'first',
  });
  if (first.kind !== 'wrote') throw new Error('expected wrote');
  return { root, firstHash: first.snapshot.hash, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('reciteDrift: returns empty when no pages reference outdated snapshot', async () => {
  const { root, cleanup } = await setupRepoWithFirstSync();
  try {
    const drift = await reciteDrift({
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      pagesDir: join(root, 'pages'),
    });
    assert.deepEqual(drift, []);
  } finally { cleanup(); }
});

test('reciteDrift: detects a page citing a stale snapshot', async () => {
  const { root, firstHash, cleanup } = await setupRepoWithFirstSync();
  try {
    // Add a page pinned to firstHash
    writeFileSync(join(root, 'pages', 'john.md'), `---
title: John Doe
owner: test
editors: []
type: person
aliases: []
categories: []
gedcom:
  file: tiny.ged
  record: I1
  snapshot: ${firstHash}
created: 2026-01-01
---

Body.
`);
    const git = simpleGit(root);
    await git.add(['pages/john.md']);
    await git.commit('add john', undefined, { '--author': 'Test <test@example.com>' });

    // Mutate the .ged so a sync produces a new snapshot
    const gedPath = join(root, 'genealogy', 'tiny.ged');
    writeFileSync(gedPath, readFileSync(gedPath, 'utf-8').replace('Pittsburgh, PA, USA', 'Cleveland, OH, USA'));
    await syncGedcom({
      repoRoot: root, genealogyDir: join(root, 'genealogy'),
      gedFile: 'tiny.ged', author: { name: 'Test', email: 'test@example.com' },
      notes: 'second',
    });

    const drift = await reciteDrift({
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      pagesDir: join(root, 'pages'),
    });
    assert.equal(drift.length, 1);
    assert.equal(drift[0]!.slug, 'john');
    assert.equal(drift[0]!.record, 'I1');
    assert.equal(drift[0]!.citedSnapshot, firstHash);
    assert.ok(drift[0]!.changedFields.includes('birth'));
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run, expect 2 fail**

- [ ] **Step 3: Implement `core/src/gedcom/recite.ts`**

```ts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { ReciteEntry, DerivedRecord, SnapshotEntry } from './types.ts';
import { latestSnapshot, readManifest } from './snapshots.ts';

export interface ReciteConfig {
  repoRoot: string;
  genealogyDir: string;
  pagesDir: string;
}

/**
 * Walk every page that pins a `gedcom.snapshot` older than the latest manifest
 * hash and report which fields drifted. Looks up the commit corresponding to a
 * cited snapshot by date (`git log --before=<date+1s> -n1 -- snapshots.yml`)
 * — avoids needing a commit SHA in the manifest.
 *
 * Pre-Plan-D snapshots (e.g. the Plan B migration import) resolve to their
 * import commit, where `genealogy/derived/` doesn't exist yet. recite
 * detects this (record file missing at cited commit) and reports the drift
 * as "all fields different" so the user can `applyRecite` to clean up.
 */
export async function reciteDrift(cfg: ReciteConfig): Promise<ReciteEntry[]> {
  const latest = await latestSnapshot(cfg.genealogyDir);
  if (!latest) return [];
  const manifest = await readManifest(cfg.genealogyDir);
  const byHash = new Map(manifest.map(s => [s.hash, s] as const));
  const out: ReciteEntry[] = [];
  const git = simpleGit(cfg.repoRoot);

  for (const file of walkPages(cfg.pagesDir)) {
    const slug = basename(file).replace(/\.md$/, '');
    const text = readFileSync(file, 'utf-8');
    const fm = matter(text);
    const ged = (fm.data as Record<string, unknown>).gedcom as
      | { file?: string; record?: string; snapshot?: string }
      | undefined;
    if (!ged?.snapshot || !ged.record) continue;
    if (ged.snapshot === latest.hash) continue;

    const cited = byHash.get(ged.snapshot);
    if (!cited) continue;   // unknown hash; nothing to compare against

    const oldDerived = await loadDerivedAt(git, cited, ged.record);
    const currentPath = join(cfg.genealogyDir, 'derived', `${ged.record}.yml`);
    if (!existsSync(currentPath)) continue;
    const currentDerived = yaml.load(readFileSync(currentPath, 'utf-8')) as DerivedRecord;

    const changedFields = diffFields(oldDerived, currentDerived);
    if (changedFields.length > 0) {
      out.push({
        slug,
        record: ged.record,
        citedSnapshot: ged.snapshot,
        latestSnapshot: latest.hash,
        changedFields,
      });
    }
  }
  return out;
}

/**
 * Find the commit that contained the cited snapshot's manifest entry, then
 * read the derived YAML at that commit. Uses date-based lookup: the commit
 * that touched `snapshots.yml` at-or-before the cited snapshot's date is the
 * one that introduced the entry.
 */
async function loadDerivedAt(
  git: ReturnType<typeof simpleGit>,
  cited: SnapshotEntry,
  record: string,
): Promise<DerivedRecord | null> {
  // Find the commit whose author-date is <= cited.date and which touched
  // genealogy/snapshots.yml. Add a 5-second epsilon to absorb clock skew
  // and within-second commit ordering.
  const before = new Date(new Date(cited.date).getTime() + 5_000).toISOString();
  let sha: string | null = null;
  try {
    const out = await git.raw([
      'log',
      `--before=${before}`,
      '-n', '1',
      '--format=%H',
      '--',
      'genealogy/snapshots.yml',
    ]);
    sha = out.trim() || null;
  } catch { return null; }
  if (!sha) return null;

  try {
    const oldText = await git.show([`${sha}:genealogy/derived/${record}.yml`]);
    return yaml.load(oldText) as DerivedRecord;
  } catch {
    return null;       // file didn't exist at that commit (e.g. pre-Plan-D snapshot)
  }
}

function walkPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.md')) continue;
    out.push(join(dir, entry.name));
  }
  return out;
}

function diffFields(a: DerivedRecord | null, b: DerivedRecord): string[] {
  if (!a) {
    // Pre-Plan-D snapshot, or the record didn't exist at the cited point.
    // Caller should treat this as "all fields different — re-pin via applyRecite".
    return ['(record was not in derived/ at cited snapshot — treat as fully drifted)'];
  }
  const fields: (keyof DerivedRecord)[] = [
    'name', 'birth', 'death', 'parents', 'spouses', 'children',
    'residences', 'occupations', 'sources',
  ];
  return fields.filter(f => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
}
```

- [ ] **Step 4: Run, expect tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/recite.ts core/test/gedcom/recite.test.ts
git commit -m "feat: reciteDrift walks pages, diffs cited vs current via git"
```

---

### Task 13: `applyRecite` — advance pinned snapshots

**Files:**
- Modify: `core/src/gedcom/recite.ts`
- Modify: `core/test/gedcom/recite.test.ts`

- [ ] **Step 1: Failing test**

Append to `recite.test.ts`:

```ts
import { applyRecite } from '../../src/gedcom/recite.ts';

test('applyRecite: rewrites gedcom.snapshot in matching pages', async () => {
  const { root, firstHash, cleanup } = await setupRepoWithFirstSync();
  try {
    writeFileSync(join(root, 'pages', 'john.md'), `---
title: John Doe
owner: test
editors: []
type: person
aliases: []
categories: []
gedcom:
  file: tiny.ged
  record: I1
  snapshot: ${firstHash}
created: 2026-01-01
---

Body.
`);
    const git = simpleGit(root);
    await git.add(['pages/john.md']);
    await git.commit('add john', undefined, { '--author': 'Test <test@example.com>' });

    const gedPath = join(root, 'genealogy', 'tiny.ged');
    writeFileSync(gedPath, readFileSync(gedPath, 'utf-8').replace('Pittsburgh, PA, USA', 'Cleveland, OH, USA'));
    const second = await syncGedcom({
      repoRoot: root, genealogyDir: join(root, 'genealogy'),
      gedFile: 'tiny.ged', author: { name: 'Test', email: 'test@example.com' },
      notes: 'second',
    });
    if (second.kind !== 'wrote') throw new Error('expected wrote');

    await applyRecite({
      repoRoot: root,
      genealogyDir: join(root, 'genealogy'),
      pagesDir: join(root, 'pages'),
      author: { name: 'Test', email: 'test@example.com' },
    });

    const updated = readFileSync(join(root, 'pages', 'john.md'), 'utf-8');
    assert.match(updated, new RegExp(`snapshot: ${second.snapshot.hash}`));
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run, expect 1 fail**

- [ ] **Step 3: Implement `applyRecite` in `recite.ts`**

```ts
import { writeFileSync } from 'node:fs';
import type { AuthorIdentity } from '../pages/types.ts';

export interface ApplyReciteConfig extends ReciteConfig {
  author: AuthorIdentity;
}

// Matches the `snapshot:` line inside a `gedcom:` block (object form). Capture
// group 1 is the prefix (everything up to and including "snapshot: "); group 2
// is the existing hash. We replace ONLY the hash, preserving every other
// formatting choice the original page made (quote style, key order, etc.).
const SNAPSHOT_LINE_RE = /(^gedcom:\s*\n(?:[^\S\n]+[^\n]*\n)*?[^\S\n]+snapshot:\s*)([0-9a-f]{6,})/m;

/**
 * Advance every page's gedcom.snapshot to the latest manifest hash. Does NOT
 * modify the page body or any other frontmatter field — uses a targeted regex
 * to replace just the snapshot value, so applyRecite produces a one-line diff
 * per page rather than rewriting the whole YAML block.
 *
 * Returns the slugs that were rewritten. Commits the changes in a single git
 * commit with the configured author.
 */
export async function applyRecite(cfg: ApplyReciteConfig): Promise<string[]> {
  const latest = await latestSnapshot(cfg.genealogyDir);
  if (!latest) return [];
  const updated: string[] = [];

  for (const file of walkPages(cfg.pagesDir)) {
    const text = readFileSync(file, 'utf-8');
    const m = SNAPSHOT_LINE_RE.exec(text);
    if (!m) continue;                          // page has no gedcom.snapshot
    const currentHash = m[2]!;
    if (currentHash === latest.hash) continue; // already current

    const newText = text.replace(SNAPSHOT_LINE_RE, `$1${latest.hash}`);
    if (newText === text) continue;
    writeFileSync(file, newText);
    updated.push(basename(file).replace(/\.md$/, ''));
  }

  if (updated.length === 0) return [];

  const git = simpleGit(cfg.repoRoot);
  await git.add(updated.map(s => `pages/${s}.md`));
  await git.commit(
    `gedcom: advance ${updated.length} page snapshot pointer(s) to ${latest.hash.slice(0, 12)}`,
    undefined,
    { '--author': `${cfg.author.name} <${cfg.author.email}>` },
  );
  return updated;
}
```

Why regex instead of `matter.stringify`: gray-matter's serializer uses js-yaml's defaults (different quoting, key ordering) than the manual frontmatter renderer in `tools/wikitext-to-md/` and `core/pages/frontmatter.ts`. Re-stringifying every touched page would produce a huge cosmetic diff. The regex changes only the value of `snapshot:` and leaves everything else untouched. The pattern allows for talk pages and other gedcom block layouts as long as `snapshot:` is at any indent inside `gedcom:`.

- [ ] **Step 4: Run, tests pass**

- [ ] **Step 5: Commit**

```bash
git add core/src/gedcom/recite.ts core/test/gedcom/recite.test.ts
git commit -m "feat: applyRecite advances stale snapshot pointers in pages"
```

---

### Task 14: Re-export from `core/src/gedcom/index.ts` + final core typecheck

**Files:**
- Modify: `core/src/gedcom/index.ts`

- [ ] **Step 1: Replace `core/src/gedcom/index.ts`**

```ts
export * from './types.ts';
export * from './parser.ts';
export * from './derive.ts';
export * from './snapshots.ts';
export * from './sync.ts';
export * from './recite.ts';
```

- [ ] **Step 2: Run typecheck + all tests**

```bash
cd /Users/nyetwork/dev/whoami/core
npm run typecheck
npm test
```

Expected: typecheck clean; all gedcom tests pass alongside the existing 59 from Plan C.

- [ ] **Step 3: Commit**

```bash
git add core/src/gedcom/index.ts
git commit -m "chore: re-export gedcom module surface from index"
```

---

## Phase 6 — HTTP routes

### Task 15: `POST /api/gedcom/sync` — auth-gated, returns diff

**Files:**
- Create: `frontend/app/api/gedcom/sync/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { syncGedcom } from '@core/gedcom/index.ts';
import { verifyCsrfToken } from '@core/auth/index.ts';
import { getAuthService } from '@/lib/server-services';
import { invalidateListCache } from '@/lib/server-services';
import { WHOAMI_ROOT } from '@/lib/env';

const Body = z.object({
  gedFile: z.string().regex(/^[a-z0-9._-]+\.ged$/i),
  notes: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  // CSRF + session
  const sessionId = req.cookies.get('session')?.value;
  const csrfCookie = req.cookies.get('csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (!sessionId || !csrfCookie || !csrfHeader || !verifyCsrfToken(csrfCookie, csrfHeader)) {
    return NextResponse.json({ error: 'csrf' }, { status: 403 });
  }
  const auth = getAuthService();
  const session = await auth.validateSession(sessionId);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const genealogyDir = join(WHOAMI_ROOT, 'genealogy');
  const gedPath = join(genealogyDir, parsed.data.gedFile);
  if (!existsSync(gedPath)) return NextResponse.json({ error: 'ged-not-found' }, { status: 404 });

  try {
    const result = await syncGedcom({
      repoRoot: WHOAMI_ROOT,
      genealogyDir,
      gedFile: parsed.data.gedFile,
      author: { name: session.user.username, email: `${session.user.username}@local` },
      notes: parsed.data.notes,
    });
    invalidateListCache();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'sync-failed', detail: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

Start dev server (port 3001 to avoid wiki-preview), log in as `steven`, hit the endpoint:

```bash
cd /Users/nyetwork/dev/whoami/frontend
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
sleep 6
LOGIN=$(curl -s -X POST http://localhost:3001/api/login -H 'content-type: application/json' -d '{"username":"steven","password":"hunter2"}' -c /tmp/c.txt)
CSRF=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrf'])")

# First call — runs sync (or returns no-op since the .ged was already imported in Plan B)
curl -s -X POST http://localhost:3001/api/gedcom/sync \
  -b /tmp/c.txt -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"gedFile":"barash-tree.ged","notes":"plan-d first sync"}' | head -c 500
```

Expected: a JSON response. If `kind: 'no-op'`, the .ged hash matches the existing snapshot from Plan B — that's fine. If `kind: 'wrote'`, we got real derived/ files. Check `~/whoami/genealogy/derived/`:

```bash
ls $HOME/whoami/genealogy/derived/ | head -10
```

Expected: directory exists with `I*.yml` files (≈210 individuals from the Barash tree, per the family-tree page header).

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add frontend/app/api/gedcom/sync/route.ts
git commit -m "feat: POST /api/gedcom/sync (auth-gated)"
```

---

### Task 16: `GET /api/gedcom/recite` — drift report

**Files:**
- Create: `frontend/app/api/gedcom/recite/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { z } from 'zod';
import { reciteDrift, applyRecite } from '@core/gedcom/index.ts';
import { verifyCsrfToken } from '@core/auth/index.ts';
import { getAuthService, invalidateListCache } from '@/lib/server-services';
import { WHOAMI_ROOT, PAGES_DIR } from '@/lib/env';

async function gateRequest(req: NextRequest) {
  const sessionId = req.cookies.get('session')?.value;
  const csrfCookie = req.cookies.get('csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (req.method !== 'GET') {
    if (!sessionId || !csrfCookie || !csrfHeader || !verifyCsrfToken(csrfCookie, csrfHeader)) {
      return NextResponse.json({ error: 'csrf' }, { status: 403 });
    }
  } else if (!sessionId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const auth = getAuthService();
  const session = sessionId ? await auth.validateSession(sessionId) : null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return session;
}

export async function GET(req: NextRequest) {
  const session = await gateRequest(req);
  if (session instanceof NextResponse) return session;

  const drift = await reciteDrift({
    repoRoot: WHOAMI_ROOT,
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
    pagesDir: PAGES_DIR,
  });
  return NextResponse.json({ drift });
}

const ApplyBody = z.object({ apply: z.literal(true) });

export async function POST(req: NextRequest) {
  const session = await gateRequest(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  const parsed = ApplyBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const updated = await applyRecite({
    repoRoot: WHOAMI_ROOT,
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
    pagesDir: PAGES_DIR,
    author: { name: session.user.username, email: `${session.user.username}@local` },
  });
  invalidateListCache();
  return NextResponse.json({ updated });
}
```

- [ ] **Step 2: Verify**

```bash
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
sleep 6
curl -s -X POST http://localhost:3001/api/login -H 'content-type: application/json' \
  -d '{"username":"steven","password":"hunter2"}' -c /tmp/c.txt > /tmp/login.json
CSRF=$(python3 -c "import json;print(json.load(open('/tmp/login.json'))['csrf'])")

# GET — drift report (likely empty if .ged hasn't changed since Plan B import)
curl -s -b /tmp/c.txt http://localhost:3001/api/gedcom/recite
```

Expected: `{"drift":[]}` if the `.ged` hash matches the only snapshot, or a list of records if a sync happened in Task 15 and pages still cite the old hash.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/gedcom/recite/route.ts
git commit -m "feat: GET/POST /api/gedcom/recite (drift report + apply)"
```

---

## Phase 7 — Real-data validation

### Task 17: Run sync against the real `.ged` and inspect

**Files:** none (verification only)

- [ ] **Step 1: Run the sync against the real Barash tree**

```bash
cd /Users/nyetwork/dev/whoami/frontend
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
sleep 6
LOGIN=$(curl -s -X POST http://localhost:3001/api/login -H 'content-type: application/json' -d '{"username":"steven","password":"hunter2"}' -c /tmp/c.txt)
CSRF=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrf'])")
curl -s -X POST http://localhost:3001/api/gedcom/sync \
  -b /tmp/c.txt -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"gedFile":"barash-tree.ged","notes":"plan-d initial sync"}' \
  | python3 -m json.tool | head -20
```

Expected output (one of):
- `{"kind": "wrote", "diff": {"added": [<210 ids>], "changed": [], "removed": []}, "commit": "<sha>", ...}` — first sync creating derived/
- `{"kind": "no-op", "reason": "unchanged-hash"}` — .ged matches existing snapshot

- [ ] **Step 2: Inspect a derived file**

```bash
ls $HOME/whoami/genealogy/derived/ | wc -l
cat $HOME/whoami/genealogy/derived/I28906361734.yml
```

Expected: ≥200 files; `I28906361734.yml` is Abby Rickelman's record with `name: Abby Rickelman`, parents, etc.

Kill dev server.

- [ ] **Step 3: Confirm the wiki page renders the same way as before**

```bash
WHOAMI_ROOT=$HOME/whoami PORT=3001 npm run dev > /tmp/next.out 2>&1 &
sleep 6
curl -s http://localhost:3001/abby-rickelman | grep -c 'class="directive directive-infobox-person"'
kill %1 2>/dev/null; wait 2>/dev/null || true
```

Expected: 1 (the page still renders; structural data isn't yet plumbed into the render — that's Plan E/F).

- [ ] **Step 4: No commit** — purely validation. The sync's git commit (in `~/whoami/.git`) is the artifact.

---

## Self-Review Checklist

After all 17 tasks complete:

1. **Spec coverage**
   - GEDCOM 5.5.1 UTF-8 only; ANSEL/7.0 rejected ✓ (Task 3)
   - Sync writes `derived/<record>.yml` per individual ✓ (Tasks 4–10)
   - Snapshots manifest with hash + ISO date + commit SHA ✓ (Tasks 8, 10)
   - `applyRecite` advances `gedcom.snapshot` in pages without touching narrative ✓ (Task 13)
   - Sync runs as a single git commit ✓ (Task 10)
   - Recite is deterministic via `git show <commit>:genealogy/derived/<record>.yml` ✓ (Task 12)

2. **Placeholder scan** — no TBDs / TODOs / "fill in" in the plan.

3. **Type consistency** — `DerivedRecord`, `SnapshotEntry`, `SyncDiff`, `ReciteEntry` defined once in `types.ts`; same shape used across parser/derive/sync/recite tests.

---

## Definition of Done

- All 17 tasks complete; `core/` tests pass (`cd core && npm test` — ~75 tests including Plan C's 59).
- `frontend/` builds cleanly (`npm run build`).
- `WHOAMI_ROOT=$HOME/whoami npm run dev` exposes:
  - `POST /api/gedcom/sync` (auth-gated) — performs sync, returns diff+snapshot
  - `GET /api/gedcom/recite` (auth-gated) — drift report
  - `POST /api/gedcom/recite` (auth+CSRF) — applies pointer advance
- Real-data sync against `~/whoami/genealogy/barash-tree.ged` writes ~210 `derived/I*.yml` files and a `gedcom: sync …` commit on `~/whoami/.git`.
- Branch `migration-spec` has ~17 new commits on top of Plan C.
- Plan E (search + render + assets) can now reuse `derived/<record>.yml` to enrich Infobox renders.
