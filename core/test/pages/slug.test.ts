import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug, assertValidSlug } from '../../src/pages/slug.ts';

test('isValidSlug: accepts kebab-case slugs', () => {
  assert.equal(isValidSlug('steven-barash'), true);
  assert.equal(isValidSlug('a'), true);
  assert.equal(isValidSlug('a1'), true);
});

test('isValidSlug: accepts .talk suffix', () => {
  assert.equal(isValidSlug('steven-barash.talk'), true);
});

test('isValidSlug: rejects path traversal', () => {
  assert.equal(isValidSlug('../etc/passwd'), false);
  assert.equal(isValidSlug('..'), false);
  assert.equal(isValidSlug('a/b'), false);
});

test('isValidSlug: rejects uppercase', () => {
  assert.equal(isValidSlug('Steven-Barash'), false);
});

test('isValidSlug: rejects empty / leading-hyphen', () => {
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug('-foo'), false);
});

test('assertValidSlug: throws on invalid', () => {
  assert.throws(() => assertValidSlug('../foo'), /invalid slug/i);
});

test('assertValidSlug: returns input on valid', () => {
  assert.equal(assertValidSlug('abc-123'), 'abc-123');
});
