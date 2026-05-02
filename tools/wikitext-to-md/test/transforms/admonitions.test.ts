import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformAdmonitions } from '../../src/transforms/admonitions.ts';

test('converts {{Open}} to :::open:::', () => {
  assert.equal(transformAdmonitions('{{Open}}'), ':::open:::');
});

test('converts {{Closed}} to :::closed:::', () => {
  assert.equal(transformAdmonitions('{{Closed}}'), ':::closed:::');
});

test('converts {{Superseded}} to :::superseded:::', () => {
  assert.equal(transformAdmonitions('{{Superseded}}'), ':::superseded:::');
});

test('handles all three on one page', () => {
  const input = '{{Open}}\n\n{{Closed}}\n\n{{Superseded}}';
  const output = transformAdmonitions(input);
  assert.match(output, /:::open:::/);
  assert.match(output, /:::closed:::/);
  assert.match(output, /:::superseded:::/);
});

test('passes through unrelated text', () => {
  assert.equal(transformAdmonitions('plain'), 'plain');
});
