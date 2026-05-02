import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEdit } from '../src/commands/edit.js';

test('edit: no change → no write', async () => {
  let wrote = false;
  const client: any = {
    read: async () => ({ slug: 'foo', meta: {}, body: 'same' }),
    write: async () => { wrote = true; return { ok: true }; },
  };
  let out = '';
  await runEdit({ slug: 'foo', summary: 's', client, write: (s) => { out += s; }, openEditor: (init) => init });
  assert.equal(wrote, false);
  assert.match(out, /no changes/);
});

test('edit: changed → write', async () => {
  let wrote = false;
  const client: any = {
    read: async () => ({ slug: 'foo', meta: {}, body: 'old' }),
    write: async (_s: string, body: string) => { wrote = body === 'new'; return { ok: true }; },
  };
  await runEdit({ slug: 'foo', summary: 's', client, write: () => {}, openEditor: () => 'new' });
  assert.equal(wrote, true);
});
