import yaml from 'js-yaml';
import type { PlacesPerson } from './places.ts';

export interface PlaceCoord {
  name: string;
  lat: number;
  lon: number;
  aliases: string[];
  note?: string;
}

export interface MappedPlace {
  coord: PlaceCoord;
  people: PlacesPerson[];
}

export interface UnmappedPlace {
  place: string;
  people: PlacesPerson[];
}

export function parseCoordsYaml(raw: string): PlaceCoord[] {
  let doc: unknown;
  try {
    doc = yaml.load(raw);
  } catch {
    return [];
  }
  if (!doc || typeof doc !== 'object') return [];
  const places = (doc as { places?: unknown }).places;
  if (!Array.isArray(places)) return [];
  const out: PlaceCoord[] = [];
  for (const entry of places) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name : null;
    const lat = typeof e.lat === 'number' ? e.lat : null;
    const lon = typeof e.lon === 'number' ? e.lon : null;
    const aliases = Array.isArray(e.aliases) ? e.aliases.filter((a): a is string => typeof a === 'string') : [];
    const note = typeof e.note === 'string' ? e.note : undefined;
    if (!name || lat === null || lon === null) continue;
    out.push({ name, lat, lon, aliases, note });
  }
  return out;
}

export function joinCoords(cfg: { coords: PlaceCoord[]; people: PlacesPerson[] }): {
  mapped: MappedPlace[];
  unmapped: UnmappedPlace[];
} {
  const aliasIndex = new Map<string, PlaceCoord>();
  for (const c of cfg.coords) {
    for (const a of c.aliases) aliasIndex.set(a, c);
    aliasIndex.set(c.name, c);
  }
  const groupsByCoord = new Map<PlaceCoord, PlacesPerson[]>();
  const unmappedByPlace = new Map<string, PlacesPerson[]>();
  for (const p of cfg.people) {
    const coord = aliasIndex.get(p.place);
    if (coord) {
      const arr = groupsByCoord.get(coord) ?? [];
      arr.push(p);
      groupsByCoord.set(coord, arr);
    } else {
      const arr = unmappedByPlace.get(p.place) ?? [];
      arr.push(p);
      unmappedByPlace.set(p.place, arr);
    }
  }
  const mapped: MappedPlace[] = [...groupsByCoord.entries()]
    .map(([coord, people]) => ({ coord, people }))
    .sort((a, b) => b.people.length - a.people.length || a.coord.name.localeCompare(b.coord.name));
  const unmapped: UnmappedPlace[] = [...unmappedByPlace.entries()]
    .map(([place, people]) => ({ place, people }))
    .sort((a, b) => b.people.length - a.people.length || a.place.localeCompare(b.place));
  return { mapped, unmapped };
}
