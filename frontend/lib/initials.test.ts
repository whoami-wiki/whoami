import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials } from './initials';

test('initials: first and last name', () => {
  assert.equal(initials('Steven Barash'), 'SB');
});

test('initials: middle names ignored', () => {
  assert.equal(initials('Steven Nicholas Barash'), 'SB');
});

test('initials: single name returns one letter', () => {
  assert.equal(initials('Madonna'), 'M');
});

test('initials: empty/whitespace returns ?', () => {
  assert.equal(initials(''), '?');
  assert.equal(initials('   '), '?');
});

test('initials: handles diacritics', () => {
  assert.equal(initials('Élise Müller'), 'ÉM');
});
