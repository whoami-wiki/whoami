import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFrontmatter } from '../src/frontmatter.ts';
import type { PageMeta } from '../src/types.ts';

test('renderFrontmatter: emits required fields in stable order', () => {
  const meta: PageMeta = {
    title: 'Abby Rickelman',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: ['Family', 'People'],
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.equal(out,
`---
title: Abby Rickelman
owner: steven
editors: []
type: person
aliases: []
categories: [Family, People]
created: 2026-04-29
---
`);
});

test('renderFrontmatter: emits gedcom block when present', () => {
  const meta: PageMeta = {
    title: 'Abby Rickelman',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: [],
    categories: ['Family', 'People'],
    gedcom: { file: 'barash-tree.ged', record: 'I28906361734', snapshot: 'a1a48f25952a3294' },
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.match(out, /gedcom:\n  file: barash-tree\.ged\n  record: I28906361734\n  snapshot: a1a48f25952a3294/);
});

test('renderFrontmatter: aliases are inline-flow when short, block when long', () => {
  const meta: PageMeta = {
    title: 'X',
    owner: 'steven',
    editors: [],
    type: 'person',
    aliases: ['Me'],
    categories: [],
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.match(out, /aliases: \[Me\]/);
});

test('renderFrontmatter: uses single-quoted strings only when needed', () => {
  const meta: PageMeta = {
    title: 'Trip: Baku',                        // colon needs quoting
    owner: 'steven',
    editors: [],
    type: 'meta',
    aliases: [],
    categories: [],
    created: '2026-04-29',
  };
  const out = renderFrontmatter(meta);
  assert.match(out, /title: ['"]Trip: Baku['"]/);
});
