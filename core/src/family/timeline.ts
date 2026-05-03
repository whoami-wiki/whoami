import type { DerivedRecord } from '../gedcom/types.ts';
import { parseGedcomYear } from './dates.ts';

export interface TimelineEntry {
  record: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  /** Right edge for the lifespan bar — `deathYear` if known, otherwise a
   *  conservative cap (current year or birth + DEFAULT_LIFESPAN_YEARS). This
   *  is the same value that drives `range.maxYear`, so bars stay inside the
   *  visualization range without the renderer needing to recompute it. */
  endYear: number;
  side: 'self' | 'paternal' | 'maternal';
  generation: number;
  birthQualified: boolean;
  deathQualified: boolean;
}

export interface TimelineRange {
  minYear: number;
  maxYear: number;
}

export interface TimelineView {
  entries: TimelineEntry[];
  range: TimelineRange | null;
}

export interface ComputeTimelineConfig {
  records: Map<string, DerivedRecord>;
  self: string;
  lineage: { record: string; name: string; generation: number; side: 'paternal' | 'maternal' }[];
  /** Override the year used as the right edge for living/dateless death entries. Defaults to today. */
  currentYear?: number;
}

const DEFAULT_LIFESPAN_YEARS = 70;

export function computeTimeline(cfg: ComputeTimelineConfig): TimelineView {
  const currentYear = cfg.currentYear ?? new Date().getUTCFullYear();
  const entries: TimelineEntry[] = [];
  const consider: { record: string; name: string; generation: number; side: 'self' | 'paternal' | 'maternal' }[] = [
    { record: cfg.self, name: cfg.records.get(cfg.self)?.name ?? 'self', generation: 0, side: 'self' },
    ...cfg.lineage,
  ];

  for (const c of consider) {
    const rec = cfg.records.get(c.record);
    if (!rec) continue;
    const b = parseGedcomYear(rec.birth?.date ?? null);
    const d = parseGedcomYear(rec.death?.date ?? null);
    if (!b) continue;
    const deathYear = d ? d.year : null;
    const endYear = deathYear ?? Math.min(currentYear, b.year + DEFAULT_LIFESPAN_YEARS);
    entries.push({
      record: c.record,
      name: c.name,
      birthYear: b.year,
      deathYear,
      endYear,
      side: c.side,
      generation: c.generation,
      birthQualified: b.qualifier !== undefined,
      deathQualified: d?.qualifier !== undefined,
    });
  }

  if (entries.length === 0) return { entries, range: null };

  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const e of entries) {
    minYear = Math.min(minYear, e.birthYear);
    maxYear = Math.max(maxYear, e.endYear);
  }
  entries.sort((a, b) => a.birthYear - b.birthYear || a.generation - b.generation);
  return { entries, range: { minYear, maxYear } };
}
