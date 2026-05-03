import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinCoords, parseCoordsYaml } from '../../src/family/places-coords.ts';
import type { PlacesPerson } from '../../src/family/places.ts';

test('parseCoordsYaml: parses a list of place entries with aliases', () => {
  const raw = `
places:
  - name: Kyiv, Ukraine
    lat: 50.4501
    lon: 30.5234
    aliases:
      - "Kiev, Soviet Union"
      - "Kiev, Ukraine"
  - name: Pittsburgh, USA
    lat: 40.4406
    lon: -79.9959
    aliases:
      - "Pittsburgh, Allegheny County, Pennsylvania, United States of America"
  `;
  const coords = parseCoordsYaml(raw);
  assert.equal(coords.length, 2);
  assert.equal(coords[0]!.name, 'Kyiv, Ukraine');
  assert.equal(coords[0]!.aliases.length, 2);
});

test('parseCoordsYaml: tolerates missing/invalid input', () => {
  assert.deepEqual(parseCoordsYaml(''), []);
  assert.deepEqual(parseCoordsYaml('not yaml at all'), []);
  assert.deepEqual(parseCoordsYaml('places: not a list'), []);
});

test('joinCoords: groups people by canonical place via alias lookup', () => {
  const coords = [
    { name: 'Kyiv, Ukraine', lat: 50.45, lon: 30.52, aliases: ['Kiev, Soviet Union', 'Kiev, Ukraine'], note: undefined },
    { name: 'Pittsburgh, USA', lat: 40.44, lon: -79.99, aliases: ['Pittsburgh, PA'], note: undefined },
  ];
  const people: PlacesPerson[] = [
    { record: 'I1', name: 'A', place: 'Kiev, Ukraine' },
    { record: 'I2', name: 'B', place: 'Kiev, Soviet Union' },
    { record: 'I3', name: 'C', place: 'Pittsburgh, PA' },
    { record: 'I4', name: 'D', place: 'Atlantis' },
  ];
  const { mapped, unmapped } = joinCoords({ coords, people });
  assert.equal(mapped.length, 2);
  const kyiv = mapped.find(p => p.coord.name === 'Kyiv, Ukraine')!;
  assert.equal(kyiv.people.length, 2);
  assert.equal(unmapped.length, 1);
  assert.equal(unmapped[0]!.place, 'Atlantis');
});

test('joinCoords: empty inputs', () => {
  const { mapped, unmapped } = joinCoords({ coords: [], people: [] });
  assert.deepEqual(mapped, []);
  assert.deepEqual(unmapped, []);
});
