import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformColumnsList } from '../../src/transforms/columns-list.ts';

test('converts columns-list with body', () => {
  const input = `{{Columns-list|2|
* one
* two
* three
}}`;
  const output = transformColumnsList(input);
  assert.equal(output,
`:::columns-list{cols="2"}
* one
* two
* three
:::`);
});

test('passes through unrelated text', () => {
  assert.equal(transformColumnsList('plain'), 'plain');
});
