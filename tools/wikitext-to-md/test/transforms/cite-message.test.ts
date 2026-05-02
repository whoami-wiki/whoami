import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformCiteMessage } from '../../src/transforms/cite-message.ts';

test('converts cite message to directive', () => {
  const input = '{{Cite message|snapshot=vault-2024-03|date=2024-03-15|thread=Mom}}';
  const output = transformCiteMessage(input);
  assert.equal(
    output,
    '::cite-message{snapshot="vault-2024-03" date="2024-03-15" thread="Mom"}'
  );
});

test('passes through unrelated text', () => {
  assert.equal(transformCiteMessage('plain'), 'plain');
});
