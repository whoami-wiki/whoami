import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageMeta } from '../../src/pages/schema.ts';

test('parsePageMeta: accepts a minimal valid frontmatter object', () => {
  const meta = parsePageMeta({
    title: 'Steven Barash',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: ['Family'],
    created: '2026-04-29',
  });
  assert.equal(meta.title, 'Steven Barash');
  assert.equal(meta.owner, 'steven');
  assert.equal(meta.type, 'person');
});

test('parsePageMeta: accepts a gedcom block', () => {
  const meta = parsePageMeta({
    title: 'X',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: [],
    gedcom: { file: 'a.ged', record: 'I1', snapshot: 'abc' },
    created: '2026-04-29',
  });
  assert.deepEqual(meta.gedcom, { file: 'a.ged', record: 'I1', snapshot: 'abc' });
});

test('parsePageMeta: rejects invalid type', () => {
  assert.throws(() => parsePageMeta({
    title: 'X', owner: 'a', editors: [], type: 'invalid', aliases: [], categories: [], created: '2026-04-29',
  }));
});

test('parsePageMeta: rejects missing title', () => {
  assert.throws(() => parsePageMeta({
    owner: 'a', editors: [], type: 'person', aliases: [], categories: [], created: '2026-04-29',
  }));
});

test('parsePageMeta: rejects bad date format', () => {
  assert.throws(() => parsePageMeta({
    title: 'X', owner: 'a', editors: [], type: 'person', aliases: [], categories: [], created: '2026/04/29',
  }));
});
