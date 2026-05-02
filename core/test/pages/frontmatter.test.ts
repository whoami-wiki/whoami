import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, serializePage } from '../../src/pages/frontmatter.ts';

const SAMPLE = `---
title: Abby Rickelman
owner: steven
editors: []
type: person
aliases: []
categories: [Family, People]
created: 2026-04-29
---

Body text here.
`;

test('parsePage: parses frontmatter and body', () => {
  const page = parsePage('abby-rickelman', SAMPLE);
  assert.equal(page.slug, 'abby-rickelman');
  assert.equal(page.meta.title, 'Abby Rickelman');
  assert.deepEqual(page.meta.categories, ['Family', 'People']);
  assert.match(page.body, /^Body text here\./);
});

test('parsePage: throws on invalid frontmatter (missing title)', () => {
  const bad = '---\nowner: steven\ntype: person\n---\nbody';
  assert.throws(() => parsePage('x', bad));
});

test('serializePage: round-trips frontmatter + body', () => {
  const page = parsePage('abby-rickelman', SAMPLE);
  const text = serializePage(page);
  const re = parsePage('abby-rickelman', text);
  assert.deepEqual(re.meta, page.meta);
  assert.equal(re.body.trim(), 'Body text here.');
});

test('serializePage: preserves gedcom block', () => {
  const page = parsePage('x', `---
title: X
owner: steven
editors: []
type: person
aliases: []
categories: []
gedcom:
  file: a.ged
  record: I1
  snapshot: abc
created: 2026-04-29
---
Body
`);
  const text = serializePage(page);
  assert.match(text, /gedcom:/);
  assert.match(text, /file: a\.ged/);
  assert.match(text, /record: I1/);
});
