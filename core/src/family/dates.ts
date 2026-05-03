export interface ParsedYear {
  year: number;
  qualifier?: 'about' | 'before' | 'after' | 'range';
}

export function parseGedcomYear(raw: string | null | undefined): ParsedYear | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (!s) return null;

  const between = s.match(/^BET(?:WEEN)?\s+(\d{4})\s+AND\s+(\d{4})$/);
  if (between) {
    const a = Number(between[1]);
    const b = Number(between[2]);
    return { year: Math.round((a + b) / 2), qualifier: 'range' };
  }

  const prefixed = s.match(/^(ABT|ABOUT|EST|CIRCA|CA|BEF|BEFORE|AFT|AFTER)\s+.*?(\d{4})/);
  if (prefixed) {
    const tag = prefixed[1]!;
    const y = Number(prefixed[2]);
    if (tag === 'BEF' || tag === 'BEFORE') return { year: y, qualifier: 'before' };
    if (tag === 'AFT' || tag === 'AFTER') return { year: y, qualifier: 'after' };
    return { year: y, qualifier: 'about' };
  }

  const yearMatch = s.match(/(\d{4})/);
  if (yearMatch) return { year: Number(yearMatch[1]) };
  return null;
}
