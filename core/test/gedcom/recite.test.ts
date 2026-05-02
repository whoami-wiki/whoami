import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { simpleGit } from 'simple-git';
import { syncGedcom } from '../../src/gedcom/sync.ts';
import { reciteDrift, applyRecite } from '../../src/gedcom/recite.ts';

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

    // Wait a moment so the second sync's commit timestamp is strictly after the first.
    await new Promise(r => setTimeout(r, 1100));

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

    await new Promise(r => setTimeout(r, 1100));

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

test('applyRecite: only changes the snapshot line; preserves rest of frontmatter', async () => {
  const { root, firstHash, cleanup } = await setupRepoWithFirstSync();
  try {
    const original = `---
title: John Doe
owner: test
editors: []
type: person
aliases: []
categories: [Family, People]
gedcom:
  file: tiny.ged
  record: I1
  snapshot: ${firstHash}
created: 2026-01-01
---

Body with **bold** and [[wikilink]].
`;
    writeFileSync(join(root, 'pages', 'john.md'), original);
    const git = simpleGit(root);
    await git.add(['pages/john.md']);
    await git.commit('add john', undefined, { '--author': 'Test <test@example.com>' });

    await new Promise(r => setTimeout(r, 1100));

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
    // Only the snapshot line changed — categories, body, etc. all intact
    const expected = original.replace(firstHash, second.snapshot.hash);
    assert.equal(updated, expected);
  } finally { cleanup(); }
});
