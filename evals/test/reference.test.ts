import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeReference } from '../src/graders/reference.js';

const REFERENCE_PERSON = `:::infobox-person
name: Test Subject
birth_date: 1990-01-01
location: Mumbai
sources: Facebook, WhatsApp
:::

Test Subject is a person documented through social media archives.

## Early life

Test Subject grew up in Mumbai.

## Career

Test Subject worked in technology.

## Personal life

Test Subject enjoys travel and photography.

## References

::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive"}
::cite-vault{snapshot=whatsapp-export type=whatsapp description="WhatsApp archive"}
`;

describe('reference grader — content pages', () => {
  it('scores 1.0 when agent output matches reference exactly', () => {
    const result = gradeReference(REFERENCE_PERSON, REFERENCE_PERSON, 'person');
    assert.equal(result.grader, 'reference');
    assert.equal(result.score, 1);
    // Three checks: headings, infobox fields, citation snapshots
    assert.equal(result.details.length, 3);
  });

  it('scores section heading coverage', () => {
    // Agent has 2 of 4 reference headings (missing Career, Personal life)
    const agent = `:::infobox-person
name: Test Subject
birth_date: 1990-01-01
location: Mumbai
sources: Facebook, WhatsApp
:::

Test Subject is a person.

## Early life

Grew up in Mumbai.

## References

::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive"}
::cite-vault{snapshot=whatsapp-export type=whatsapp description="WhatsApp archive"}
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const headings = result.details.find((d) => d.check.toLowerCase().includes('headings'));
    assert.ok(headings);
    // Reference has 4 level-2 headings (Early life, Career, Personal life, References)
    assert.ok(headings.check.includes('/4'), `expected '/4' in ${headings.check}`);
  });

  it('scores infobox field coverage', () => {
    // Agent has only 2 of 4 infobox fields
    const agent = `:::infobox-person
name: Test Subject
location: Mumbai
:::

Test Subject is a person.

## Early life

Grew up in Mumbai.

## Career

Works in tech.

## Personal life

Enjoys travel.

## References

::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive"}
::cite-vault{snapshot=whatsapp-export type=whatsapp description="WhatsApp archive"}
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const fields = result.details.find((d) => d.check.toLowerCase().includes('infobox'));
    assert.ok(fields);
    assert.ok(fields.check.includes('2/4'), `expected '2/4' in ${fields.check}`);
  });

  it('scores citation snapshot coverage', () => {
    // Agent has only 1 of 2 citation snapshots
    const agent = `:::infobox-person
name: Test Subject
birth_date: 1990-01-01
location: Mumbai
sources: Facebook, WhatsApp
:::

Test Subject is a person.

## Early life

Grew up in Mumbai.

## Career

Works in tech.

## Personal life

Enjoys travel.

## References

::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive"}
`;
    const result = gradeReference(agent, REFERENCE_PERSON, 'person');
    const snapshots = result.details.find((d) => d.check.toLowerCase().includes('snapshot'));
    assert.ok(snapshots);
    assert.ok(snapshots.check.includes('1/2'), `expected '1/2' in ${snapshots.check}`);
  });

  it('scores 0 for completely empty agent output', () => {
    const result = gradeReference('', REFERENCE_PERSON, 'person');
    assert.ok(result.score < 0.1);
  });

  it('works for talk pages', () => {
    const reference = `## Agent log\n\n### Task: Write page\n\nDone.\n\n## Active gaps\n\n::open\n\nMissing data.`;
    const agent = `## Agent log\n\n### Task: Write page\n\nCompleted.\n\n## Active gaps\n\n::open\n\nGaps remain.`;
    const result = gradeReference(agent, reference, 'talk');
    assert.equal(result.grader, 'reference');
    // Both level-2 headings (Agent log, Active gaps) match
    const headings = result.details.find((d) => d.check.toLowerCase().includes('headings'));
    assert.ok(headings);
    assert.ok(headings.passed);
  });
});

describe('reference grader — source pages', () => {
  const REFERENCE_SOURCE = `::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive export"}

## Contents

This source page documents the Facebook data archive for Test Subject. It contains posts, messages, photos, and profile metadata exported from the platform.

### Posts

Timeline posts and status updates.

### Messages

Direct message conversations.

### Photos

Uploaded photos and albums.
`;

  it('scores 1.0 when agent matches reference exactly', () => {
    const result = gradeReference(REFERENCE_SOURCE, REFERENCE_SOURCE, 'source');
    assert.equal(result.grader, 'reference');
    assert.equal(result.score, 1);
    // Source grader emits a single overlap check
    assert.equal(result.details.length, 1);
  });

  it('penalizes missing headings', () => {
    // Agent omits the Contents heading entirely
    const agent = `::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive"}\n\nShort page with no level-2 headings.`;
    const result = gradeReference(agent, REFERENCE_SOURCE, 'source');
    const overlap = result.details[0]!;
    assert.ok(overlap.penalty > 0);
    assert.ok(result.score < 1);
  });

  it('treats matching headings as a full score', () => {
    // Agent has the same level-2 heading
    const agent = `::cite-vault{snapshot=facebook-export type=facebook description="Facebook archive"}\n\n## Contents\n\nMinimal but matches.`;
    const result = gradeReference(agent, REFERENCE_SOURCE, 'source');
    assert.equal(result.score, 1);
  });

  it('scores 0 for empty agent output against non-empty reference', () => {
    const result = gradeReference('', REFERENCE_SOURCE, 'source');
    assert.equal(result.score, 0);
  });
});
