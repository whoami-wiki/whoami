import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rebuildSearchIndex } from '../../src/search/rebuild.ts';
import { createSearchIndex } from '../../src/search/index.ts';

test('rebuild: indexes pages without derived', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wiki-'));
  try {
    mkdirSync(join(root, 'pages'), { recursive: true });
    writeFileSync(join(root, 'pages', 'abby-rickelman.md'),
      `---\ntitle: Abby Rickelman\nowner: steven\neditors: []\ntype: person\naliases: []\ncategories: [Family]\ncreated: 2026-04-29\n---\nAbby was born in Pittsburgh.\n`);
    const idx = createSearchIndex();
    await rebuildSearchIndex(idx, { pagesDir: join(root, 'pages'), genealogyDir: join(root, 'genealogy') });
    assert.deepEqual(idx.query('abby').map(h => h.slug), ['abby-rickelman']);
    assert.deepEqual(idx.query('pittsburgh').map(h => h.slug), ['abby-rickelman']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rebuild: includes derived/<record>.yml fields', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wiki-'));
  try {
    mkdirSync(join(root, 'pages'), { recursive: true });
    mkdirSync(join(root, 'genealogy', 'derived'), { recursive: true });
    writeFileSync(join(root, 'pages', 'abby.md'),
      `---\ntitle: Abby\nowner: s\neditors: []\ntype: person\naliases: []\ncategories: []\ngedcom: { file: t.ged, record: I1, snapshot: a1 }\ncreated: 2026-04-29\n---\nbody.\n`);
    writeFileSync(join(root, 'genealogy', 'derived', 'I1.yml'),
      `record: I1\nname: Abby\nbirth: { date: '1991', place: Pittsburgh }\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: [{ date: '2010', place: Squirrel-Hill }]\noccupations: []\nsources: []\n`);
    const idx = createSearchIndex();
    await rebuildSearchIndex(idx, { pagesDir: join(root, 'pages'), genealogyDir: join(root, 'genealogy') });
    assert.deepEqual(idx.query('squirrel').map(h => h.slug), ['abby']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rebuild: skips _archived and _meta', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wiki-'));
  try {
    mkdirSync(join(root, 'pages', '_archived'), { recursive: true });
    mkdirSync(join(root, 'pages', '_meta'), { recursive: true });
    writeFileSync(join(root, 'pages', '_archived', 'old.md'),
      `---\ntitle: Old\nowner: s\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-01-01\ndeletedAt: 2026-01-15\n---\nold body\n`);
    writeFileSync(join(root, 'pages', '_meta', 'site.yml'), 'navOrder: []\n');
    const idx = createSearchIndex();
    await rebuildSearchIndex(idx, { pagesDir: join(root, 'pages'), genealogyDir: join(root, 'genealogy') });
    assert.equal(idx.query('old').length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
