import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDelete } from '../src/commands/delete.js';

test('delete: refuses without --yes', async () => {
  await assert.rejects(
    () => runDelete({ slug: 'foo', yes: false, client: { delete: async () => ({ ok: true } as const) } as any, write: () => {} }),
    /--yes/,
  );
});

test('delete: calls API with --yes', async () => {
  let called = false;
  await runDelete({
    slug: 'foo',
    yes: true,
    client: { delete: async () => { called = true; return { ok: true } as const; } } as any,
    write: () => {},
  });
  assert.equal(called, true);
});
