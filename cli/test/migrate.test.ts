import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMigrate, type MigrateRunnerCli } from '../src/commands/migrate.js';
import type { MigrateReport } from '../src/api-client.js';

function makeFakeClient(report: MigrateReport): { migrate: () => Promise<MigrateReport> } {
  return { migrate: async () => report };
}

test('runMigrate prints summary for happy path', async () => {
  const out: string[] = [];
  const opts: MigrateRunnerCli = {
    client: makeFakeClient({
      walked: 3,
      migrated: [{ slug: 'a', from: 1, to: 2 }],
      skipped: [{ slug: 'b', version: 2 }, { slug: 'c', version: 2 }],
      failed: [],
    }),
    write: (s) => out.push(s),
    json: false,
    dryRun: false,
    force: false,
  };
  const code = await runMigrate(opts);
  assert.equal(code, 0);
  const printed = out.join('');
  assert.match(printed, /walked 3/);
  assert.match(printed, /migrated 1/);
  assert.match(printed, /skipped 2/);
});

test('runMigrate exits non-zero on per-page failures', async () => {
  const out: string[] = [];
  const code = await runMigrate({
    client: makeFakeClient({
      walked: 1, migrated: [], skipped: [],
      failed: [{ slug: 'x', error: 'boom' }],
    }),
    write: (s) => out.push(s),
    json: false, dryRun: false, force: false,
  });
  assert.equal(code, 2);
});

test('runMigrate --json prints the raw report', async () => {
  const out: string[] = [];
  const report: MigrateReport = { walked: 0, migrated: [], skipped: [], failed: [] };
  await runMigrate({
    client: makeFakeClient(report),
    write: (s) => out.push(s),
    json: true, dryRun: false, force: false,
  });
  const parsed = JSON.parse(out.join(''));
  assert.deepEqual(parsed, report);
});
