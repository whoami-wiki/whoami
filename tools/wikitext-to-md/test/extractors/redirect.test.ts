import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRedirect } from '../../src/extractors/redirect.ts';

test('detects #REDIRECT and returns target title', () => {
  assert.deepEqual(extractRedirect('#REDIRECT [[Steven Barash]]'), { target: 'Steven Barash' });
});

test('matches case-insensitive REDIRECT keyword', () => {
  assert.deepEqual(extractRedirect('#redirect [[A]]'), { target: 'A' });
});

test('tolerates leading whitespace', () => {
  assert.deepEqual(extractRedirect('  \n#REDIRECT [[A]]'), { target: 'A' });
});

test('returns null for non-redirect pages', () => {
  assert.equal(extractRedirect("'''A''' is a body."), null);
});

test('returns null when REDIRECT appears mid-text (only the leading directive counts)', () => {
  assert.equal(extractRedirect('Body. #REDIRECT [[A]]'), null);
});
