# Eval Graders + Runner Implementation Plan (Plan H2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eval suite functional end-to-end against the new markdown wiki. Build on Plan H2a's foundation (`startWiki()` harness + `parsePageContent()` parser + updated skills/agents). Rewrite the format-specific graders (`citations`, `citation-resolver`, `completeness`, `reference`, `accuracy`) to consume markdown directives + frontmatter; refresh the LLM-rubric graders' prompts to say "markdown"; rewrite `runner/e2e.ts` to drive the new wiki via the bundled `wai` CLI; and add the spec's new integration tests (XSS / slug rejection / GEDCOM sync+recite / atomic write / performance budgets).

**Architecture:** Each format-specific grader's `parseX(wikitext)` regex is replaced with a parser that consumes `parsePageContent(md): ParsedPage` (directives + headings + wikilinks) plus `gray-matter` for frontmatter. Grader signatures change `wikitext: string` → `body: string` (the markdown body) but remain otherwise compatible. The runner switches from MW API + `php maintenance/run.php edit` calls to `writePageDirect(vault, slug, body, meta)` for seeding and `wai` CLI for agent-driven writes. Integration tests live alongside the H2a `harness.test.ts` under `evals/test/integration/`.

**Directive shape convention (important):** remark-directive only accepts two forms — leaf `::name{attrs}` (single colon-pair, single line, no body) and container `:::name{attrs}\n…body…\n:::` (triple colons, body and close on subsequent lines). The one-line `:::name{...}:::` form that appeared in the Plan F1 conversion table is **not valid syntax** — it parses to zero directives. This plan standardizes on **leaf** for citations (`::cite-vault{...}`) since they have no body, and **container** for infoboxes (`:::infobox-person\n…\n:::`) and admonitions with prose. Footnote-definition bodies are opaque to remark-directive — citations must live as leaf directives in the page body, not nested inside `[^id]: …` blocks.

**Tech Stack:** Node `node:test`, `tsx`, the existing `parsePageContent` from H2a, `gray-matter` (already in evals from H2a), the bundled `wai` CLI (`cli/dist/wai.cjs`). Tests `fetch()` the API directly or `execSync` the CLI. No new deps.

**Reference spec:** `docs/superpowers/specs/2026-05-01-family-wiki-migration-design.md` — Phase 5 ("Eval rewrite") and the Verification list.

## Data-safety constraints

- **Never** modify `~/Library/Application Support/whoami/data/wiki.sqlite` (legacy MediaWiki DB).
- Each integration test gets a fresh per-test temp vault via `startWiki()` (H2a). The user's real `~/whoami/` is never touched.
- The runner rewrite must NOT delete or modify pages outside the test's temp vault.

## Out of scope

