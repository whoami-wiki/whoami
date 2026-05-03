import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDescendants } from '../../src/family/descendants.ts';
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

test('computeDescendants: direct children form generation 1', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [
      { record: 'I2', name: 'A', born: null },
      { record: 'I3', name: 'B', born: null },
    ] })],
    ['I2', person('I2', 'A')],
    ['I3', person('I3', 'B')],
  ]);

  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 2);
  assert.equal(result.byGeneration.length, 1);
  assert.equal(result.byGeneration[0]!.generation, 1);
  assert.deepEqual(result.byGeneration[0]!.people.map(p => p.record), ['I2', 'I3']);
  assert.equal(result.byGeneration[0]!.people[0]!.via.parentName, 'Root');
});
