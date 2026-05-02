import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCategories } from '../../src/extractors/categories.ts';

test('extracts a single category and strips it from the body', () => {
  const out = extractCategories('Body text\n\n[[Category:Family]]\n');
  assert.deepEqual(out.categories, ['Family']);
  assert.equal(out.body, 'Body text\n');
});

test('extracts multiple categories preserving order', () => {
  const out = extractCategories('Body\n[[Category:Family]]\n[[Category:People]]\n');
  assert.deepEqual(out.categories, ['Family', 'People']);
  assert.equal(out.body.trim(), 'Body');
});

test('extracts category with sortkey and discards the sortkey', () => {
  const out = extractCategories('Body\n[[Category:Family|Rickelman, Abby]]\n');
  assert.deepEqual(out.categories, ['Family']);
});

test('returns empty list when no categories', () => {
  const out = extractCategories('Just body, no cats');
  assert.deepEqual(out.categories, []);
});
