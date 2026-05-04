import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchDoc } from '../../src/search/doc-builder.ts';
import type { Page } from '../../src/pages/types.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

const page: Page = {
  slug: 'abby-rickelman',
  meta: {
    schemaVersion: 1,
    title: 'Abby Rickelman',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: ['Abby', 'Abigail'],
    categories: ['Family', 'People'],
    created: '2026-04-29',
  },
  body: 'Abby was born in 1991. She lives in Squirrel Hill.',
};

test('buildSearchDoc: page only', () => {
  const doc = buildSearchDoc(page);
  assert.equal(doc.slug, 'abby-rickelman');
  assert.equal(doc.title, 'Abby Rickelman');
  assert.equal(doc.type, 'person');
  assert.equal(doc.aliases, 'Abby Abigail');
  assert.equal(doc.categories, 'Family People');
  assert.match(doc.body, /Squirrel Hill/);
  assert.equal(doc.places, '');
  assert.equal(doc.occupations, '');
  assert.equal(doc.related, '');
});

test('buildSearchDoc: page + derived', () => {
  const derived: DerivedRecord = {
    record: 'I123',
    name: 'Abby Rickelman',
    birth: { date: '1991', place: 'Pittsburgh' },
    death: null,
    parents: [
      { record: 'I1', name: 'Yaroslav Rickelman', role: 'father' },
      { record: 'I2', name: 'Irene Burmenko', role: 'mother' },
    ],
    spouses: [{ record: 'I3', name: 'Thomas Campanella', married: null }],
    children: [],
    residences: [{ date: '2010', place: 'Squirrel Hill' }],
    occupations: [{ title: 'Designer', date: null }],
    sources: [],
  };
  const doc = buildSearchDoc(page, derived);
  assert.match(doc.places, /Pittsburgh/);
  assert.match(doc.places, /Squirrel Hill/);
  assert.equal(doc.occupations, 'Designer');
  assert.match(doc.related, /Yaroslav Rickelman/);
  assert.match(doc.related, /Thomas Campanella/);
});
