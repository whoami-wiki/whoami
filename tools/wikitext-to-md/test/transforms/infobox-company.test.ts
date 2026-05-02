import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformInfoboxCompany } from '../../src/transforms/infobox-company.ts';

test('converts a multi-line Infobox company to a block directive', () => {
  const input = `{{Infobox company
| name = Descope
| founded = 2022
| industry = Authentication
}}`;
  const output = transformInfoboxCompany(input);
  assert.equal(output,
`:::infobox-company
name: Descope
founded: 2022
industry: Authentication
:::`);
});

test('passes through text without Infobox company', () => {
  assert.equal(transformInfoboxCompany('plain'), 'plain');
});
