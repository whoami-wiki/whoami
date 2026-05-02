import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruneEmptyHeadings } from '../../src/transforms/prune-empty-headings.ts';

test('drops a heading followed immediately by another heading', () => {
  const input = '## References\n## Bibliography\nbody';
  assert.equal(pruneEmptyHeadings(input), '## Bibliography\nbody');
});

test('drops a heading followed by blank lines and another heading', () => {
  const input = '## References\n\n\n## Bibliography\nbody';
  assert.equal(pruneEmptyHeadings(input), '## Bibliography\nbody');
});

test('drops a heading at end of document with only blank lines after', () => {
  const input = 'body\n\n## Empty\n\n';
  assert.doesNotMatch(pruneEmptyHeadings(input), /## Empty/);
  assert.match(pruneEmptyHeadings(input), /^body\b/);
});

test('keeps headings with content', () => {
  const input = '## Section\nbody text\n\n## Other\nmore body';
  assert.equal(pruneEmptyHeadings(input), input);
});

test('keeps a heading when followed by a footnote definition', () => {
  const input = '## References\n[^1]: source\n\n## Bibliography\nbody';
  assert.equal(pruneEmptyHeadings(input), input);
});

test('handles multiple consecutive empty headings', () => {
  const input = '## A\n## B\n## C\nreal content';
  assert.equal(pruneEmptyHeadings(input), '## C\nreal content');
});

test('passes through text without headings', () => {
  assert.equal(pruneEmptyHeadings('plain body'), 'plain body');
});
