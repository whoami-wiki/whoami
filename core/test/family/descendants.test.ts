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

test('computeDescendants: walks multiple generations with via attribution', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'Child', born: null }] })],
    ['I2', person('I2', 'Child', { children: [{ record: 'I3', name: 'Grandchild', born: null }] })],
    ['I3', person('I3', 'Grandchild', { children: [{ record: 'I4', name: 'Great', born: null }] })],
    ['I4', person('I4', 'Great')],
  ]);

  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 3);
  assert.equal(result.byGeneration.length, 3);
  assert.equal(result.byGeneration[0]!.people[0]!.via.parentName, 'Root');
  assert.equal(result.byGeneration[1]!.people[0]!.via.parentName, 'Child');
  assert.equal(result.byGeneration[2]!.people[0]!.via.parentName, 'Grandchild');
});

test('computeDescendants: respects maxDepth', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'Child', born: null }] })],
    ['I2', person('I2', 'Child', { children: [{ record: 'I3', name: 'Grand', born: null }] })],
    ['I3', person('I3', 'Grand', { children: [{ record: 'I4', name: 'Great', born: null }] })],
    ['I4', person('I4', 'Great')],
  ]);

  const result = computeDescendants({ records, rootRecord: 'I1', maxDepth: 2 });
  assert.equal(result.total, 2);
  assert.equal(result.byGeneration.length, 2);
});

test('computeDescendants: missing child record still recorded with no further descent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'Ghost', born: null }] })],
  ]);
  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 1);
  assert.equal(result.byGeneration[0]!.people[0]!.name, 'Ghost');
  assert.equal(result.byGeneration[0]!.people[0]!.birth, null);
});

test('computeDescendants: data cycle (descendant points back to root) does not loop', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Root', { children: [{ record: 'I2', name: 'A', born: null }] })],
    ['I2', person('I2', 'A', { children: [{ record: 'I1', name: 'Root', born: null }] })],
  ]);
  const result = computeDescendants({ records, rootRecord: 'I1' });
  assert.equal(result.total, 1);
});

test('computeDescendants: unknown root returns empty', () => {
  const result = computeDescendants({ records: new Map(), rootRecord: 'I999' });
  assert.deepEqual(result, { byGeneration: [], total: 0 });
});
