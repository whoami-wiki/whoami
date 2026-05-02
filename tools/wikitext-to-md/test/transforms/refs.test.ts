import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformRefs } from '../../src/transforms/refs.ts';

test('converts a single unnamed ref to a footnote with auto id', () => {
  const input = 'Body[<ref>source A</ref>]\n\n<references />';
  const output = transformRefs(input);
  assert.match(output, /Body\[\[\^auto-1\]\]/);
  assert.match(output, /\[\^auto-1\]: source A/);
});

test('converts a named ref and reuses the name on second mention', () => {
  const input = 'A<ref name="src1">first body</ref> and B<ref name="src1" /> done.\n\n<references />';
  const output = transformRefs(input);
  // Two inline refs both pointing at [^src1]
  const matches = output.match(/\[\^src1\]/g);
  assert.equal(matches?.length, 3);   // 2 inline + 1 footnote definition
  assert.match(output, /\[\^src1\]: first body/);
});

test('removes <references /> entirely when there are no refs', () => {
  assert.equal(transformRefs('Body\n\n<references />'), 'Body');
});

test('handles ref bodies containing wikilinks and templates', () => {
  const input = 'A<ref>{{Cite vault|note=B.ged record I1}}</ref>\n\n<references />';
  const output = transformRefs(input);
  assert.match(output, /\[\^auto-1\]: \{\{Cite vault.*\}\}/);
});

test('passes through text with no refs', () => {
  assert.equal(transformRefs('Just plain.'), 'Just plain.');
});
