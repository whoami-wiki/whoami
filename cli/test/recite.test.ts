import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRecite } from '../src/commands/recite.js';

test('recite: prints "no drift" when empty', async () => {
  let out = '';
  await runRecite({ apply: false, client: { reciteDrift: async () => ({ drift: [] }) } as any, write: (s) => { out += s; } });
  assert.match(out, /no drift/);
});

test('recite --apply: prints updated count', async () => {
  let out = '';
  await runRecite({ apply: true, client: { applyRecite: async () => ({ updated: ['a', 'b'] }) } as any, write: (s) => { out += s; } });
  assert.match(out, /updated 2 pages/);
});
