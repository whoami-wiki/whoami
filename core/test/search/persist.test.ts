import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSearchIndex } from '../../src/search/index.ts';
import { saveSearchIndex, loadSearchIndex } from '../../src/search/persist.ts';
import type { SearchDoc } from '../../src/search/types.ts';

function doc(slug: string, title: string): SearchDoc {
  return { slug, title, type: 'person', body: '', aliases: '', categories: '', places: '', occupations: '', related: '' };
}

test('save then load round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'search-'));
  try {
    const file = join(dir, 'search.idx.json');
    const a = createSearchIndex();
    a.upsert(doc('abby', 'Abby Rickelman'));
    a.upsert(doc('steven', 'Steven Barash'));
    await saveSearchIndex(a, file);

    const b = createSearchIndex();
    await loadSearchIndex(b, file);
    assert.deepEqual(b.query('abby').map(h => h.slug), ['abby']);
    assert.deepEqual(b.query('steven').map(h => h.slug), ['steven']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('load: returns false on missing file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'search-'));
  try {
    const idx = createSearchIndex();
    const ok = await loadSearchIndex(idx, join(dir, 'nope.json'));
    assert.equal(ok, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('load: returns false on corrupt file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'search-'));
  try {
    const file = join(dir, 'corrupt.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, 'not json {{{', 'utf-8');
    const idx = createSearchIndex();
    const ok = await loadSearchIndex(idx, file);
    assert.equal(ok, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
