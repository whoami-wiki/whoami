import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageContent } from '../src/graders/parse-page.js';

test('parsePageContent: extracts container directives with attrs and body', () => {
  const md = `
Some prose.

:::cite-vault{type=photo snapshot=abc123 note="From the WhatsApp export"}
:::

More prose.

:::infobox-person
name: Jane Doe
birth: 1991-03-04
:::
`;
  const out = parsePageContent(md);
  const cite = out.directives.find(d => d.name === 'cite-vault');
  assert.ok(cite, 'cite-vault directive found');
  assert.equal(cite!.attrs.type, 'photo');
  assert.equal(cite!.attrs.snapshot, 'abc123');
  assert.match(cite!.attrs.note ?? '', /WhatsApp/);

  const ibox = out.directives.find(d => d.name === 'infobox-person');
  assert.ok(ibox, 'infobox-person directive found');
  assert.match(ibox!.body ?? '', /name: Jane Doe/);
  assert.match(ibox!.body ?? '', /birth: 1991-03-04/);
});

test('parsePageContent: extracts leaf directives', () => {
  const md = `
::open

Some open question.

::closed
`;
  const out = parsePageContent(md);
  assert.equal(out.directives.filter(d => d.name === 'open').length, 1);
  assert.equal(out.directives.filter(d => d.name === 'closed').length, 1);
});

test('parsePageContent: extracts headings with depth', () => {
  const md = `
# Title

## Background

Some prose.

### Education

More prose.
`;
  const out = parsePageContent(md);
  assert.deepEqual(
    out.headings.map(h => ({ depth: h.depth, text: h.text })),
    [
      { depth: 1, text: 'Title' },
      { depth: 2, text: 'Background' },
      { depth: 3, text: 'Education' },
    ],
  );
});

test('parsePageContent: extracts wikilinks', () => {
  const md = 'See [[Jane Doe]] and [[Tempelhof Disaster|the disaster]] for details.';
  const out = parsePageContent(md);
  assert.deepEqual(out.wikilinks, [
    { target: 'Jane Doe' },
    { target: 'Tempelhof Disaster', alt: 'the disaster' },
  ]);
});

test('parsePageContent: empty input → empty arrays', () => {
  const out = parsePageContent('');
  assert.deepEqual(out.directives, []);
  assert.deepEqual(out.headings, []);
  assert.deepEqual(out.wikilinks, []);
});

test('parsePageContent: malformed directive (no closing fence) is tolerated', () => {
  const md = `
:::cite-vault{type=photo}
no close fence here
`;
  // Should not throw; partial extraction is acceptable
  const out = parsePageContent(md);
  assert.ok(Array.isArray(out.directives));
});
