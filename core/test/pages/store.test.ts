import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPageStore } from '../../src/pages/index.ts';
import { makeTestRepo } from './helpers.ts';
import type { Page } from '../../src/pages/types.ts';

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

test('PageStore.list: includes gedcom record for exact joins', async () => {
  const repo = await makeTestRepo();
  try {
    writeFileSync(join(repo.pagesDir, 'steven-barash.md'), `---
title: Steven Nicholas Barash
owner: steven
editors: []
type: person
aliases: []
categories: [Family]
gedcom:
  file: Barash-Family-Tree.ged
  record: I28906360944
  snapshot: abc123
created: 2026-04-29
---

Body.
`);
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const list = await store.list();
    const page = list.find(p => p.slug === 'steven-barash')!;
    assert.equal((page as { gedcomRecord?: string }).gedcomRecord, 'I28906360944');
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

test('PageStore.write: writes file and creates a commit', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    await store.write('alex',
      {
        slug: 'alex',
        meta: {
          schemaVersion: 1,
          title: 'Alex',
          owner: 'steven',
          editors: [],
          type: 'person',
          aliases: [],
          categories: [],
          created: '2026-04-29',
        },
        body: 'Body.\n',
      },
      { name: 'Steven', email: 'steven@example.com' },
      'create alex',
    );
    const page = await store.read('alex');
    assert.equal(page.meta.title, 'Alex');
  } finally {
    repo.cleanup();
  }
});

test('PageStore.write: serializes concurrent writes to the same slug', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const base = (body: string): Page => ({
      slug: 'race',
      meta: { schemaVersion: 1, title: 'Race', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body,
    });
    await Promise.all([
      store.write('race', base('one'), { name: 's', email: 's@x' }, 'one'),
      store.write('race', base('two'), { name: 's', email: 's@x' }, 'two'),
    ]);
    const page = await store.read('race');
    assert.match(page.body, /one|two/);
  } finally {
    repo.cleanup();
  }
});

test('PageStore.history: returns commit log for a slug', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'h',
      meta: { schemaVersion: 1, title: 'H', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'one',
    };
    await store.write('h', page, { name: 'A', email: 'a@x' }, 'first');
    await store.write('h', { ...page, body: 'two' }, { name: 'B', email: 'b@x' }, 'second');
    const log = await store.history('h', 5);
    assert.equal(log.length, 2);
    assert.equal(log[0]!.summary, 'second');
    assert.equal(log[0]!.author, 'B');
  } finally {
    repo.cleanup();
  }
});

test('PageStore.write: working tree is clean after commit failure', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'r',
      meta: { schemaVersion: 1, title: 'R', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'first',
    };
    await store.write('r', page, { name: 'A', email: 'a@x' }, 'first');

    // Force commit to fail by passing an invalid email (contains spaces)
    await assert.rejects(
      store.write('r', { ...page, body: 'second' }, { name: 'A', email: 'invalid email with spaces' }, 'second'),
    );

    // The on-disk content must match the last good commit
    const after = await store.read('r');
    assert.equal(after.body.trim(), 'first');
  } finally {
    repo.cleanup();
  }
});

test('PageStore.softDelete: moves file to _archived/ and marks deletedAt', async () => {
  const repo = await makeTestRepo();
  try {
    const store = createPageStore({ repoRoot: repo.root, pagesDir: repo.pagesDir });
    const page: Page = {
      slug: 'gone',
      meta: { schemaVersion: 1, title: 'Gone', owner: 's', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29' },
      body: 'body',
    };
    await store.write('gone', page, { name: 'A', email: 'a@x' }, 'create');
    await store.softDelete('gone', { name: 'A', email: 'a@x' });

    await assert.rejects(store.read('gone'), /not found/i);

    const archivedPath = join(repo.pagesDir, '_archived', 'gone.md');
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(archivedPath, 'utf-8');
    assert.match(raw, /deletedAt: /);
  } finally {
    repo.cleanup();
  }
});
