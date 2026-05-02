import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformGap } from '../../src/transforms/gap.ts';

test('converts {{Gap|note}} to :::gap with body', () => {
  const input = '{{Gap|Need to confirm birth year}}';
  assert.equal(transformGap(input), ':::gap\nNeed to confirm birth year\n:::');
});

test('handles empty body {{Gap}}', () => {
  assert.equal(transformGap('{{Gap}}'), '::gap');
});

test('passes through unrelated text', () => {
  assert.equal(transformGap('plain'), 'plain');
});
