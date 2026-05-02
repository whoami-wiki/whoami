import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCreate } from '../src/commands/create.js';
import { NotFound } from '../src/api-client.js';

test('create: refuses when page exists', async () => {
  const client: any = {
    read: async () => ({ slug: 'foo', meta: {}, body: '' }),
    write: async () => { throw new Error('should not be called'); },
  };
  await assert.rejects(() => runCreate({ slug: 'foo', body: 'x', summary: 's', client, write: () => {} }), /already exists/);
});

test('create: writes when page missing', async () => {
  let wrote = false;
  const client: any = {
    read: async () => { throw new NotFound(404); },
    write: async () => { wrote = true; return { ok: true }; },
  };
  await runCreate({ slug: 'foo', body: 'x', summary: 's', client, write: () => {} });
  assert.equal(wrote, true);
});
