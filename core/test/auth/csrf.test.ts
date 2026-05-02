import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCsrfToken } from '../../src/auth/csrf.ts';

test('verifyCsrfToken: matches when both equal', () => {
  assert.equal(verifyCsrfToken('aaa', 'aaa'), true);
});

test('verifyCsrfToken: mismatches on different values', () => {
  assert.equal(verifyCsrfToken('aaa', 'bbb'), false);
});

test('verifyCsrfToken: timing-safe (length-mismatch returns false without throwing)', () => {
  assert.equal(verifyCsrfToken('a', 'aaaa'), false);
});

test('verifyCsrfToken: rejects empty/undefined', () => {
  assert.equal(verifyCsrfToken('', ''), false);
  assert.equal(verifyCsrfToken(undefined as unknown as string, 'x'), false);
});
