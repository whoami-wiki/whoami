import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSyncGedcom } from '../src/commands/sync-gedcom.js';

test('sync-gedcom: prints diff summary on wrote', async () => {
  let out = '';
  await runSyncGedcom({
    gedFile: 'tree.ged',
    notes: 'test',
    client: {
      syncGedcom: async () => ({
        kind: 'wrote' as const,
        diff: { added: ['I1'], changed: [], removed: [] },
        commit: 'abcdef1234',
        snapshot: { hash: 'abc', date: '2026-05-02T00:00:00Z', file: 'tree.ged', notes: 'test' },
      }),
    } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /\+1 ~0 -0/);
});

test('sync-gedcom: prints no-op message', async () => {
  let out = '';
  await runSyncGedcom({
    gedFile: 'tree.ged',
    notes: 'test',
    client: { syncGedcom: async () => ({ kind: 'no-op' as const, reason: 'unchanged-hash' as const }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /no-op/);
});
