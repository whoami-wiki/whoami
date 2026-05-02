import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000';

let serverUp = false;

before(async () => {
  try {
    const res = await fetch(`${BASE}/api/healthz`);
    serverUp = res.ok;
  } catch { serverUp = false; }
});

test('e2e: index responds with 200', async (t) => {
  if (!serverUp) return t.skip('dev server not running');
  const res = await fetch(BASE);
  assert.equal(res.status, 200);
});

test('e2e: /api/pages/abby-rickelman returns parsed page', async (t) => {
  if (!serverUp) return t.skip('dev server not running');
  const res = await fetch(`${BASE}/api/pages/abby-rickelman`);
  if (res.status === 404) return;
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, 'abby-rickelman');
});

test('e2e: PUT with bad body returns 400', async (t) => {
  if (!serverUp) return t.skip('dev server not running');
  const res = await fetch(`${BASE}/api/pages/abby-rickelman`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('e2e: bad slug returns 400', async (t) => {
  if (!serverUp) return t.skip('dev server not running');
  const res = await fetch(`${BASE}/api/pages/UPPERCASE`);
  assert.equal(res.status, 400);
});
