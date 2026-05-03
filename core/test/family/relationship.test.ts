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

test('computeRelationship: grandparent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', { parents: [{ record: 'IF', name: 'Dad', role: 'father' }] })],
    ['IF', person('IF', 'Dad', { parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }] })],
    ['IPGF', person('IPGF', 'Grandpa')],
  ]);
  const r = computeRelationship({ records, fromRecord: 'I1', toRecord: 'IPGF' });
  assert.equal(r?.label, 'grandfather');
});
