import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../../src/auth/rate-limit.ts';

test('rate-limit: allows up to N attempts in the window', () => {
  const r = createRateLimiter({ windowMs: 60_000, maxAttempts: 5 });
  for (let i = 0; i < 5; i++) {
    assert.equal(r.check('1.2.3.4'), 'ok');
  }
});

test('rate-limit: blocks the 6th attempt within the window', () => {
  const r = createRateLimiter({ windowMs: 60_000, maxAttempts: 5 });
  for (let i = 0; i < 5; i++) r.check('1.2.3.4');
  assert.equal(r.check('1.2.3.4'), 'limited');
});

test('rate-limit: independent buckets per IP', () => {
  const r = createRateLimiter({ windowMs: 60_000, maxAttempts: 2 });
  r.check('1.1.1.1'); r.check('1.1.1.1');
  assert.equal(r.check('1.1.1.1'), 'limited');
  assert.equal(r.check('2.2.2.2'), 'ok');
});

test('rate-limit: window slides — old attempts expire', async () => {
  const r = createRateLimiter({ windowMs: 30, maxAttempts: 2 });
  r.check('a'); r.check('a');
  assert.equal(r.check('a'), 'limited');
  await new Promise(res => setTimeout(res, 50));
  assert.equal(r.check('a'), 'ok');
});
