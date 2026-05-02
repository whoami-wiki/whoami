import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlugIndex, resolveWikilinks } from './wikilinks.ts';

const idx = buildSlugIndex([
  { slug: 'steven-barash', title: 'Steven Barash', aliases: ['Me'] },
  { slug: 'abby-rickelman', title: 'Abby Rickelman', aliases: [] },
]);

test('resolves [[Title]] to a markdown link', () => {
  assert.equal(resolveWikilinks('See [[Steven Barash]] today.', idx),
    'See [Steven Barash](/steven-barash) today.');
});

test('resolves [[Title|label]]', () => {
  assert.equal(resolveWikilinks('See [[Steven Barash|Steve]].', idx),
    'See [Steve](/steven-barash).');
});

test('resolves [[Title#anchor]]', () => {
  assert.equal(resolveWikilinks('See [[Abby Rickelman#family]].', idx),
    'See [Abby Rickelman#family](/abby-rickelman#family).');
});

test('renders red span for unknown link', () => {
  assert.match(resolveWikilinks('Hi [[Unknown]].', idx), /<span class="redlink">Unknown<\/span>/);
});

test('resolves alias', () => {
  assert.equal(resolveWikilinks('I am [[Me]].', idx),
    'I am [Me](/steven-barash).');
});
