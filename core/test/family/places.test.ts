import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupBirthplaces } from '../../src/family/places.ts';

test('groupBirthplaces: groups by last segment with country normalization', () => {
  const entries = [
    { record: 'I1', name: 'A', place: 'Kiev, Ukraine' },
    { record: 'I2', name: 'B', place: 'Pittsburgh, Allegheny County, Pennsylvania, United States of America' },
    { record: 'I3', name: 'C', place: 'New York, USA' },
    { record: 'I4', name: 'D', place: null },
    { record: 'I5', name: 'E', place: 'Kiev, Soviet Union' },
  ];
  const result = groupBirthplaces({ entries });
  const byRegion = new Map(result.regions.map(r => [r.region, r]));
  assert.equal(byRegion.get('United States')!.people.length, 2);
  assert.equal(byRegion.get('Ukraine')!.people.length, 1);
  assert.equal(byRegion.get('Soviet Union')!.people.length, 1);
});

test('groupBirthplaces: drops null/empty places, sorts by count desc', () => {
  const entries = [
    { record: 'I1', name: 'A', place: 'X, A' },
    { record: 'I2', name: 'B', place: 'Y, A' },
    { record: 'I3', name: 'C', place: 'Z, B' },
    { record: 'I4', name: 'D', place: '' },
    { record: 'I5', name: 'E', place: null },
  ];
  const result = groupBirthplaces({ entries });
  assert.equal(result.regions.length, 2);
  assert.equal(result.regions[0]!.region, 'A');
  assert.equal(result.regions[0]!.people.length, 2);
  assert.equal(result.regions[1]!.region, 'B');
});
