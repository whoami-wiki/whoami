import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeCitations, parseCitations, findUncitedClaims } from '../src/graders/citations.js';

describe('parseCitations', () => {
  it('parses a valid photo citation', () => {
    const wikitext = '{{Cite photo | hash = abc123 | date = 2024-03-15 | snapshot = snap1}}';
    const citations = parseCitations(wikitext);
    assert.equal(citations.length, 1);
    assert.equal(citations[0].template, 'photo');
    assert.equal(citations[0].fields['hash'], 'abc123');
    assert.equal(citations[0].fields['date'], '2024-03-15');
  });

  it('parses a valid message citation', () => {
    const wikitext = '{{Cite message | hash = def456 | date = 2024-01-01 | author = Alice}}';
    const citations = parseCitations(wikitext);
    assert.equal(citations.length, 1);
    assert.equal(citations[0].template, 'message');
    assert.equal(citations[0].fields['author'], 'Alice');
  });

  it('parses multiple citations', () => {
    const wikitext = `Text {{Cite photo | hash = a | date = 2024-01-01}} more text {{Cite message | hash = b | date = 2024-02-01 | author = Bob}}`;
    const citations = parseCitations(wikitext);
    assert.equal(citations.length, 2);
  });

  it('returns empty array for no citations', () => {
    const citations = parseCitations('Just some text with no citations.');
    assert.equal(citations.length, 0);
  });
});

describe('findUncitedClaims', () => {
  it('finds uncited factual sentences', () => {
    const wikitext = `Jeremy visited Paris in January 2024. He took many photos of the Eiffel Tower.`;
    const uncited = findUncitedClaims(wikitext);
    assert.ok(uncited.length > 0);
  });

  it('ignores sentences with nearby ref tags', () => {
    const wikitext = `Jeremy visited Paris in January 2024.<ref>{{Cite photo | hash = x | date = 2024-01-01}}</ref>`;
    const uncited = findUncitedClaims(wikitext);
    assert.equal(uncited.length, 0);
  });

  it('ignores headings and templates', () => {
    const wikitext = `== January 2024 ==\n\n{{Infobox Person | name = Jeremy}}`;
    const uncited = findUncitedClaims(wikitext);
    assert.equal(uncited.length, 0);
  });

  it('ignores file and image embeds', () => {
    const wikitext = `[[File:Cdmx-2022-03-26-dfw-transit.jpg|thumb|Transit-day photo geotagged near Dallas-Fort Worth, 2022-03-26 16:00.]]`;
    const uncited = findUncitedClaims(wikitext);
    assert.equal(uncited.length, 0);
  });
});

describe('citations grader', () => {
  it('scores 1.0 for all valid citations with no uncited claims', () => {
    const wikitext = `Text.<ref>{{Cite photo | hash = abc | date = 2024-01-01}}</ref> More text.<ref>{{Cite message | hash = def | date = 2024-02-01 | author = Alice}}</ref>`;
    const result = gradeCitations(wikitext);
    assert.equal(result.grader, 'citations');
    assert.equal(result.score, 1);
  });

  it('scores 0 for no citations', () => {
    const result = gradeCitations('Just text with no citations at all.');
    assert.equal(result.score, 0);
  });

  it('penalizes citations with missing required fields', () => {
    const wikitext = `{{Cite photo | hash = abc}}`;
    const result = gradeCitations(wikitext);
    assert.ok(result.score < 1);
  });

  it('penalizes unknown template names', () => {
    const wikitext = `{{Cite unknown | hash = abc | date = 2024-01-01}}`;
    const result = gradeCitations(wikitext);
    assert.ok(result.score < 1);
    const templateCheck = result.details.find((d) => d.check.includes('Template'));
    assert.ok(templateCheck);
    assert.equal(templateCheck.passed, false);
  });

  it('accepts snapshot as alternative to hash', () => {
    const wikitext = `{{Cite photo | snapshot = snap1 | date = 2024-01-01}}`;
    const result = gradeCitations(wikitext);
    assert.equal(result.score, 1);
  });

  it('penalizes missing type-specific fields', () => {
    // Voice note without speaker field
    const wikitext = `{{Cite voice note | hash = abc | date = 2024-01-01}}`;
    const result = gradeCitations(wikitext);
    assert.ok(result.score < 1);
  });

  it('scores 1.0 for message citation without author', () => {
    // Per spec, Cite message has no author field
    const wikitext = `{{Cite message | snapshot = snap1 | date = 2024-01-01 | thread = thread_1 | note = test}}`;
    const result = gradeCitations(wikitext);
    assert.equal(result.score, 1);
  });

  it('accepts vault citation with timestamp instead of date', () => {
    const wikitext = `{{Cite vault | type = messages | snapshot = snap1 | timestamp = 2021-03-01/2022-05-15 | note = DM thread}}`;
    const result = gradeCitations(wikitext);
    assert.equal(result.score, 1);
  });

  it('handles mixed valid and invalid citations', () => {
    const wikitext = `{{Cite photo | hash = abc | date = 2024-01-01}} {{Cite badtype | hash = def | date = 2024-02-01}}`;
    const result = gradeCitations(wikitext);
    assert.equal(result.score, 0.5);
  });
});
