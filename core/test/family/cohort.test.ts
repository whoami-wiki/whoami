import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCohort } from '../../src/family/cohort.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

function person(record: string, name: string, patch: Partial<DerivedRecord> = {}): DerivedRecord {
  return {
    record,
    name,
    birth: null,
    death: null,
    parents: [],
    spouses: [],
    children: [],
    residences: [],
    occupations: [],
    sources: [],
    ...patch,
  };
}

test('computeCohort: full sibling shares both parents', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IM', name: 'Mom', role: 'mother' },
      ],
    })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Sibling', born: null },
    ] })],
    ['IM', person('IM', 'Mom', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Sibling', born: null },
    ] })],
    ['I2', person('I2', 'Sibling', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IM', name: 'Mom', role: 'mother' },
      ],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.siblings.length, 1);
  assert.equal(result.siblings[0]!.record, 'I2');
  assert.equal(result.siblings[0]!.kind, 'full');
});
