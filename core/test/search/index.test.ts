import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchIndex } from '../../src/search/index.ts';
import type { SearchDoc } from '../../src/search/types.ts';

function doc(slug: string, fields: Partial<SearchDoc> = {}): SearchDoc {
  return {
    slug,
    title: fields.title ?? slug,
    type: fields.type ?? 'person',
    body: fields.body ?? '',
    aliases: fields.aliases ?? '',
    categories: fields.categories ?? '',
    places: fields.places ?? '',
    occupations: fields.occupations ?? '',
    related: fields.related ?? '',
  };
}

test('SearchIndex.query: hits title', () => {
  const idx = createSearchIndex();
  idx.upsert(doc('abby', { title: 'Abby Rickelman' }));
  idx.upsert(doc('steven', { title: 'Steven Barash' }));
  const r = idx.query('abby');
  assert.deepEqual(r.map(h => h.slug), ['abby']);
});

test('SearchIndex.query: hits body', () => {
  const idx = createSearchIndex();
  idx.upsert(doc('abby', { title: 'Abby', body: 'lives in Squirrel Hill' }));
  idx.upsert(doc('bob', { title: 'Bob', body: 'lives in Brooklyn' }));
  const r = idx.query('squirrel');
  assert.deepEqual(r.map(h => h.slug), ['abby']);
});

test('SearchIndex.query: hits places (derived data)', () => {
  const idx = createSearchIndex();
  idx.upsert(doc('abby', { title: 'Abby', places: 'Pittsburgh Squirrel-Hill' }));
  idx.upsert(doc('bob', { title: 'Bob', places: 'New-York' }));
  const r = idx.query('pittsburgh');
  assert.deepEqual(r.map(h => h.slug), ['abby']);
});

test('SearchIndex.upsert: replaces existing entry', () => {
  const idx = createSearchIndex();
  idx.upsert(doc('abby', { title: 'Abby', body: 'old body' }));
  idx.upsert(doc('abby', { title: 'Abby', body: 'new body about cats' }));
  assert.equal(idx.query('cats').length, 1);
  assert.equal(idx.query('old').length, 0);
});

test('SearchIndex.remove: drops entry', () => {
  const idx = createSearchIndex();
  idx.upsert(doc('abby', { title: 'Abby Rickelman' }));
  idx.remove('abby');
  assert.equal(idx.query('abby').length, 0);
});

test('SearchIndex.query: limit', () => {
  const idx = createSearchIndex();
  for (let i = 0; i < 10; i++) idx.upsert(doc(`p${i}`, { title: 'foo' }));
  assert.equal(idx.query('foo', 3).length, 3);
});
