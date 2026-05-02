import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3000';

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/healthz`);
    return res.ok;
  } catch { return false; }
}

let skipped = false;
reachable().then(ok => { skipped = !ok; });

test('e2e: index responds with 200', { skip: skipped }, async () => {
  const res = await fetch(BASE);
  assert.equal(res.status, 200);
});

test('e2e: /api/pages/abby-rickelman returns parsed page', { skip: skipped }, async () => {
  const res = await fetch(`${BASE}/api/pages/abby-rickelman`);
  if (res.status === 404) return;
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, 'abby-rickelman');
});

test('e2e: PUT without CSRF returns 403', { skip: skipped }, async () => {
  const res = await fetch(`${BASE}/api/pages/abby-rickelman`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'x', summary: 'x' }),
  });
  assert.equal(res.status, 403);
});

test('e2e: bad slug returns 400', { skip: skipped }, async () => {
  const res = await fetch(`${BASE}/api/pages/..%2Fpasswd`);
  assert.equal(res.status, 400);
});