- **Login rate-limit / CSRF / frontmatter trust boundary** evals: dropped with auth (`309619a`).
- **Backup-restore eval** (Hardening row #6 weekly automated test): Plan A.
- **New graders** beyond the existing set; only the existing graders are migrated.

---

## File Structure

```
evals/
├── src/
│   ├── graders/
│   │   ├── citations.ts                    # REWRITE: parse :::cite-* directives
│   │   ├── citation-resolver.ts            # REWRITE: consume new ParsedCitation shape
│   │   ├── completeness.ts                 # REWRITE: count words/sections from markdown
│   │   ├── reference.ts                    # REWRITE: extract markdown infobox/headings/cite hashes
│   │   ├── accuracy.ts                     # REWRITE: feed citation-resolver new shape
│   │   ├── editorial.ts                    # PATCH: rubric says "markdown" not "wikitext"
│   │   ├── tool-usage.ts                   # PATCH: drop dead `wai snapshot` check
│   │   ├── cross-ref.ts                    # KEEP (LLM rubric, format-agnostic)
│   │   ├── source-criticism.ts             # PATCH: rubric says "markdown"
│   │   ├── integration.ts                  # PATCH: rubric says "markdown"
│   │   └── index.ts                        # KEEP (composite scoring)
│   ├── llm.ts                              # PATCH: prompts say "markdown" not "wikitext"
│   └── runner/
│       └── e2e.ts                          # REWRITE: drop @ts-nocheck, drive new wiki
└── test/
    ├── citations.test.ts                   # PORT to markdown
    ├── completeness.test.ts                # PORT to markdown
    ├── reference.test.ts                   # PORT to markdown
    ├── vault.test.ts                       # PORT (uses citation-resolver)
    └── integration/
        ├── harness.test.ts                 # KEEP (H2a)
        ├── security.test.ts                # CREATE (XSS + slug)
        ├── gedcom.test.ts                  # CREATE
        ├── atomic-write.test.ts            # CREATE
        └── perf.test.ts                    # CREATE
```

---

## Phase 0 — Fix H2a collateral damage (directive syntax)

### Task 0: Repatch SKILL.md and editor.md to use valid directive shapes

**Files:**
- Modify: `plugins/whoami/skills/editorial-guide/SKILL.md`
- Modify: `plugins/whoami/agents/editor.md`

H2a's conversion table specified one-line `:::name{...}:::` for citations, which **does not parse** under remark-directive (verified empirically: produces 0 directives). Both docs were rewritten with this invalid syntax. Patch in place to use the leaf form `::cite-vault{...}` for citations.

- [ ] **Step 1: Find every invalid one-line directive in both files**

```bash
grep -nE ':::[a-z-]+\{[^}]*\}:::' /Users/nyetwork/dev/whoami/plugins/whoami/skills/editorial-guide/SKILL.md /Users/nyetwork/dev/whoami/plugins/whoami/agents/editor.md
```

- [ ] **Step 2: Replace each with the leaf form**

Pattern: `:::name{attrs}:::` → `::name{attrs}`

For example:
- `:::cite-vault{type=photo snapshot=H note="N"}:::` → `::cite-vault{type=photo snapshot=H note="N"}`
- `:::cite-message{snapshot=H date=D thread=T}:::` → `::cite-message{snapshot=H date=D thread=T}`

Container directives that have a body (e.g. `:::infobox-person\n…yaml…\n:::`, `:::blockquote{by="..."}\n…text…\n:::`, `:::dialogue{speaker="..."}\n…line…\n:::`) are **valid** and stay unchanged.

- [ ] **Step 3: Add a "Directive shapes" callout to SKILL.md**

Find the section that explains the directive system (likely after the page-types section or in the citations section). Add a short paragraph:

> **Directive syntax**: use `::name{attrs}` (single colon-pair, single line) for leaf directives that carry only attributes — citations (`::cite-vault`, `::cite-message`), admonitions (`::open`, `::closed`, `::superseded`, `::gap`). Use `:::name{attrs}` opening on its own line, body content on subsequent lines, and `:::` close on its own line for container directives that have a body — infoboxes, blockquotes, dialogue, columns-list. The one-line `:::name{...}:::` shape is invalid and won't render.

- [ ] **Step 4: Verify zero invalid one-liners remain**

```bash
grep -cE ':::[a-z-]+\{[^}]*\}:::' /Users/nyetwork/dev/whoami/plugins/whoami/skills/editorial-guide/SKILL.md /Users/nyetwork/dev/whoami/plugins/whoami/agents/editor.md
```

Expected: `0` for both.

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add plugins/whoami/skills/editorial-guide/SKILL.md plugins/whoami/agents/editor.md
git commit -m "docs: fix invalid one-line directive syntax in SKILL.md + editor.md (H2a fallout)"
```

---

## Phase 1 — Format-specific graders + their tests

### Task 1: Citations (parser + grader + resolver + tests)

**Files:**
- Replace: `evals/src/graders/citations.ts` (193 lines)
- Replace: `evals/src/graders/citation-resolver.ts` (270 lines)
- Replace: `evals/test/citations.test.ts` (120 lines)
- Replace: `evals/test/vault.test.ts` (298 lines — uses `resolveCitations`)

The original `parseCitations(wikitext)` walks `/\{\{Cite\s+(\w+)\s*\|([^}]*)\}\}/g`. New design: `parseCitations(body): ParsedCitation[]` consumes `parsePageContent(body).directives`, filters where `name.startsWith('cite-')`, normalizes the directive name to a template (`cite-vault` → `'vault'`, `cite-message` → `'message'`, etc.), and copies attrs.

**Citation shape**: leaf directive `::cite-vault{snapshot=H date=D type=T}` (single colon-pair, single line). Container `:::cite-vault{}\n…\n:::` would also parse but citations have no body. Footnote-definition bodies (`[^a]: …`) are opaque to remark-directive — citations live as standalone leaf directives in the page body, not nested in footnote defs. The convention used in Plan H2a's editorial guide and editor agent (after Task 0) is: place a footnote ref `[^a]` at the cited claim, and put the leaf directive `::cite-vault{...}` either inline next to the claim or on a separate line near it.

- [ ] **Step 1: Failing test — `evals/test/citations.test.ts` (verbatim)**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeCitations, parseCitations, findUncitedClaims } from '../src/graders/citations.js';

describe('parseCitations (markdown)', () => {
  it('parses a vault citation leaf directive', () => {
    const md = '::cite-vault{type=photo snapshot=abc123 note="From the export"}';
    const citations = parseCitations(md);
    assert.equal(citations.length, 1);
    assert.equal(citations[0]!.template, 'vault');
    assert.equal(citations[0]!.fields.type, 'photo');
    assert.equal(citations[0]!.fields.snapshot, 'abc123');
    assert.match(citations[0]!.fields.note ?? '', /export/);
  });

  it('parses a message citation', () => {
    const md = '::cite-message{snapshot=def456 date=2024-01-01 thread=Alice note="DM"}';
    const citations = parseCitations(md);
    assert.equal(citations.length, 1);
    assert.equal(citations[0]!.template, 'message');
    assert.equal(citations[0]!.fields.snapshot, 'def456');
    assert.equal(citations[0]!.fields.thread, 'Alice');
  });

  it('parses multiple citations in body', () => {
    const md = `
::cite-vault{snapshot=a date=2024-01-01 type=photo}

::cite-message{snapshot=b date=2024-02-01 thread=Bob}
`;
    const citations = parseCitations(md);
    assert.equal(citations.length, 2);
  });

  it('parses citations adjacent to claims (footnote-ref pattern)', () => {
    // Citations live in the body, not inside [^a]: blocks (those are opaque to
    // remark-directive). The convention: footnote ref next to the claim, the
    // ::cite-* directive on its own line nearby.
    const md = `
Alice was born in 1990.[^a]

::cite-vault{snapshot=H date=1990-03-15 type=record}
`;
    const citations = parseCitations(md);
    assert.equal(citations.length, 1);
    assert.equal(citations[0]!.template, 'vault');
    assert.equal(citations[0]!.fields.snapshot, 'H');
  });

  it('returns empty for no citations', () => {
    const citations = parseCitations('Just prose. [[A wikilink]]. ## A heading');
    assert.deepEqual(citations, []);
  });
});

describe('gradeCitations (markdown)', () => {
  it('full score for body with all valid citations', () => {
    const md = `
A claim.[^a]

::cite-vault{snapshot=abc date=2024-01-01 type=photo}
`;
    const result = gradeCitations(md);
    assert.equal(result.grader, 'citations');
    assert.ok(result.score > 0.9);
  });

  it('penalizes missing required fields', () => {
    const md = '::cite-vault{type=photo}';  // missing snapshot + date
    const result = gradeCitations(md);
    assert.ok(result.score < 1, 'expected score < 1 for missing fields');
  });

  it('penalizes unknown template', () => {
    const md = '::cite-bogus{snapshot=x date=2024}';
    const result = gradeCitations(md);
    assert.ok(result.score < 1, 'expected score < 1 for unknown template');
  });
});

describe('findUncitedClaims', () => {
  it('flags sentences with date-shaped claims that lack a footnote ref', () => {
    const md = 'Alice was born on March 15, 1990. She moved to Berlin in 2015.';
    const flagged = findUncitedClaims(md);
    assert.ok(flagged.length >= 1, 'should flag at least one date-bearing sentence');
  });

  it('does not flag claims that have a footnote ref', () => {
    const md = 'Alice was born on March 15, 1990.[^a]\n\n::cite-vault{snapshot=x date=1990-03-15 type=record}';
    const flagged = findUncitedClaims(md);
    assert.equal(flagged.length, 0);
  });
});
```

