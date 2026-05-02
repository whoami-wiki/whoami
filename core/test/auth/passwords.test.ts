import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/auth/passwords.ts';

test('hashPassword: returns a bcrypt hash', async () => {
  const hash = await hashPassword('hunter2');
  assert.match(hash, /^\$2[aby]\$/);
});

test('verifyPassword: accepts the correct password', async () => {
  const hash = await hashPassword('correct horse');
  assert.equal(await verifyPassword('correct horse', hash), true);
});

test('verifyPassword: rejects the wrong password', async () => {
  const hash = await hashPassword('right');
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('hashPassword: cost factor is 12 (or higher)', async () => {
  const hash = await hashPassword('x');
  const cost = parseInt(hash.split('$')[2]!, 10);
  assert.ok(cost >= 12, `expected cost >= 12, got ${cost}`);
});
