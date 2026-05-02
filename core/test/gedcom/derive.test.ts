import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseGedcomFile } from '../../src/gedcom/parser.ts';
import { deriveIndividual } from '../../src/gedcom/derive.ts';

const FIX = (n: string) => join(import.meta.dirname, 'fixtures', n);

test('deriveIndividual: extracts name and birth', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const derived = deriveIndividual(i1, 'I1', result);
  assert.equal(derived.record, 'I1');
  assert.equal(derived.name, 'John Doe');
  assert.deepEqual(derived.birth, { date: '12 JAN 1950', place: 'Pittsburgh, PA, USA' });
  assert.equal(derived.death, null);
});

test('deriveIndividual: name handles "/Surname/" wrapper', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i2 = result.individuals.get('I2')!;
  const derived = deriveIndividual(i2, 'I2', result);
  assert.equal(derived.name, 'Jane Doe');
});

test('deriveIndividual: birth without place keeps place null', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i2 = result.individuals.get('I2')!;
  const derived = deriveIndividual(i2, 'I2', result);
  assert.deepEqual(derived.birth, { date: '5 MAR 1952', place: null });
});

test('deriveIndividual: extracts parents from FAMC', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const child = result.individuals.get('I3')!;
  const derived = deriveIndividual(child, 'I3', result);
  const records = derived.parents.map(p => p.record).sort();
  assert.deepEqual(records, ['I1', 'I2']);
  const names = derived.parents.map(p => p.name).sort();
  assert.deepEqual(names, ['Jane Doe', 'John Doe']);
});

test('deriveIndividual: returns empty parents for top of tree', async () => {
  const result = await parseGedcomFile(FIX('tiny.ged'));
  const i1 = result.individuals.get('I1')!;
  const derived = deriveIndividual(i1, 'I1', result);
  assert.deepEqual(derived.parents, []);
});
