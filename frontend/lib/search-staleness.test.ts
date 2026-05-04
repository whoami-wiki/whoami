import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isSearchIndexStale } from './search-staleness';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'staleness-'));
  const pagesDir = join(root, 'pages');
  const indexPath = join(root, 'data', 'search.idx.json');
  mkdirSync(pagesDir, { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  return { root, pagesDir, indexPath };
}

test('staleness: missing index is stale', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(join(pagesDir, 'a.md'), '---\ntitle: A\n---\nbody\n');
    assert.equal(isSearchIndexStale(pagesDir, indexPath), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: index newer than every page is fresh', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(join(pagesDir, 'a.md'), '---\ntitle: A\n---\nbody\n');
    // Backdate the page so the index (written next) is strictly newer.
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(pagesDir, 'a.md'), past, past);
    writeFileSync(indexPath, '{}');
    assert.equal(isSearchIndexStale(pagesDir, indexPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: an edited existing page makes the index stale', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(join(pagesDir, 'a.md'), '---\ntitle: A\n---\nbody\n');
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(pagesDir, 'a.md'), past, past);
    writeFileSync(indexPath, '{}');
    // Now "edit" the page — bump its mtime to now.
    const now = new Date();
    utimesSync(join(pagesDir, 'a.md'), now, now);
    assert.equal(isSearchIndexStale(pagesDir, indexPath), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: ignores _archived and _meta entries', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    mkdirSync(join(pagesDir, '_archived'), { recursive: true });
    writeFileSync(join(pagesDir, '_archived', 'old.md'), '---\ntitle: Old\n---\nbody\n');
    writeFileSync(indexPath, '{}');
    // _archived was written after the index, but should be ignored.
    assert.equal(isSearchIndexStale(pagesDir, indexPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('staleness: ignores non-md files', () => {
  const { root, pagesDir, indexPath } = makeFixture();
  try {
    writeFileSync(indexPath, '{}');
    // Touch a non-md file after the index was written.
    writeFileSync(join(pagesDir, 'README.txt'), 'hi');
    assert.equal(isSearchIndexStale(pagesDir, indexPath), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
