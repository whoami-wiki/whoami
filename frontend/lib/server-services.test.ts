import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MigrateReport } from '@core/pages/migrate-runner.ts';

import { orchestrateMigrate } from './server-services';

test('orchestrateMigrate calls rebuildSearchIndex when migrated.length > 0', async () => {
  let rebuilds = 0;
  const fakeRunner = async (): Promise<MigrateReport> => ({
    walked: 1,
    migrated: [{ slug: 'p', from: 1, to: 2 }],
    skipped: [],
    failed: [],
  });
  const fakeRebuild = async () => { rebuilds++; };
  const report = await orchestrateMigrate(
    { repoRoot: '/', pagesDir: '/p' },
    fakeRunner,
    fakeRebuild,
  );
  assert.equal(rebuilds, 1);
  assert.equal(report.migrated.length, 1);
});

test('orchestrateMigrate does not rebuild when zero pages migrated', async () => {
  let rebuilds = 0;
  const fakeRunner = async (): Promise<MigrateReport> => ({
    walked: 0, migrated: [], skipped: [], failed: [],
  });
  await orchestrateMigrate({ repoRoot: '/', pagesDir: '/p' }, fakeRunner, async () => { rebuilds++; });
  assert.equal(rebuilds, 0);
});

test('orchestrateMigrate does not rebuild on dryRun even with migrated entries', async () => {
  let rebuilds = 0;
  const fakeRunner = async (): Promise<MigrateReport> => ({
    walked: 1,
    migrated: [{ slug: 'p', from: 1, to: 2 }],
    skipped: [],
    failed: [],
  });
  await orchestrateMigrate(
    { repoRoot: '/', pagesDir: '/p', dryRun: true },
    fakeRunner,
    async () => { rebuilds++; },
  );
  assert.equal(rebuilds, 0);
});
