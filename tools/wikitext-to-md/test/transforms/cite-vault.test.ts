import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformCiteVault } from '../../src/transforms/cite-vault.ts';

test('converts a basic cite vault to a directive', () => {
  const input = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I123}}';
  const output = transformCiteVault(input);
  assert.equal(
    output,
    ':::cite-vault{type="genealogy" snapshot="barash-tree" note="Barash Family Tree.ged record I123"}:::'
  );
});

test('preserves args when only note= is set', () => {
  const input = '{{Cite vault|note=hello}}';
  const output = transformCiteVault(input);
  assert.equal(output, ':::cite-vault{note="hello"}:::');
});

test('handles multiple cite vaults on one page', () => {
  const input = '{{Cite vault|note=A}}\n\nMore text.\n\n{{Cite vault|note=B}}';
  const output = transformCiteVault(input);
  assert.match(output, /:::cite-vault\{note="A"\}:::/);
  assert.match(output, /:::cite-vault\{note="B"\}:::/);
});

test('escapes double quotes inside arg values', () => {
  const input = '{{Cite vault|note=She said "hi"}}';
  const output = transformCiteVault(input);
  assert.match(output, /note="She said \\"hi\\""/);
});

test('passes through text without any cite vault', () => {
  assert.equal(transformCiteVault('plain text'), 'plain text');
});
