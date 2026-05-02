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
