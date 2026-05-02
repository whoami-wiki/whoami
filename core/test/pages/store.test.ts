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
