/**
 * Parse `key1=value1|key2=value2` (the inside of a `{{Template|…}}` invocation)
 * into a record. Whitespace around `=` and `|` is preserved inside values;
 * only the splitting characters are removed.
 */
export function parsePipeArgs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('|')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function escapeQuotes(v: string): string {
  return v.replace(/"/g, '\\"');
}

/**
 * Build a remark-directive attribute block: `{key1="v1" key2="v2"}`.
 * Values are double-quoted with embedded `"` escaped.
 */
export function buildDirectiveAttrs(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .map(([k, v]) => `${k}="${escapeQuotes(v)}"`)
    .join(' ');
}
