import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGedcomYear } from '../../src/family/dates.ts';

test('parseGedcomYear: full date', () => {
  assert.deepEqual(parseGedcomYear('12 JAN 1950'), { year: 1950 });
});

test('parseGedcomYear: year only', () => {
  assert.deepEqual(parseGedcomYear('1880'), { year: 1880 });
});

test('parseGedcomYear: ABT (about)', () => {
  assert.deepEqual(parseGedcomYear('ABT 1880'), { year: 1880, qualifier: 'about' });
});

test('parseGedcomYear: BEF (before)', () => {
  assert.deepEqual(parseGedcomYear('BEF 1900'), { year: 1900, qualifier: 'before' });
});

test('parseGedcomYear: AFT (after)', () => {
  assert.deepEqual(parseGedcomYear('AFT 1850'), { year: 1850, qualifier: 'after' });
});

test('parseGedcomYear: BET ... AND ... uses midpoint', () => {
  assert.deepEqual(parseGedcomYear('BET 1850 AND 1860'), { year: 1855, qualifier: 'range' });
});

test('parseGedcomYear: null/empty/unrecognized returns null', () => {
  assert.equal(parseGedcomYear(null), null);
  assert.equal(parseGedcomYear(''), null);
  assert.equal(parseGedcomYear('not a date'), null);
});
