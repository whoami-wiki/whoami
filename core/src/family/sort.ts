import type { DatedEvent } from '../gedcom/types.ts';
import { parseGedcomYear } from './dates.ts';

/** Stable sort comparator: people with parsable birth years come first
 *  (chronologically), people without come last (alphabetical by name). */
export function byBirthThenName(
  a: { birth: DatedEvent | null; name: string },
  b: { birth: DatedEvent | null; name: string },
): number {
  const ay = parseGedcomYear(a.birth?.date ?? null)?.year ?? null;
  const by = parseGedcomYear(b.birth?.date ?? null)?.year ?? null;
  if (ay !== null && by !== null && ay !== by) return ay - by;
  if (ay !== null && by === null) return -1;
  if (ay === null && by !== null) return 1;
  return a.name.localeCompare(b.name);
}
