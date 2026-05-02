import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSessionStore } from '../../src/auth/sessions.ts';

test('SessionStore.create + get: round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'));
    const s = await store.create('steven');
    assert.match(s.id, /^[0-9a-f]{64}$/);
    assert.match(s.csrf, /^[0-9a-f]{64}$/);
    assert.equal(s.userId, 'steven');
    const got = await store.get(s.id);
    assert.deepEqual(got, s);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SessionStore.get: returns null for unknown id', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'));
    assert.equal(await store.get('nope'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SessionStore.get: returns null for expired session', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'), { ttlMs: 1 });
    const s = await store.create('a');
    await new Promise(r => setTimeout(r, 10));
    assert.equal(await store.get(s.id), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SessionStore.delete: removes session', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sess-'));
  try {
    const store = createSessionStore(join(dir, 'sessions.db'));
    const s = await store.create('a');
    await store.delete(s.id);
    assert.equal(await store.get(s.id), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
