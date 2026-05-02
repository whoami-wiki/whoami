import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformInfoboxPerson } from '../../src/transforms/infobox-person.ts';

test('converts a multi-line Infobox person to a block directive with YAML body', () => {
  const input = `{{Infobox person
| name = Abby Rickelman
| born = 1991
| spouse = [[Thomas Vincent Campanella]]
| relationship = Steven's first cousin (maternal)
}}`;
  const output = transformInfoboxPerson(input);
  assert.equal(output,
`:::infobox-person
name: Abby Rickelman
born: 1991
spouse: "[[Thomas Vincent Campanella]]"
relationship: "Steven's first cousin (maternal)"
:::`);
});

test('skips empty values', () => {
  const input = `{{Infobox person
| name = X
| born =
| died =
}}`;
  const output = transformInfoboxPerson(input);
  assert.match(output, /name: X/);
  assert.doesNotMatch(output, /^born:/m);
  assert.doesNotMatch(output, /^died:/m);
});

test('preserves wikilinks inside values verbatim', () => {
  const input = '{{Infobox person\n| father = [[Yaroslav Steven Rickelman]]\n}}';
  const output = transformInfoboxPerson(input);
  assert.match(output, /father: "\[\[Yaroslav Steven Rickelman\]\]"/);
});

test('passes through text without Infobox person', () => {
  assert.equal(transformInfoboxPerson('plain'), 'plain');
});
