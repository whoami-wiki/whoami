export interface PlaceEntry {
  record: string;
  name: string;
  place: string | null;
}

export interface PlacesPerson {
  record: string;
  name: string;
  place: string;
}

export interface PlacesRegion {
  region: string;
  people: PlacesPerson[];
}

export interface PlacesView {
  regions: PlacesRegion[];
}

export function groupBirthplaces(cfg: { entries: PlaceEntry[] }): PlacesView {
  const groups = new Map<string, PlacesPerson[]>();
  for (const e of cfg.entries) {
    if (!e.place || !e.place.trim()) continue;
    const region = lastSegment(e.place);
    const arr = groups.get(region) ?? [];
    arr.push({ record: e.record, name: e.name, place: e.place });
    groups.set(region, arr);
  }
  const regions: PlacesRegion[] = [...groups.entries()]
    .map(([region, people]) => ({ region, people }))
    .sort((a, b) => b.people.length - a.people.length || a.region.localeCompare(b.region));
  return { regions };
}

function lastSegment(place: string): string {
  const segs = place.split(',').map(s => s.trim()).filter(Boolean);
  const last = segs[segs.length - 1] ?? place.trim();
  return normalizeCountry(last);
}

function normalizeCountry(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'usa' || lower === 'u.s.a.' || lower === 'united states of america' || lower === 'united states') return 'United States';
  if (lower === 'uk' || lower === 'u.k.') return 'United Kingdom';
  return s;
}