- [ ] **Step 2: Run, expect failures**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | grep -E '(citations|✖|fail|pass)' | head -20
```

- [ ] **Step 3: Implement `evals/src/graders/citations.ts` verbatim**

```ts
import type { GraderResult, GraderCheck } from '../types.js';
import { parsePageContent } from './parse-page.js';

const VALID_TEMPLATES = ['message', 'voice-note', 'photo', 'video', 'vault', 'testimony'];
const REQUIRED_FIELDS = ['snapshot', 'date'];
const TYPE_SPECIFIC_FIELDS: Record<string, string[]> = {
  message: ['thread'],
  'voice-note': ['speaker'],
  photo: [],
  video: [],
  vault: ['type'],
  testimony: ['speaker'],
};

export interface ParsedCitation {
  template: string;
  fields: Record<string, string>;
}

const CITE_PREFIX = 'cite-';

function templateOf(name: string): string {
  // 'cite-vault' → 'vault', 'cite-voice-note' → 'voice-note'
  return name.startsWith(CITE_PREFIX) ? name.slice(CITE_PREFIX.length) : name;
}

export function parseCitations(body: string): ParsedCitation[] {
  const parsed = parsePageContent(body);
  const out: ParsedCitation[] = [];
  for (const d of parsed.directives) {
    if (!d.name.startsWith(CITE_PREFIX)) continue;
    out.push({ template: templateOf(d.name), fields: { ...d.attrs } });
  }
  return out;
}

function validateCitation(citation: ParsedCitation): GraderCheck[] {
  const checks: GraderCheck[] = [];

  const validTemplate = VALID_TEMPLATES.includes(citation.template);
  checks.push({
    check: `Template "${citation.template}" is valid`,
    passed: validTemplate,
    penalty: validTemplate ? 0 : 0.5,
  });

  for (const f of REQUIRED_FIELDS) {
    const present = !!citation.fields[f]?.trim();
    checks.push({ check: `Has required field "${f}"`, passed: present, penalty: present ? 0 : 0.25 });
  }

  for (const f of TYPE_SPECIFIC_FIELDS[citation.template] ?? []) {
    const present = !!citation.fields[f]?.trim();
    checks.push({ check: `Has ${citation.template}-specific field "${f}"`, passed: present, penalty: present ? 0 : 0.15 });
  }

  return checks;
}

export function gradeCitations(body: string): GraderResult {
  const citations = parseCitations(body);
  const details: GraderCheck[] = [];

  if (citations.length === 0) {
    return {
      grader: 'citations',
      score: 1,
      details: [{ check: 'No citations found', passed: true, penalty: 0 }],
    };
  }

  let totalPenalty = 0;
  for (const c of citations) {
    for (const check of validateCitation(c)) {
      details.push(check);
      totalPenalty += check.penalty;
    }
  }
  const maxPenalty = citations.length * 1.0;
  const score = Math.max(0, 1 - totalPenalty / Math.max(1, maxPenalty));
  return { grader: 'citations', score: Math.round(score * 1000) / 1000, details };
}

const DATE_PATTERN = /\b(?:\d{4}|[A-Z][a-z]+ \d+,? \d{4}|in \d{4})\b/;
const FOOTNOTE_REF = /\[\^[^\]]+\]/;

/**
 * Heuristic: a sentence containing a date-shaped claim should be backed by a
 * footnote reference somewhere in or near the sentence.
 */
export function findUncitedClaims(body: string): string[] {
  const sentences = body.split(/(?<=[.!?])\s+/);
  return sentences.filter(s => DATE_PATTERN.test(s) && !FOOTNOTE_REF.test(s));
}
```

- [ ] **Step 4: Implement `evals/src/graders/citation-resolver.ts`**

Open the existing file, identify functions that consume `ParsedCitation` (the old shape used `template, fields, raw` — drop `raw`). Update signature and any callers. The vault-resolution logic (`resolveCitations` against `readManifest`/`readObject`) is format-agnostic — keep it. Just adapt the input adapter from `parseCitations` (now markdown-aware).

If the existing code references `citation.raw`, drop that — it's not in the new shape. The `findInManifest`/`readObject` calls operate on `citation.fields.snapshot` (was `citation.fields.hash` in old wikitext). The wikitext convention used `hash=`; markdown uses `snapshot=`. Update field name lookups accordingly.

For specifics, read the existing `citation-resolver.ts` and adapt in place. Don't rewrite the vault interaction logic — only the input shape adapter.

- [ ] **Step 5: Port `evals/test/vault.test.ts`**

Most of `vault.test.ts` exercises `readManifest`/`readObject`/`findInManifest`/`findAllInManifest`/`extractMessagesNearDate` from `src/vault.ts` — those are vault-storage tests, format-agnostic, **leave them alone**.

The only block that needs porting is the `describe('resolveCitations'…)` block at the bottom of the file. Identify it with:

```bash
grep -n "describe.*resolveCitations\|resolveCitations(" /Users/nyetwork/dev/whoami/evals/test/vault.test.ts | head
```

Inside that block, every fixture string of the shape `{{Cite vault|hash=H|...}}` becomes the leaf directive `::cite-vault{snapshot=H ...}`. Field name change: `hash=` → `snapshot=`. Field name change in assertions too: any `citation.fields.hash` → `citation.fields.snapshot`. The vault file path / snapshot lookup logic in `resolveCitations` itself uses `snapshot` (you've already adapted it in Step 4); the test fixtures just need to match.

- [ ] **Step 6: Run tests**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -15
```

Expected: all citations + vault tests pass. Total count grows by the new tests added.

