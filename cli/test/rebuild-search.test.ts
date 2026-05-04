import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRebuildSearch } from '../src/commands/rebuild-search.js';

test('rebuild-search: prints rebuild summary on success', async () => {
  let out = '';
  await runRebuildSearch({
    check: false,
    client: { rebuildSearch: async () => ({ ok: true as const, pages: 107, ms: 23 }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /rebuilt 107 pages in 23ms/);
});

test('rebuild-search: --check fresh prints fresh and resolves', async () => {
  let out = '';
  await runRebuildSearch({
    check: true,
    client: { rebuildSearchCheck: async () => ({ stale: false }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /^fresh/);
});

test('rebuild-search: --check stale throws (so CLI exits non-zero)', async () => {
  let out = '';
  await assert.rejects(
    () => runRebuildSearch({
      check: true,
      client: { rebuildSearchCheck: async () => ({ stale: true }) } as any,
      write: (s) => { out += s; },
    }),
    /stale/i,
  );
  assert.match(out, /^stale/);
});
