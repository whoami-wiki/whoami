import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCiteVaultRef } from '../../src/extractors/cite-vault-ref.ts';

const HASH = 'a1a48f25952a3294';

test('lifts gedcom record from a Cite vault note=', () => {
  const text = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I28906361734}}';
  assert.deepEqual(
    extractCiteVaultRef(text, HASH),
    { ref: { file: 'barash-tree.ged', record: 'I28906361734', snapshot: HASH }, warning: null }
  );
});

test('handles spaces and slashes in the .ged filename', () => {
  const text = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I12345}}';
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref?.file, 'barash-tree.ged');
});

test('only the FIRST cite-vault on the page is lifted', () => {
  const text = `
First: {{Cite vault|note=A.ged record I1}}
Second: {{Cite vault|note=B.ged record I2}}
`;
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref?.record, 'I1');
});

test('returns null when no Cite vault is present', () => {
  assert.deepEqual(extractCiteVaultRef('plain body', HASH), { ref: null, warning: null });
});

test('returns a warning when Cite vault has malformed note (no record I…)', () => {
  const text = '{{Cite vault|type=genealogy|snapshot=barash-tree|note=Some narrative without an id}}';
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref, null);
  assert.equal(out.warning?.kind, 'malformed-cite-vault');
});

test('slugifies the .ged filename to match the canonical install path', () => {
  const text = '{{Cite vault|note=Barash Family Tree.ged record I1}}';
  const out = extractCiteVaultRef(text, HASH);
  assert.equal(out.ref?.file, 'barash-tree.ged');  // canonical
});
