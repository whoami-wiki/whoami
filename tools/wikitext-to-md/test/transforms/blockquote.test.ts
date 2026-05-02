import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformBlockquote } from '../../src/transforms/blockquote.ts';

test('converts blockquote with attribution', () => {
  const input = `{{Blockquote|We slept on a Greyhound.|Apara, October 2018}}`;
  const output = transformBlockquote(input);
  assert.equal(output,
`:::blockquote{by="Apara, October 2018"}
We slept on a Greyhound.
:::`);
});

test('converts blockquote without attribution', () => {
  const input = `{{Blockquote|Some quote.}}`;
  const output = transformBlockquote(input);
  assert.equal(output, ':::blockquote\nSome quote.\n:::');
});

test('passes through unrelated text', () => {
  assert.equal(transformBlockquote('plain'), 'plain');
});