- [ ] **Step 7: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add evals/src/graders/citations.ts evals/src/graders/citation-resolver.ts evals/test/citations.test.ts evals/test/vault.test.ts
git commit -m "feat: evals — citations + citation-resolver consume markdown directives"
```

---

### Task 2: Completeness (grader + tests)

**Files:**
- Replace: `evals/src/graders/completeness.ts` (382 lines)
- Replace: `evals/test/completeness.test.ts` (410 lines)

The grader counts: prose words, content sections (headings), infobox presence, blockquotes, dialogue blocks. All of these become directive/heading lookups via `parsePageContent`.

- [ ] **Step 1: Read both files end-to-end**

```bash
cat /Users/nyetwork/dev/whoami/evals/src/graders/completeness.ts
echo "==="
cat /Users/nyetwork/dev/whoami/evals/test/completeness.test.ts | head -80
```

- [ ] **Step 2: Translate the helper functions**

The original completeness has helpers like `countProseWords`, `countContentSections`, `hasInfobox`, `hasBlockquote`, `countDialogue`. Replacement strategy:

- `countProseWords(md)`: strip directives + footnote defs + headings + wikilinks, count remaining words.
  ```ts
  function countProseWords(md: string): number {
    let text = md;
    text = text.replace(/:::[a-z-]+(?:\{[^}]*\})?[\s\S]*?:::/g, '');
    text = text.replace(/^::[a-z-]+(?:\{[^}]*\})?\s*$/gm, '');
    text = text.replace(/^\[\^[^\]]+\]:.*$/gm, '');
    text = text.replace(/\[\^[^\]]+\]/g, '');
    text = text.replace(/^#+\s.*$/gm, '');
    text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1');
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }
  ```
- `countContentSections(md)`: use `parsePageContent(md).headings.filter(h => h.depth === 2 && !STOP_WORDS.includes(h.text.toLowerCase())).length` where STOP_WORDS = `['references', 'footnotes', 'see also', 'bibliography']`.
- `hasInfobox(md)`: `parsePageContent(md).directives.some(d => d.name === 'infobox-person' || d.name === 'infobox-company')`.
- `hasBlockquote(md)`: `parsePageContent(md).directives.some(d => d.name === 'blockquote')`.
- `countDialogue(md)`: `parsePageContent(md).directives.filter(d => d.name === 'dialogue').length`.

Keep the role-based check selection (`getChecks(role, checkpointId)`), the per-check weight scoring, and the `gradeCompleteness(body, opts): GraderResult` signature.

- [ ] **Step 3: Port `completeness.test.ts`**

The fixture pages (`FULL_PAGE`, `PARTIAL_PAGE`, etc.) use `{{Infobox Person ...}}`, `==Background==`, `'''bold'''`, `<ref>...</ref>`. Convert to markdown:
- `{{Infobox person|name=X|...}}` → `:::infobox-person\nname: X\n...\n:::`
- `==Background==` → `## Background`
- `'''bold'''` → `**bold**`
- `<ref>X</ref>` → `[^a]\n\n[^a]: X` (or just remove if the test doesn't care about the citation)
- `{{Blockquote|text|by=Person}}` → `:::blockquote{by="Person"}\ntext\n:::`
- `[[Page]]` preserved
- `[[File:photo.jpg|thumb|caption]]` → `![caption](/assets/photo.jpg)`

Adjust word-count expectations only if the markdown form has measurably different prose count than the wikitext form.

- [ ] **Step 4: Run + commit**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | grep -E '(completeness|✔|✖|pass|fail)' | head -20
cd /Users/nyetwork/dev/whoami
git add evals/src/graders/completeness.ts evals/test/completeness.test.ts
git commit -m "feat: evals — completeness grader on markdown directives + headings"
```

---

### Task 3: Reference + accuracy (graders + tests)

**Files:**
- Replace: `evals/src/graders/reference.ts` (171 lines)
- Replace: `evals/src/graders/accuracy.ts` (402 lines)
- Replace: `evals/test/reference.test.ts` (290 lines)

Reference grader extracts: headings, infobox fields, citation hashes. All from `parsePageContent`. Accuracy grader uses `citation-resolver` (Task 1) to verify each cited claim has a backing snapshot in the vault — its core logic stays; only the input shape changes.

- [ ] **Step 1: Implement `evals/src/graders/reference.ts`**

```ts
import type { GraderResult, GraderCheck, PageRole } from '../types.js';
import { parsePageContent } from './parse-page.js';
import { parseCitations } from './citations.js';

function extractHeadings(body: string): string[] {
  return parsePageContent(body)
    .headings
    .filter(h => h.depth === 2)
    .map(h => h.text.toLowerCase());
}

function extractInfoboxFields(body: string): string[] {
  const ibox = parsePageContent(body).directives.find(d => d.name.startsWith('infobox-'));
  if (!ibox?.body) return [];
  const fields: string[] = [];
  for (const line of ibox.body.split('\n')) {
    const m = line.match(/^([a-z][\w]*?)\s*:/i);
    if (m) fields.push(m[1]!.toLowerCase());
  }
  return fields;
}

function extractCitationSnapshots(body: string): string[] {
  return parseCitations(body)
    .map(c => c.fields.snapshot?.toLowerCase())
    .filter((s): s is string => !!s);
}

function gradeContentReference(body: string, ref: string): { score: number; details: GraderCheck[] } {
  const refHeadings = new Set(extractHeadings(ref));
  const bodyHeadings = new Set(extractHeadings(body));
  const refFields = new Set(extractInfoboxFields(ref));
  const bodyFields = new Set(extractInfoboxFields(body));
  const refSnapshots = new Set(extractCitationSnapshots(ref));
  const bodySnapshots = new Set(extractCitationSnapshots(body));

  const details: GraderCheck[] = [];
  const overlap = (a: Set<string>, b: Set<string>) => [...a].filter(x => b.has(x)).length;

  const headingOverlap = overlap(refHeadings, bodyHeadings) / Math.max(1, refHeadings.size);
  const fieldOverlap = overlap(refFields, bodyFields) / Math.max(1, refFields.size);
  const snapshotOverlap = overlap(refSnapshots, bodySnapshots) / Math.max(1, refSnapshots.size);

  details.push({ check: `Headings overlap with reference (${overlap(refHeadings, bodyHeadings)}/${refHeadings.size})`, passed: headingOverlap >= 0.5, penalty: 1 - headingOverlap });
  details.push({ check: `Infobox fields overlap (${overlap(refFields, bodyFields)}/${refFields.size})`, passed: fieldOverlap >= 0.5, penalty: 1 - fieldOverlap });
  details.push({ check: `Citation snapshots overlap (${overlap(refSnapshots, bodySnapshots)}/${refSnapshots.size})`, passed: snapshotOverlap >= 0.5, penalty: 1 - snapshotOverlap });

  const score = (headingOverlap + fieldOverlap + snapshotOverlap) / 3;
  return { score: Math.round(score * 1000) / 1000, details };
}

function gradeSourceReference(body: string, ref: string): { score: number; details: GraderCheck[] } {
  // Sources don't have infoboxes or citations the same way — score on heading overlap only
  const refHeadings = new Set(extractHeadings(ref));
  const bodyHeadings = new Set(extractHeadings(body));
  const overlap = [...refHeadings].filter(x => bodyHeadings.has(x)).length;
  const score = refHeadings.size > 0 ? overlap / refHeadings.size : 1;
  return {
    score: Math.round(score * 1000) / 1000,
    details: [{ check: `Source headings overlap (${overlap}/${refHeadings.size})`, passed: score >= 0.5, penalty: 1 - score }],
  };
}

export function gradeReference(body: string, referenceBody: string, role: PageRole): GraderResult {
  const { score, details } = role === 'source'
    ? gradeSourceReference(body, referenceBody)
    : gradeContentReference(body, referenceBody);
  return { grader: 'reference', score, details };
}
```

- [ ] **Step 2: Adapt `evals/src/graders/accuracy.ts`**

Read the existing file. The grader takes `(wikitext: string, context: AccuracyContext)`. Steps:
- Rename parameter `wikitext` → `body` for clarity (semantic, not breaking).
- Replace `parseCitations(wikitext)` (the old wikitext one was inline) with the imported `parseCitations(body)` from `./citations.js`.
- Wherever a citation's `hash` field was referenced, use `snapshot` instead.
- Wherever the AccuracyContext exposes a "claim" extracted from prose, ensure the prose-extraction is markdown-friendly (footnote refs `[^x]` are now the citation marker, not `<ref>` tags).
- Keep the LLM-mediated parts (`evaluateAccuracy` calls etc.) unchanged in shape — just feed them markdown bodies.

- [ ] **Step 3: Port `evals/test/reference.test.ts`**

Convert wikitext fixtures to markdown using the same table as Task 2. The reference test compares two pages — keep the comparison shape, just port both inputs.

- [ ] **Step 4: Run + commit**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -10
cd /Users/nyetwork/dev/whoami
git add evals/src/graders/reference.ts evals/src/graders/accuracy.ts evals/test/reference.test.ts
git commit -m "feat: evals — reference + accuracy graders consume markdown bodies"
```

---

## Phase 2 — Light updates (LLM-rubric graders + tool-usage)

### Task 4: Refresh LLM prompts and tool-usage checks

**Files:**
- Modify: `evals/src/llm.ts` (prompts say "wikitext" → "markdown")
- Modify: `evals/src/graders/editorial.ts` (rubric mentions wikitext)
- Modify: `evals/src/graders/source-criticism.ts` (rubric)
- Modify: `evals/src/graders/integration.ts` (rubric)
- Modify: `evals/src/graders/tool-usage.ts` (drop dead `wai snapshot` check)

These are content-format-agnostic but their prompts/check names mention "wikitext" or removed `wai` commands. Tiny patches.

- [ ] **Step 1: `evals/src/llm.ts`**

In `evaluateWithRubric`'s prompt, replace `"Evaluate this wikitext page"` → `"Evaluate this markdown page"`. Same in `extractCrossRefs` prompt. Same anywhere else "wikitext" appears in a user-facing string. Leave function signatures alone — rename the parameter from `wikitext` → `body` for clarity but keep type/order.

- [ ] **Step 2: `evals/src/graders/editorial.ts`**

The rubric string mentions wikitext. Replace "wikitext page" → "markdown page". The words-to-watch list is content-agnostic — leave alone.

- [ ] **Step 3: `evals/src/graders/source-criticism.ts` and `integration.ts`**

Same: any mention of "wikitext" in the rubric → "markdown". If the rubric mentions "templates" (MW templates), reword as "directive blocks" where appropriate.

- [ ] **Step 4: `evals/src/graders/tool-usage.ts`**

Drop the `wai snapshot` check — that command is removed. Add a `wai search` check (added in Plan E):

```ts
{
  name: 'Used wai search to find existing pages',
  test: () => /\bwai\s+search\b/.test(log),
  weight: 1,
},
```

Drop the snapshot block. Keep `wai`, `wai read`, `wai write/edit/create`.

- [ ] **Step 5: Run + commit**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -10
cd /Users/nyetwork/dev/whoami
git add evals/src/llm.ts evals/src/graders/editorial.ts evals/src/graders/source-criticism.ts evals/src/graders/integration.ts evals/src/graders/tool-usage.ts
git commit -m "chore: evals — refresh LLM rubrics + tool-usage for markdown world"
```

---

## Phase 3 — Runner

### Task 5: Rewrite `runner/e2e.ts`

**Files:**
- Modify: `evals/src/runner/e2e.ts` (1182 lines, currently `// @ts-nocheck`)

Goal: drop `@ts-nocheck`, get the runner working end-to-end against the new wiki. Pragmatic scope — the runner orchestrates harness setup → seed pages → invoke agent harness → run graders → emit result. Each piece needs a small adapter.

- [ ] **Step 1: Read the file end-to-end and identify the main flow**

```bash
cd /Users/nyetwork/dev/whoami/evals && wc -l src/runner/e2e.ts
sed -n '1,50p' src/runner/e2e.ts
```

Map the high-level functions:
- `runE2E(options)` — main entry
- discovery / phase 1 (seed source pages)
- phase 2 (agent writes content)
- phase 3 (grade)
- result emission

- [ ] **Step 2: Apply these patches systematically**

a) **Drop the `@ts-nocheck` line at the top.** Re-run `tsc --noEmit` and address each error.

