import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformDialogue } from '../../src/transforms/dialogue.ts';

test('converts dialogue to block directive with body', () => {
  const input = `{{Dialogue|Alex|"That changed everything."}}`;
  const output = transformDialogue(input);
  assert.equal(output,
`:::dialogue{speaker="Alex"}
"That changed everything."
:::`);
});

test('handles missing speaker (positional 1 empty)', () => {
  const input = `{{Dialogue||Just a quote.}}`;
  const output = transformDialogue(input);
  assert.match(output, /:::dialogue\{\}\n/);
  assert.match(output, /Just a quote\./);
});

test('passes through text without dialogue', () => {
  assert.equal(transformDialogue('plain'), 'plain');
});
