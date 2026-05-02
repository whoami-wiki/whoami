import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformBoldItalic } from '../../src/transforms/bold-italic.ts';

test("converts bold ''' to **", () => {
  assert.equal(transformBoldItalic("'''Steven Barash'''"), '**Steven Barash**');
});

test("converts italic '' to *", () => {
  assert.equal(transformBoldItalic("''nickname''"), '*nickname*');
});

test("converts bold-italic ''''' to ***", () => {
  assert.equal(transformBoldItalic("'''''both'''''"), '***both***');
});

test('handles bold and italic in same line', () => {
  assert.equal(transformBoldItalic("'''bold''' and ''italic''"), '**bold** and *italic*');
});

test('preserves unmatched apostrophes', () => {
  assert.equal(transformBoldItalic("Steven's first cousin"), "Steven's first cousin");
});

test('handles bold across multiple words', () => {
  assert.equal(transformBoldItalic("'''Pittsburgh (Squirrel Hill, 6730 Beacon St)'''"), '**Pittsburgh (Squirrel Hill, 6730 Beacon St)**');
});
