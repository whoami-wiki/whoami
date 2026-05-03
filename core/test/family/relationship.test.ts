import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRelationship } from '../../src/family/relationship.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

function person(record: string, name: string, patch: Partial<DerivedRecord> = {}): DerivedRecord {
  return {
    record, name,
    birth: null, death: null,
    parents: [], spouses: [], children: [],
    residences: [], occupations: [], sources: [],
    ...patch,
  };
}

test('computeRelationship: self', () => {
  const records = new Map<string, DerivedRecord>([['I1', person('I1', 'Self')]]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I1' });
  assert.equal(r?.label, 'self');
});

test('computeRelationship: parent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { children: [{ record: 'I1', name: 'Self', born: null }] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IF' });
  assert.equal(r?.label, 'father');
});

test('computeRelationship: child (inverse of parent)', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { children: [{ record: 'I1', name: 'Self', born: null }] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'IF', toRecord: 'I1' });
  assert.equal(r?.label, 'child');
});

test('computeRelationship: maternal grandfather is grandfather, not grandmother', () => {
  // Regression: gender should come from the last hop, not the first.
  // Self → Mom (mother) → Mom's father (father) = grandfather, not grandmother.
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IM', name: 'Mom', role: 'mother' }] })],
    ['IM', person('IM', 'Mom', { parents: [{ record: 'IMG', name: 'MaternalGrandpa', role: 'father' }] })],
    ['IMG', person('IMG', 'MaternalGrandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IMG' });
  assert.equal(r?.label, 'grandfather');
});

test('computeRelationship: grandparent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IPGF' });
  assert.equal(r?.label, 'grandfather');
});

test('computeRelationship: sibling', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['I2', person('I2', 'Sibling', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Sibling', born: null },
    ] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I2' });
  assert.equal(r?.label, 'sibling');
});

test('computeRelationship: aunt/uncle', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IA' });
  assert.equal(r?.label, 'aunt or uncle');
});

test('computeRelationship: niece/nephew (inverse)', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'IA', toRecord: 'I1' });
  assert.equal(r?.label, 'niece or nephew');
});

test('computeRelationship: first cousin', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IC', person('IC', 'Cousin', { parents: [{ record: 'IA', name: 'Aunt', role: 'mother' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IC' });
  assert.equal(r?.label, 'first cousin');
});

test('computeRelationship: first cousin once removed', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IC1', person('IC1', 'Cousin', { parents: [{ record: 'IA', name: 'Aunt', role: 'mother' }] })],
    ['IC2', person('IC2', 'CousinChild', { parents: [{ record: 'IC1', name: 'Cousin', role: 'mother' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IA', person('IA', 'Aunt', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IC2' });
  assert.equal(r?.label, 'first cousin once removed');
});

test('computeRelationship: second cousin', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa', { parents: [{ record: 'IGG', name: 'GreatGrandpa', role: 'father' }] })],
    ['IGG', person('IGG', 'GreatGrandpa')],
    ['I2', person('I2', '2C', { parents: [{ record: 'I2P', name: 'P2', role: 'father' }] })],
    ['I2P', person('I2P', 'P2', { parents: [{ record: 'I2GP', name: 'GP2', role: 'father' }] })],
    ['I2GP', person('I2GP', 'GP2', { parents: [{ record: 'IGG', name: 'GreatGrandpa', role: 'father' }] })],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I2' });
  assert.equal(r?.label, 'second cousin');
});

test('computeRelationship: unrelated returns null', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self')],
    ['I2', person('I2', 'Stranger')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'I2' });
  assert.equal(r, null);
});

test('computeRelationship: missing from-record returns null', () => {
  const records = new Map<string, DerivedRecord>([['I2', person('I2', 'Other')]]);
  const r = computeRelationship({ records, fromRecord: 'I999', toRecord: 'I2' });
  assert.equal(r, null);
});
