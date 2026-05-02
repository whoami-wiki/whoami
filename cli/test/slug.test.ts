import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSlug } from '../src/slug.js';

test('toSlug: spaces to hyphens, lowercase', () => {
  assert.equal(toSlug('Steven Barash'), 'steven-barash');
});

test('toSlug: underscores to hyphens', () => {
  assert.equal(toSlug('Steven_Barash'), 'steven-barash');
});

test('toSlug: collapse multiple separators', () => {
  assert.equal(toSlug('Steven  Barash'), 'steven-barash');
  assert.equal(toSlug('foo - bar'), 'foo-bar');
});

test('toSlug: preserves .talk suffix', () => {
  assert.equal(toSlug('Steven Barash.talk'), 'steven-barash.talk');
});

test('toSlug: passes through valid slugs', () => {
  assert.equal(toSlug('steven-barash'), 'steven-barash');
});

test('toSlug: strips leading/trailing whitespace', () => {
  assert.equal(toSlug('  Steven Barash  '), 'steven-barash');
});

test('toSlug: strips non-alphanumeric chars (slashes, punctuation)', () => {
  assert.equal(toSlug('page/sub'), 'page-sub');
  assert.equal(toSlug("Mary O'Neil"), 'mary-oneil');
  assert.equal(toSlug('Foo: Bar?'), 'foo-bar');
});

test('toSlug: empty/junk input returns empty string', () => {
  assert.equal(toSlug(''), '');
  assert.equal(toSlug('---'), '');
  assert.equal(toSlug('!@#$'), '');
});
