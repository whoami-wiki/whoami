import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformHeadings } from '../../src/transforms/headings.ts';

test('converts == H2 ==', () => {
  assert.equal(transformHeadings('== Residential arc =='), '## Residential arc');
});

test('converts === H3 ===', () => {
  assert.equal(transformHeadings('=== Romantic ==='), '### Romantic');
});

test('converts ==== H4 ====', () => {
  assert.equal(transformHeadings('==== Former close friend ===='), '#### Former close friend');
});

test('handles trailing whitespace inside the wrapper', () => {
  assert.equal(transformHeadings('==  Section  =='), '## Section');
});

test('preserves leading whitespace if any (rare)', () => {
  // MediaWiki ignores leading whitespace; we treat headings as line-starting.
  assert.equal(transformHeadings('  == Indented =='), '  == Indented ==');
});

test('does not match unbalanced =', () => {
  assert.equal(transformHeadings('== Unbalanced'), '== Unbalanced');
  assert.equal(transformHeadings('=== Mismatched =='), '=== Mismatched ==');
});

test('passes through text without headings', () => {
  assert.equal(transformHeadings('plain body'), 'plain body');
});