b) **WikiInstance shape** — wherever `wiki.username`, `wiki.password`, `wiki.dataPath` appear, replace:
- `wiki.username` → `'eval'` (no auth)
- `wiki.password` → `''`
- `wiki.dataPath` → `wiki.vaultPath`

c) **`startWiki` call site** — old signature was `startWiki(port: number)`. New: `startWiki({ port? })`. Update call sites:
```ts
const wiki = await startWiki({ port });
```

d) **`writePageDirect` call sites** — old: `writePageDirect(confPath, title, content)`. New: `writePageDirect(vaultPath, slug, body, meta?)`. The slug should be derived from the title: import `toSlug` from `cli/src/slug.ts` style — actually, evals can't depend on cli; vendor the same `toSlug` logic locally as a helper in the runner or in `evals/src/util/slug.ts`. Implementation:

```ts
function titleToSlug(title: string): string {
  const trimmed = title.trim();
  const talk = trimmed.endsWith('.talk');
  const base = talk ? trimmed.slice(0, -5) : trimmed;
  const slug = base.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return talk ? `${slug}.talk` : slug;
}
```

Replace each `writePageDirect(wiki.dataPath, title, content)` with:
```ts
const slug = titleToSlug(title);
await writePageDirect(wiki.vaultPath, slug, content);
```

