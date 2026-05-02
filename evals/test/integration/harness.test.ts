import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;

before(async () => {
  wiki = await startWiki();
});

after(async () => {
  await wiki.destroy();
});

test('harness: healthz returns 200', async () => {
  const res = await fetch(`${wiki.url}/api/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json() as { status: string };
  assert.equal(body.status, 'ok');
});

test('harness: writePageDirect seeds a readable page', async () => {
  await writePageDirect(wiki.vaultPath, 'seeded-page', 'hello from seed', { title: 'Seeded Page' });
  const res = await fetch(`${wiki.url}/api/pages/seeded-page`);
  assert.equal(res.status, 200);
  const page = await res.json() as { slug: string; meta: { title: string }; body: string };
  assert.equal(page.slug, 'seeded-page');
  assert.equal(page.meta.title, 'Seeded Page');
  assert.match(page.body, /hello from seed/);
});

test('harness: PUT writes a page; GET reads it', async () => {
  const res = await fetch(`${wiki.url}/api/pages/api-write`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'via api', summary: 'first' }),
  });
  assert.equal(res.status, 200);
  const got = await fetch(`${wiki.url}/api/pages/api-write`);
  const page = await got.json() as { body: string };
  assert.match(page.body, /via api/);
});
