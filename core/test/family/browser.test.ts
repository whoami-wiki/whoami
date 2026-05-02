import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilyBrowser } from '../../src/family/browser.ts';
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

test('buildFamilyBrowser: groups ancestors by generation and family line', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Steven', {
      parents: [
        { record: 'I2', name: 'Dad', role: 'father' },
        { record: 'I3', name: 'Mom', role: 'mother' },
      ],
    })],
    ['I2', person('I2', 'Dad', {
      parents: [{ record: 'I4', name: 'Paternal Grandpa', role: 'father' }],
    })],
    ['I3', person('I3', 'Mom', {
      parents: [{ record: 'I5', name: 'Maternal Grandma', role: 'mother' }],
    })],
    ['I4', person('I4', 'Paternal Grandpa')],
    ['I5', person('I5', 'Maternal Grandma')],
  ]);

  const view = buildFamilyBrowser({ records, rootRecord: 'I1', selectedRecord: 'I5', maxDepth: 2 })!;

  assert.equal(view.root.name, 'Steven');
  assert.equal(view.selected.name, 'Maternal Grandma');
  assert.equal(view.selected.label, 'Maternal grandmother');
  assert.equal(view.byGeneration.length, 2);
  assert.deepEqual(view.byGeneration[0]!.paternal.map(p => p.record), ['I2']);
  assert.deepEqual(view.byGeneration[0]!.maternal.map(p => p.record), ['I3']);
  assert.equal(view.byGeneration[1]!.paternal[0]!.label, 'Paternal grandfather');
  assert.equal(view.byGeneration[1]!.maternal[0]!.label, 'Maternal grandmother');
});

test('buildFamilyBrowser: selected panel carries immediate relationships', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Steven', {
      spouses: [{ record: 'I2', name: 'Partner', married: '2020' }],
      children: [{ record: 'I3', name: 'Child', born: '2021' }],
    })],
    ['I2', person('I2', 'Partner')],
    ['I3', person('I3', 'Child')],
  ]);

  const view = buildFamilyBrowser({ records, rootRecord: 'I1', selectedRecord: 'I1' })!;

  assert.deepEqual(view.selectedRelations.spouses.map(p => p.record), ['I2']);
  assert.deepEqual(view.selectedRelations.children.map(p => p.record), ['I3']);
});

test('buildFamilyBrowser: falls back to root when selected record is missing', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', person('I1', 'Steven')],
  ]);

  const view = buildFamilyBrowser({ records, rootRecord: 'I1', selectedRecord: 'I404' })!;

  assert.equal(view.selected.record, 'I1');
});