e) **Page-read code** — anywhere the runner reads a page from MediaWiki API, swap to `fetch(\`${wiki.url}/api/pages/${slug}\`)` or to `execSync` calling `wai read <slug>`.

f) **Grader invocation** — the runner passes wikitext to graders. After Tasks 1–4, graders accept markdown bodies. Make sure the body passed in is markdown (which it is, since pages are now markdown files).

g) **Talk pages** — old: separate Talk: namespace via MW API. New: `<slug>.talk` markdown files. Use `writePageDirect(wiki.vaultPath, \`${slug}.talk\`, content)`.

- [ ] **Step 3: Typecheck must be clean**

```bash
cd /Users/nyetwork/dev/whoami/evals && npx tsc --noEmit 2>&1 | tail -15
```

If errors remain, narrow them with targeted `// @ts-expect-error` markers (with a comment explaining what's broken) rather than re-applying `// @ts-nocheck`.

- [ ] **Step 4: A live smoke run is OUT OF SCOPE for this task** — the runner depends on agent harnesses (Claude Code, Codex, etc.) which need API keys and may not be runnable in CI. Verify it compiles + spawns the wiki cleanly via a minimal smoke if you have time:

```bash
cd /Users/nyetwork/dev/whoami/evals && tsx -e "import { runE2E } from './src/runner/e2e.js'; console.log(typeof runE2E);"
```

Should print `function` without throwing.

- [ ] **Step 5: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add evals/src/runner/e2e.ts
# also any new util file like evals/src/util/slug.ts
git add evals/src/util/ 2>/dev/null
git commit -m "feat: evals — rewrite runner/e2e.ts for new wiki shape (drop @ts-nocheck)"
```

---

## Phase 4 — Integration tests

### Task 6: Security (XSS + slug rejection)

**Files:**
- Create: `evals/test/integration/security.test.ts`

- [ ] **Step 1: Write the test verbatim**

```ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWiki, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;

before(async () => { wiki = await startWiki(); });
after(async () => { await wiki.destroy(); });

const XSS_BODY = `Plain prose.

<script>alert(1)</script>

<img src=x onerror="alert(2)">

[clean link](https://example.com)
`;

test('xss: <script> tags are stripped from rendered HTML', async () => {
  await fetch(`${wiki.url}/api/pages/xss-page`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: XSS_BODY, summary: 'xss seed' }),
  });
  const res = await fetch(`${wiki.url}/xss-page`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal(html.includes('<script>'), false, '<script> survived');
  assert.equal(html.includes('alert(1)'), false, 'alert(1) survived');
});

test('xss: onerror handler stripped', async () => {
  const res = await fetch(`${wiki.url}/xss-page`);
  const html = await res.text();
  assert.equal(/onerror=/i.test(html), false, 'onerror attribute survived');
  assert.equal(html.includes('alert(2)'), false, 'alert(2) survived');
});

test('xss: clean prose still renders', async () => {
  const res = await fetch(`${wiki.url}/xss-page`);
  const html = await res.text();
  assert.match(html, /Plain prose/);
  assert.match(html, /href="https:\/\/example\.com"/);
});

test('slug: uppercase rejected with 400', async () => {
  const res = await fetch(`${wiki.url}/api/pages/UPPERCASE`);
  assert.equal(res.status, 400);
});

test('slug: PUT with spaces rejected with 400', async () => {
  const res = await fetch(`${wiki.url}/api/pages/Has Space`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'x', summary: 'try' }),
  });
  assert.equal(res.status, 400);
});

