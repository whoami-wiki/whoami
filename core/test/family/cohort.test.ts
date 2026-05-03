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

test('computeCohort: half sibling shares only one parent', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IM', name: 'Mom', role: 'mother' },
      ],
    })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
      { record: 'I2', name: 'Half', born: null },
    ] })],
    ['IM', person('IM', 'Mom', { children: [
      { record: 'I1', name: 'Self', born: null },
    ] })],
    ['I2', person('I2', 'Half', {
      parents: [
        { record: 'IF', name: 'Dad', role: 'father' },
        { record: 'IS', name: 'Stepmom', role: 'mother' },
      ],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.siblings.length, 1);
  assert.equal(result.siblings[0]!.record, 'I2');
  assert.equal(result.siblings[0]!.kind, 'half');
});

test('computeCohort: self is never returned as own sibling', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    ['IF', person('IF', 'Dad', { children: [
      { record: 'I1', name: 'Self', born: null },
    ] })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.siblings.length, 0);
});

test('computeCohort: first cousins via paternal aunt', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    ['IF', person('IF', 'Dad', {
      parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }],
      children: [{ record: 'I1', name: 'Self', born: null }],
    })],
    ['IPGF', person('IPGF', 'Grandpa', {
      children: [
        { record: 'IF', name: 'Dad', born: null },
        { record: 'IA', name: 'Aunt', born: null },
      ],
    })],
    ['IA', person('IA', 'Aunt', {
      parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }],
      children: [{ record: 'IC', name: 'Cousin', born: null }],
    })],
    ['IC', person('IC', 'Cousin', {
      parents: [{ record: 'IA', name: 'Aunt', role: 'mother' }],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.cousins.length, 1);
  assert.equal(result.cousins[0]!.record, 'IC');
  assert.equal(result.cousins[0]!.via.parentName, 'Aunt');
});

test('computeCohort: cousins exclude self and siblings', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
    ['IF', person('IF', 'Dad', {
      parents: [{ record: 'IPGF', name: 'Grandpa', role: 'father' }],
      children: [
        { record: 'I1', name: 'Self', born: null },
        { record: 'I2', name: 'Sibling', born: null },
      ],
    })],
    ['IPGF', person('IPGF', 'Grandpa', {
      children: [{ record: 'IF', name: 'Dad', born: null }],
    })],
    ['I2', person('I2', 'Sibling', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.equal(result.cousins.length, 0);
});

test('computeCohort: missing parent record does not throw', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self', {
      parents: [{ record: 'IF', name: 'Dad', role: 'father' }],
    })],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.deepEqual(result, { siblings: [], cousins: [] });
});

test('computeCohort: target with no parents returns empty cohort', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Self')],
  ]);

  const result = computeCohort({ records, targetRecord: 'I1' });
  assert.deepEqual(result, { siblings: [], cousins: [] });
});

test('computeCohort: unknown target returns empty cohort', () => {
  const records = new Map<string, DerivedRecord>();
  const result = computeCohort({ records, targetRecord: 'I999' });
  assert.deepEqual(result, { siblings: [], cousins: [] });
});
