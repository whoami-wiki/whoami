import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertPage } from '../src/pipeline.ts';
import type { RawPage } from '../src/types.ts';

const HASH = 'a1a48f25952a3294';
const OWNER = 'steven';

test('converts a person page end-to-end', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'Abby Rickelman',
    text: `{{Infobox person
| name = Abby Rickelman
| born = 1991
}}

'''Abby Rickelman''' (born 1991) is a first cousin of [[Steven Barash]].

== References ==
<references />

== Bibliography ==

{{Cite vault|type=genealogy|snapshot=barash-tree|note=Barash Family Tree.ged record I123}}

[[Category:People]]
[[Category:Family]]`,
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  if (out.kind !== 'page') throw new Error('expected page');
  assert.match(out.md, /^---/);
  assert.match(out.md, /title: Abby Rickelman/);
  assert.match(out.md, /categories: \[People, Family\]/);
  assert.match(out.md, /gedcom:\n  file: barash-tree\.ged\n  record: I123\n  snapshot: a1a48f25952a3294/);
  assert.match(out.md, /:::infobox-person/);
  assert.match(out.md, /:::cite-vault\{type="genealogy"/);
  // Note: '''Abby Rickelman''' should now be transformed to **Abby Rickelman**
  // because Task 20 (bold-italic) is in the pipeline.
  assert.match(out.md, /\*\*Abby Rickelman\*\* \(born 1991\) is a first cousin of \[\[Steven Barash\]\]\./);
  assert.equal(out.warnings.length, 0);
});

test('returns a redirect record when body is just #REDIRECT', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'Me',
    text: '#REDIRECT [[Steven Barash]]',
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  assert.equal(out.kind, 'redirect');
  if (out.kind === 'redirect') {
    assert.equal(out.target, 'Steven Barash');
    assert.equal(out.fromTitle, 'Me');
  }
});

test('warns when Cite vault note= is malformed', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'Page',
    text: 'Body. {{Cite vault|note=No id here}} [[Category:People]]',
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  assert.equal(out.kind, 'page');
  if (out.kind !== 'page') throw new Error('expected page');
  assert.equal(out.warnings.length, 1);
  assert.equal(out.warnings[0]!.kind, 'malformed-cite-vault');
});

test('strips category lines from body but preserves narrative', () => {
  const raw: RawPage = {
    namespace: 0,
    title: 'P',
    text: 'Body line.\n\n[[Category:Family]]\n',
    createdAt: '20260429140700',
  };
  const out = convertPage(raw, HASH, OWNER);
  if (out.kind !== 'page') throw new Error('expected page');
  assert.match(out.md, /Body line\./);
  assert.doesNotMatch(out.md, /\[\[Category:Family\]\]/);
});