test('slug: valid-shaped missing slug returns 404 not 400', async () => {
  const res = await fetch(`${wiki.url}/api/pages/does-not-exist`);
  assert.equal(res.status, 404);
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm run test:integration 2>&1 | grep -E '(xss|slug|✔|✖)' | head -20
cd /Users/nyetwork/dev/whoami
git add evals/test/integration/security.test.ts
git commit -m "test: integration eval for XSS sanitization + slug rejection"
```

---

### Task 7: GEDCOM sync + recite

**Files:**
- Create: `evals/test/integration/gedcom.test.ts`
- Create: `evals/fixtures/synthetic.ged`

- [ ] **Step 1: Write the .ged fixture verbatim**

```
0 HEAD
1 SOUR Eval
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Alice /Smith/
1 SEX F
1 BIRT
2 DATE 1 JAN 1990
2 PLAC Pittsburgh
0 @I2@ INDI
1 NAME Bob /Jones/
1 SEX M
1 BIRT
2 DATE 5 MAR 1992
2 PLAC Brooklyn
0 TRLR
```

- [ ] **Step 2: Write the test verbatim**

```ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

const FIXTURES = resolve(import.meta.dirname ?? '.', '..', '..', 'fixtures');

let wiki: WikiInstance;

before(async () => {
  wiki = await startWiki();
  copyFileSync(join(FIXTURES, 'synthetic.ged'), join(wiki.vaultPath, 'genealogy', 'tree.ged'));
});

after(async () => { await wiki.destroy(); });

test('gedcom: sync produces derived/I1.yml and derived/I2.yml', async () => {
  const res = await fetch(`${wiki.url}/api/gedcom/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gedFile: 'tree.ged', notes: 'eval seed' }),
  });
  assert.equal(res.status, 200);
  const result = await res.json() as { kind: string; diff?: { added: string[] } };
  assert.equal(result.kind, 'wrote');
  assert.deepEqual(result.diff?.added.sort(), ['I1', 'I2']);

  const i1 = readFileSync(join(wiki.vaultPath, 'genealogy', 'derived', 'I1.yml'), 'utf-8');
  assert.match(i1, /name: Alice Smith/);
  assert.match(i1, /Pittsburgh/);
  const i2 = readFileSync(join(wiki.vaultPath, 'genealogy', 'derived', 'I2.yml'), 'utf-8');
  assert.match(i2, /name: Bob Jones/);
});

test('gedcom: re-sync of unchanged file is a no-op', async () => {
  const res = await fetch(`${wiki.url}/api/gedcom/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gedFile: 'tree.ged', notes: 'v2' }),
  });
  const result = await res.json() as { kind: string; reason?: string };
  assert.equal(result.kind, 'no-op');
  assert.equal(result.reason, 'unchanged-hash');
});

test('gedcom: recite drift is empty after sync', async () => {
  const manifest = readFileSync(join(wiki.vaultPath, 'genealogy', 'snapshots.yml'), 'utf-8');
  const hash = manifest.match(/hash:\s*([a-f0-9]+)/)?.[1];
  assert.ok(hash, 'snapshot hash present');

  await writePageDirect(wiki.vaultPath, 'alice-smith', 'Alice page.', {
    title: 'Alice Smith',
    type: 'person',
    gedcom: { file: 'tree.ged', record: 'I1', snapshot: hash! },
  });

  const res = await fetch(`${wiki.url}/api/gedcom/recite`);
  const body = await res.json() as { drift: unknown[] };
  assert.deepEqual(body.drift, []);
});

test('gedcom: mutating the .ged surfaces drift', async () => {
  const gedPath = join(wiki.vaultPath, 'genealogy', 'tree.ged');
  let ged = readFileSync(gedPath, 'utf-8');
  ged = ged.replace('0 TRLR', `1 OCCU Designer\n0 TRLR`);
  writeFileSync(gedPath, ged);

  await fetch(`${wiki.url}/api/gedcom/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gedFile: 'tree.ged', notes: 'mutate' }),
  });

  const res = await fetch(`${wiki.url}/api/gedcom/recite`);
  const body = await res.json() as { drift: { slug: string; record: string }[] };
  assert.ok(body.drift.length > 0, 'expected drift after .ged mutation');
  assert.equal(body.drift[0]!.slug, 'alice-smith');
  assert.equal(body.drift[0]!.record, 'I1');
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nyetwork/dev/whoami
git add evals/fixtures/synthetic.ged evals/test/integration/gedcom.test.ts
git commit -m "test: integration eval for GEDCOM sync + recite drift"
```

---

### Task 8: Atomic write under failure

**Files:**
- Create: `evals/test/integration/atomic-write.test.ts`

The trick: install a `git` pre-commit hook that exits non-zero, then attempt a PUT. The PageStore's atomic write protocol should catch the commit failure and restore the working tree.

- [ ] **Step 1: Write the test verbatim**

```ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;

before(async () => {
  wiki = await startWiki();
  await writePageDirect(wiki.vaultPath, 'atomic-page', 'original body', { title: 'Atomic Page' });
});

after(async () => { await wiki.destroy(); });

function installFailingHook(): void {
  const hookPath = join(wiki.vaultPath, '.git', 'hooks', 'pre-commit');
  mkdirSync(join(wiki.vaultPath, '.git', 'hooks'), { recursive: true });
  writeFileSync(hookPath, '#!/bin/sh\nexit 1\n');
  chmodSync(hookPath, 0o755);
}

function removeHook(): void {
  const hookPath = join(wiki.vaultPath, '.git', 'hooks', 'pre-commit');
  if (existsSync(hookPath)) execSync(`rm -f "${hookPath}"`);
}

test('atomic write: failed commit leaves on-disk file unchanged', async () => {
  installFailingHook();
  try {
    const res = await fetch(`${wiki.url}/api/pages/atomic-page`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'attempted overwrite', summary: 'force fail' }),
    });
    assert.equal(res.ok, false, 'expected 5xx, got ' + res.status);

    const onDisk = readFileSync(join(wiki.vaultPath, 'pages', 'atomic-page.md'), 'utf-8');
    assert.match(onDisk, /original body/, 'previous body should be preserved');
    assert.equal(onDisk.includes('attempted overwrite'), false, 'failed write must not leak');
  } finally {
    removeHook();
  }
});

test('atomic write: no orphan .tmp file after failure', async () => {
  installFailingHook();
  try {
    await fetch(`${wiki.url}/api/pages/atomic-orphan`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'should fail', summary: 'orphan check' }),
    });
    const tmp = join(wiki.vaultPath, 'pages', 'atomic-orphan.md.tmp');
    assert.equal(existsSync(tmp), false, '.tmp orphan should have been cleaned up');
  } finally {
    removeHook();
  }
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm run test:integration 2>&1 | grep -E '(atomic|✔|✖)' | head -10
cd /Users/nyetwork/dev/whoami
git add evals/test/integration/atomic-write.test.ts
git commit -m "test: integration eval for atomic write rollback under git commit failure"
```

---

### Task 9: Performance budgets

**Files:**
- Create: `evals/test/integration/perf.test.ts`

Spec budgets: page render p95 ≤ 100ms, search p95 ≤ 100ms, write+commit p95 ≤ 500ms. Hardware-dependent; assert at **3× spec** to absorb variance, skip when `process.env.CI === 'true'`.

- [ ] **Step 1: Write the test verbatim**

```ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;
const SKIP = process.env.CI === 'true';

before(async () => {
  if (SKIP) return;
  wiki = await startWiki();
  for (let i = 0; i < 30; i++) {
    await writePageDirect(wiki.vaultPath, `perf-${i}`, `body ${i} mentions Squirrel Hill and 1991.`, {
      title: `Perf ${i}`,
      type: 'meta',
    });
  }
});

after(async () => {
  if (!SKIP) await wiki.destroy();
});

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

async function timeN(n: number, fn: () => Promise<unknown>): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await fn();
    out.push(performance.now() - t);
  }
  return out;
}

test('perf: page render p95 under 300ms (3× spec)', { skip: SKIP }, async () => {
  await fetch(`${wiki.url}/perf-0`);  // warm-up
  const samples = await timeN(20, () => fetch(`${wiki.url}/perf-0`).then(r => r.text()));
  const p = p95(samples);
  assert.ok(p < 300, `p95 ${p.toFixed(1)}ms exceeded 300ms`);
});

test('perf: search p95 under 300ms (3× spec)', { skip: SKIP }, async () => {
  await fetch(`${wiki.url}/api/search?q=squirrel`);
  const samples = await timeN(20, () => fetch(`${wiki.url}/api/search?q=squirrel`).then(r => r.json()));
  const p = p95(samples);
  assert.ok(p < 300, `p95 ${p.toFixed(1)}ms exceeded 300ms`);
});

test('perf: PUT+commit p95 under 1500ms (3× spec)', { skip: SKIP }, async () => {
  const samples = await timeN(10, async () => {
    const slug = `perf-write-${Math.random().toString(36).slice(2, 8)}`;
    return fetch(`${wiki.url}/api/pages/${slug}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'hello', summary: 'perf' }),
    }).then(r => r.json());
  });
  const p = p95(samples);
  assert.ok(p < 1500, `p95 ${p.toFixed(1)}ms exceeded 1500ms`);
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm run test:integration 2>&1 | grep -E '(perf|✔|✖)' | head -10
cd /Users/nyetwork/dev/whoami
git add evals/test/integration/perf.test.ts
git commit -m "test: integration eval for p95 budgets (3× spec, skipped on CI)"
```

---

## Phase 5 — Verify

### Task 10: Full eval suite green

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm test 2>&1 | tail -10
```

