import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTimeline } from '../../src/family/timeline.ts';
import type { DerivedRecord } from '../../src/gedcom/types.ts';

function rec(record: string, name: string, b: string | null, d: string | null): DerivedRecord {
  return {
    record, name,
    birth: b ? { date: b, place: null } : null,
    death: d ? { date: d, place: null } : null,
    parents: [], spouses: [], children: [],
    residences: [], occupations: [], sources: [],
  };
}

test('computeTimeline: builds entries with year tuples and overall range', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', rec('I1', 'Self', '1990', null)],
    ['I2', rec('I2', 'Dad', '1960', '2020')],
    ['I3', rec('I3', 'Grandpa', 'ABT 1930', '1995')],
  ]);
  const lineage = [
    { record: 'I2', name: 'Dad', generation: 1, side: 'paternal' as const },
    { record: 'I3', name: 'Grandpa', generation: 2, side: 'paternal' as const },
  ];
  const view = computeTimeline({ records, self: 'I1', lineage, currentYear: 2020 });
  assert.equal(view.entries.length, 3);
  assert.equal(view.range!.minYear, 1930);
  assert.equal(view.range!.maxYear, 2020);
  const dad = view.entries.find(e => e.record === 'I2')!;
  assert.equal(dad.birthYear, 1960);
  assert.equal(dad.deathYear, 2020);
});

test('computeTimeline: skips ancestors with no parsable dates', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', rec('I1', 'Self', '1990', null)],
    ['I2', rec('I2', 'Mystery', null, null)],
  ]);
  const lineage = [{ record: 'I2', name: 'Mystery', generation: 1, side: 'maternal' as const }];
  const view = computeTimeline({ records, self: 'I1', lineage });
  assert.equal(view.entries.length, 1);
  assert.equal(view.entries[0]!.record, 'I1');
});

test('computeTimeline: empty when no parsable dates anywhere', () => {
  const records = new Map<string, DerivedRecord>([
    ['I1', rec('I1', 'Self', null, null)],
  ]);
  const view = computeTimeline({ records, self: 'I1', lineage: [] });
  assert.equal(view.entries.length, 0);
  assert.equal(view.range, null);
});
