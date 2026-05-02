import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGedcomFile } from '../../src/gedcom/parser.ts';

const FIX = (n: string) => join(import.meta.dirname, 'fixtures', n);

test('parseGedcomFile: returns INDI and FAM records by id', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  assert.equal(result.individuals.size, 3);
  assert.equal(result.families.size, 1);
  assert.ok(result.individuals.has('I1'));
  assert.ok(result.families.has('F1'));
});

test('parseGedcomFile: rejects ANSEL-encoded GEDCOM', async () => {
  await assert.rejects(parseGedcomFile(FIX('ansel-rejected.ged')), /ANSEL/i);
});

test('parseGedcomFile: rejects when CHAR is missing', async () => {
  const tmpFile = join(import.meta.dirname, 'fixtures', '_tmp-no-char.ged');
  const { writeFileSync, unlinkSync } = await import('node:fs');
  writeFileSync(tmpFile, '0 HEAD\n0 @I1@ INDI\n1 NAME X /Y/\n0 TRLR\n');
  try {
    await assert.rejects(parseGedcomFile(tmpFile), /CHAR/i);
  } finally {
    unlinkSync(tmpFile);
  }
});

test('parseGedcomFile: each individual exposes its raw children tree', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const nameNode = i1.tree.find(n => n.tag === 'NAME');
  assert.equal(nameNode?.data, 'John /Doe/');
});
