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
    assert.equal(result.diff.added.length, 3);
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
