import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import {
  runMigrate,
  MIGRATE_AUTHOR,
  DirtyRepoError,
} from '../../src/pages/migrate-runner.ts';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from '../../src/pages/migrations/index.ts';

async function makeRepo(): Promise<{ repoRoot: string; pagesDir: string }> {
  const repoRoot = mkdtempSync(join(tmpdir(), 'mig-'));
  const pagesDir = join(repoRoot, 'pages');
  mkdirSync(pagesDir, { recursive: true });
  const git = simpleGit(repoRoot);
  await git.init();
  await git.addConfig('user.name', 'Test', false, 'local');
  await git.addConfig('user.email', 'test@example.com', false, 'local');
  await git.commit('init', undefined, { '--allow-empty': null });
  return { repoRoot, pagesDir };
}

function writePage(pagesDir: string, slug: string, schemaVersion: number | null): void {
  const versionLine = schemaVersion === null ? '' : `schemaVersion: ${schemaVersion}\n`;
  writeFileSync(
    join(pagesDir, `${slug}.md`),
    `---\n${versionLine}title: ${slug}\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nbody`,
  );
}

test('runMigrate refuses to run on a dirty repo', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION);
  // Make the repo dirty by leaving the new file uncommitted
  await assert.rejects(
    () => runMigrate({ repoRoot, pagesDir }),
    DirtyRepoError,
  );
});

test('runMigrate with force: true skips the dirty preflight', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION);
  const report = await runMigrate({ repoRoot, pagesDir, force: true });
  assert.equal(report.migrated.length, 0);
  assert.equal(report.skipped.length, 1);
});

test('runMigrate aborts on a future-version page', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION + 1);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  await assert.rejects(
    () => runMigrate({ repoRoot, pagesDir }),
    FutureSchemaVersionError,
  );
});

test('runMigrate skips already-current pages', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'a', CURRENT_SCHEMA_VERSION);
  writePage(pagesDir, 'b', CURRENT_SCHEMA_VERSION);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const report = await runMigrate({ repoRoot, pagesDir });
  assert.equal(report.migrated.length, 0);
  assert.equal(report.failed.length, 0);
  assert.equal(report.skipped.length, 2);
});

test('runMigrate walks _archived/ subdirectory', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  mkdirSync(join(pagesDir, '_archived'), { recursive: true });
  writePage(pagesDir, 'live', CURRENT_SCHEMA_VERSION);
  writeFileSync(
    join(pagesDir, '_archived', 'old.md'),
    `---\nschemaVersion: ${CURRENT_SCHEMA_VERSION}\ntitle: old\nowner: me\neditors: []\ntype: person\naliases: []\ncategories: []\ncreated: 2026-05-01\n---\nx`,
  );
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const report = await runMigrate({ repoRoot, pagesDir });
  assert.equal(report.walked, 2, `expected 2 files walked, got ${report.walked}`);
});

test('runMigrate dry-run reports without writing or committing', async () => {
  // V1 ships empty MIGRATIONS, so dry-run on stale isn't reachable
  // in tests today. Document this assertion as a placeholder until
  // the first real migration ships:
  //   when a migration exists, dry-run should report.migrated.length > 0
  //   and yet leave file mtimes and `git log` unchanged.
  // For now, at least exercise the dry-run code path on a current dir:
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'p', CURRENT_SCHEMA_VERSION);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const before = statSync(join(pagesDir, 'p.md')).mtimeMs;
  await runMigrate({ repoRoot, pagesDir, dryRun: true });
  const after = statSync(join(pagesDir, 'p.md')).mtimeMs;
  assert.equal(before, after);
});

test('runMigrate respects the page filter', async () => {
  const { repoRoot, pagesDir } = await makeRepo();
  writePage(pagesDir, 'a', CURRENT_SCHEMA_VERSION);
  writePage(pagesDir, 'b', CURRENT_SCHEMA_VERSION);
  const git = simpleGit(repoRoot);
  await git.add('.');
  await git.commit('seed');

  const report = await runMigrate({ repoRoot, pagesDir, page: 'a' });
  assert.equal(report.walked, 1);
  assert.equal(report.skipped[0]!.slug, 'a');
});
