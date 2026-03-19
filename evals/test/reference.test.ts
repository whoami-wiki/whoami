import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeReference } from '../src/graders/reference.js';

const REFERENCE_PERSON = `{{Infobox Person
| name = Test Subject
| birth_date = 1990-01-01
| location = Mumbai
| sources = Facebook, WhatsApp
}}

Test Subject is a person documented through social media archives.

== Early life ==

Test Subject grew up in Mumbai.

== Career ==

Test Subject worked in technology.

== Personal life ==

Test Subject enjoys travel and photography.

== References ==

<references />

== Bibliography ==

* {{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive}}
* {{Cite vault | snapshot = whatsapp-export | type = whatsapp | description = WhatsApp archive}}

[[Category:People]]
[[Category:Mumbai residents]]
`;

describe('reference grader — content pages', () => {
  it('scores 1.0 when agent output matches reference exactly', () => {
    const result = gradeReference(REFERENCE_PERSON, REFERENCE_PERSON, 'person');
    assert.equal(result.grader, 'reference');
    assert.equal(result.score, 1);
    assert.equal(result.details.length, 4);
  });

  it('scores section heading coverage', () => {
    // Agent has 2 of 4 body headings (Early life, References, Bibliography missing Career and Personal life)
    const agent = `{{Infobox Person
| name = Test Subject
| birth_date = 1990-01-01
| location = Mumbai
| sources = Facebook, WhatsApp
}}

Test Subject is a person.

== Early life ==

Grew up in Mumbai.

== References ==

<references />

== Bibliography ==

* {{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive}}
* {{Cite vault | snapshot = whatsapp-export | type = whatsapp | description = WhatsApp archive}}

[[Category:People]]
[[Category:Mumbai residents]]
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const headings = result.details.find((d) => d.check.includes('Section heading'));
    assert.ok(headings);
    // 3 of 5 headings present (Early life, References, Bibliography) — missing Career and Personal life
    assert.ok(headings.note?.includes('/5'));
  });

  it('scores infobox field coverage', () => {
    // Agent has only 2 of 4 infobox fields
    const agent = `{{Infobox Person
| name = Test Subject
| location = Mumbai
}}

Test Subject is a person.

== Early life ==

Grew up in Mumbai.

== Career ==

Works in tech.

== Personal life ==

Enjoys travel.

== References ==

<references />

== Bibliography ==

* {{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive}}
* {{Cite vault | snapshot = whatsapp-export | type = whatsapp | description = WhatsApp archive}}

[[Category:People]]
[[Category:Mumbai residents]]
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const fields = result.details.find((d) => d.check.includes('Infobox field'));
    assert.ok(fields);
    assert.ok(fields.note?.includes('2/4'));
  });

  it('scores citation hash coverage', () => {
    // Agent has only 1 of 2 citation hashes
    const agent = `{{Infobox Person
| name = Test Subject
| birth_date = 1990-01-01
| location = Mumbai
| sources = Facebook, WhatsApp
}}

Test Subject is a person.

== Early life ==

Grew up in Mumbai.

== Career ==

Works in tech.

== Personal life ==

Enjoys travel.

== References ==

<references />

== Bibliography ==

* {{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive}}

[[Category:People]]
[[Category:Mumbai residents]]
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const hashes = result.details.find((d) => d.check.includes('Citation hash'));
    assert.ok(hashes);
    assert.ok(hashes.note?.includes('1/2'));
  });

  it('scores category coverage', () => {
    // Agent has only 1 of 2 categories
    const agent = `{{Infobox Person
| name = Test Subject
| birth_date = 1990-01-01
| location = Mumbai
| sources = Facebook, WhatsApp
}}

Test Subject is a person.

== Early life ==

Grew up in Mumbai.

== Career ==

Works in tech.

== Personal life ==

Enjoys travel.

== References ==

<references />

== Bibliography ==

* {{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive}}
* {{Cite vault | snapshot = whatsapp-export | type = whatsapp | description = WhatsApp archive}}

[[Category:People]]
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const cats = result.details.find((d) => d.check.includes('Category'));
    assert.ok(cats);
    assert.ok(cats.note?.includes('1/2'));
  });

  it('scores 0 for completely empty agent output', () => {
    const result = gradeReference('', REFERENCE_PERSON, 'person');
    assert.ok(result.score < 0.1);
  });

  it('works for talk pages', () => {
    const reference = `== Agent log ==\n\n=== Task: Write page ===\n\nDone.\n\n== Active gaps ==\n\n{{Open}} Missing data.`;
    const agent = `== Agent log ==\n\n=== Task: Write page ===\n\nCompleted.\n\n== Active gaps ==\n\n{{Open}} Gaps remain.`;
    const result = gradeReference(agent, reference, 'talk');
    assert.equal(result.grader, 'reference');
    // Both headings match
    const headings = result.details.find((d) => d.check.includes('Section heading'));
    assert.ok(headings);
    assert.ok(headings.passed);
  });
});

describe('reference grader — source pages', () => {
  const REFERENCE_SOURCE = `{{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive export}}

== Contents ==

This source page documents the Facebook data archive for Test Subject. It contains posts, messages, photos, and profile metadata exported from the platform.

=== Posts ===

Timeline posts and status updates.

=== Messages ===

Direct message conversations.

=== Photos ===

Uploaded photos and albums.

[[Category:Sources]]
`;

  it('scores 1.0 when agent matches reference exactly', () => {
    const result = gradeReference(REFERENCE_SOURCE, REFERENCE_SOURCE, 'source');
    assert.equal(result.grader, 'reference');
    assert.equal(result.score, 1);
    assert.equal(result.details.length, 2);
  });

  it('scores content length ratio', () => {
    // Agent output is shorter than reference
    const agent = `{{Cite vault | snapshot = facebook-export | type = facebook}}\n\nShort page.`;
    const result = gradeReference(agent, REFERENCE_SOURCE, 'source');
    const ratio = result.details.find((d) => d.check.includes('Content length'));
    assert.ok(ratio);
    assert.ok(ratio.penalty > 0);
  });

  it('caps content length ratio at 1.0 for longer output', () => {
    // Agent output is longer than reference
    const agent = REFERENCE_SOURCE + '\n\nExtra content here that makes this much longer than the reference. '.repeat(10);
    const result = gradeReference(agent, REFERENCE_SOURCE, 'source');
    const ratio = result.details.find((d) => d.check.includes('Content length'));
    assert.ok(ratio);
    assert.ok(ratio.note?.includes('100%'));
  });

  it('scores key line coverage', () => {
    // Agent has some but not all reference lines
    const agent = `{{Cite vault | snapshot = facebook-export | type = facebook | description = Facebook archive export}}

== Contents ==

This source page documents the Facebook data archive for Test Subject. It contains posts, messages, photos, and profile metadata exported from the platform.

=== Posts ===

Timeline posts and status updates.

[[Category:Sources]]
`;
    const result = gradeReference(agent, REFERENCE_SOURCE, 'source');
    const lines = result.details.find((d) => d.check.includes('Key line'));
    assert.ok(lines);
    // Not all lines are present but some are
    assert.ok(lines.penalty > 0);
    assert.ok(result.score > 0.3);
  });

  it('scores 0 for empty agent output against non-empty reference', () => {
    const result = gradeReference('', REFERENCE_SOURCE, 'source');
    assert.equal(result.score, 0);
  });
});
