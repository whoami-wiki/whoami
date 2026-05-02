import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSearch } from '../src/commands/search.js';

test('search: prints rows for hits', async () => {
  let out = '';
  await runSearch({
    query: 'abby',
    limit: 25,
    json: false,
    client: { search: async () => ({ results: [{ slug: 'abby-rickelman', title: 'Abby Rickelman', type: 'person' }] }) } as any,
    write: (s) => { out += s; },
  });
  assert.match(out, /abby-rickelman/);
  assert.match(out, /\(person\)/);
});

test('search: --json emits array', async () => {
  let out = '';
  await runSearch({
    query: 'abby',
    limit: 25,
    json: true,
    client: { search: async () => ({ results: [{ slug: 'a', title: 'A', type: 'person' }] }) } as any,
    write: (s) => { out += s; },
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed[0].slug, 'a');
});

test('search: empty query rejects', async () => {
  await assert.rejects(
    () => runSearch({
      query: '   ',
      limit: 25,
      json: false,
      client: { search: async () => ({ results: [] }) } as any,
      write: () => {},
    }),
    /required/i,
  );
});
