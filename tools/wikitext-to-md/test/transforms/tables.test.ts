import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformTables } from '../../src/transforms/tables.ts';

test('converts a simple wikitable to a markdown pipe table', () => {
  const input = `{| class="wikitable"
! Property !! Value
|-
| Type    || Person
|-
| Born    || 1991
|}`;
  const output = transformTables(input);
  assert.equal(output, [
    '| Property | Value  |',
    '| -------- | ------ |',
    '| Type     | Person |',
    '| Born     | 1991   |',
  ].join('\n'));
});

test('falls back to raw HTML when table has rowspan or colspan', () => {
  const input = `{| class="wikitable"
! A !! B
|-
| rowspan=2 | merged || top
|-
| bottom
|}`;
  const output = transformTables(input);
  assert.match(output, /^<table/);
  assert.match(output, /rowspan="?2"?/);
});

test('passes through text with no tables', () => {
  assert.equal(transformTables('plain'), 'plain');
});