Expected: all grader unit tests pass (count grew compared to pre-H2b baseline).

- [ ] **Step 2: Integration tests**

```bash
cd /Users/nyetwork/dev/whoami/evals && npm run test:integration 2>&1 | tail -25
```

Expected: 3 (harness from H2a) + 6 (security xss + 3 + slug 3) + 4 (gedcom) + 2 (atomic) + 3 (perf) = ~18 tests pass. Total runtime ~60–120s (one wiki spawn per file × 5 files).

- [ ] **Step 3: Typecheck**

```bash
cd /Users/nyetwork/dev/whoami/evals && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean. No `@ts-nocheck` markers anywhere in `src/`.

- [ ] **Step 4: Verify there are no remaining wikitext-isms in src/**

```bash
grep -rn 'wikitext\|{{Cite\|{{Infobox\|<ref>' /Users/nyetwork/dev/whoami/evals/src/ | grep -v '\.test\.\|node_modules' | head
```

Expected: only mentions in comments referring to "former wikitext format" or in test fixture descriptions — no live regex/string-handling code.

- [ ] **Step 5: No commit** — verification only.

---

## Self-Review Checklist

After all 10 tasks complete:

1. **Spec coverage** (Phase 5 of migration spec)
   - All format-specific graders consume markdown: ✓ (Tasks 1–3)
   - LLM rubric prompts updated: ✓ (Task 4)
   - tool-usage drops dead `wai snapshot`: ✓ (Task 4)
   - runner/e2e.ts works against new wiki: ✓ (Task 5)
   - Security XSS + slug eval: ✓ (Task 6)
   - GEDCOM eval: ✓ (Task 7)
   - Atomic write eval: ✓ (Task 8)
   - Performance eval: ✓ (Task 9)

2. **Placeholder scan** — every step has runnable code or exact commands.

3. **Type consistency** — `ParsedCitation` shape stable; `gradeX(body, ...)` signatures consistent across graders; `WikiInstance` references match H2a's exports.

4. **Out of scope confirmed** — no auth-related evals (CSRF / login rate-limit / frontmatter trust boundary); no Plan A backup eval; no new graders.

---

## Definition of Done

- All **11** tasks complete (Task 0 + 10 numbered tasks); `evals/` typechecks (zero `@ts-nocheck`) and both `npm test` (unit) and `npm run test:integration` are green.
- SKILL.md and editor.md teach valid leaf-directive syntax for citations.
- All format-specific graders consume markdown bodies; LLM rubrics + tool-usage refreshed.
- `runner/e2e.ts` compiles cleanly and runs against the new wiki shape.
- 4 new integration test files cover the spec's verification list (XSS+slug, GEDCOM, atomic-write, perf).
- Branch `migration-spec` has ~11 new commits on top of `def1300`.
- Out of scope (deferred to a future plan): Plan A backup eval; agent-harness API-key wiring (Claude Code / Codex / etc. — those exist but live runs need keys and are out of scope for plan H2b's verification).
