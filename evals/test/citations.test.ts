import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeCitations, parseCitations, findUncitedClaims } from '../src/graders/citations.js';

describe('parseCitations (markdown)', () => {
  it('parses a vault citation leaf directive', () => {
    const md = '::cite-vault{type=photo snapshot=abc123 note="From the export"}';
    const citations = parseCitations(md);
    assert.equal(citations.length, 1);
    assert.equal(citations[0]!.template, 'vault');
    assert.equal(citations[0]!.fields.type, 'photo');
    assert.equal(citations[0]!.fields.snapshot, 'abc123');
    assert.match(citations[0]!.fields.note ?? '', /export/);
  });

  it('parses a message citation', () => {
    const md = '::cite-message{snapshot=def456 date=2024-01-01 thread=Alice note="DM"}';
    const citations = parseCitations(md);
    assert.equal(citations.length, 1);
    assert.equal(citations[0]!.template, 'message');
    assert.equal(citations[0]!.fields.snapshot, 'def456');
    assert.equal(citations[0]!.fields.thread, 'Alice');
  });

  it('parses multiple citations in body', () => {
    const md = `
::cite-vault{snapshot=a date=2024-01-01 type=photo}

::cite-message{snapshot=b date=2024-02-01 thread=Bob}
`;
    const citations = parseCitations(md);
    assert.equal(citations.length, 2);
  });

  it('parses citations adjacent to claims (footnote-ref pattern)', () => {
    const md = `
Alice was born in 1990.[^a]

::cite-vault{snapshot=H date=1990-03-15 type=record}
`;
    const citations = parseCitations(md);
    assert.equal(citations.length, 1);
    assert.equal(citations[0]!.template, 'vault');
    assert.equal(citations[0]!.fields.snapshot, 'H');
  });

  it('returns empty for no citations', () => {
    const citations = parseCitations('Just prose. [[A wikilink]]. ## A heading');
    assert.deepEqual(citations, []);
  });
});

describe('gradeCitations (markdown)', () => {
  it('full score for body with all valid citations', () => {
    const md = `
A claim.[^a]

::cite-vault{snapshot=abc date=2024-01-01 type=photo}
`;
    const result = gradeCitations(md);
    assert.equal(result.grader, 'citations');
    assert.ok(result.score > 0.9);
  });

  it('penalizes missing required fields', () => {
    const md = '::cite-vault{type=photo}';
    const result = gradeCitations(md);
    assert.ok(result.score < 1, 'expected score < 1 for missing fields');
  });

  it('penalizes unknown template', () => {
    const md = '::cite-bogus{snapshot=x date=2024}';
    const result = gradeCitations(md);
    assert.ok(result.score < 1, 'expected score < 1 for unknown template');
  });
});

describe('findUncitedClaims', () => {
  it('flags sentences with date-shaped claims that lack a footnote ref', () => {
    const md = 'Alice was born on March 15, 1990. She moved to Berlin in 2015.';
    const flagged = findUncitedClaims(md);
    assert.ok(flagged.length >= 1);
  });

  it('does not flag claims that have a footnote ref', () => {
    const md = 'Alice was born on March 15, 1990.[^a]\n\n::cite-vault{snapshot=x date=1990-03-15 type=record}';
    const flagged = findUncitedClaims(md);
    assert.equal(flagged.length, 0);
  });
});
