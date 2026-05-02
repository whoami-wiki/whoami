import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slug.ts';

test('slugify: lowercases and converts spaces to hyphens', () => {
  assert.equal(slugify('Steven Barash'), 'steven-barash');
});

test('slugify: collapses underscores', () => {
  assert.equal(slugify('Steven_Barash'), 'steven-barash');
});

test('slugify: collapses multiple whitespace and underscores', () => {
  assert.equal(slugify('Steven  Barash__Sr'), 'steven-barash-sr');
});

test('slugify: drops parenthesized parts only outside of person names', () => {
  assert.equal(slugify('Trip:Baku (December 2025)'), 'trip-baku-december-2025');
});

test('slugify: removes apostrophes and quotes', () => {
  assert.equal(slugify("Apara_and_the_Party_at_Nittay's"), 'apara-and-the-party-at-nittays');
});

test('slugify: preserves hyphens', () => {
  assert.equal(slugify('Wartime-catastrophe'), 'wartime-catastrophe');
});

test('slugify: collapses repeated hyphens', () => {
  assert.equal(slugify('A--B'), 'a-b');
});

test('slugify: keeps unicode letters by transliterating ASCII fallback (best-effort)', () => {
  assert.equal(slugify('Soviet Jewish emigration of the Barash Family'), 'soviet-jewish-emigration-of-the-barash-family');
});
