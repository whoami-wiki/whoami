/**
 * Parse `key1=value1|key2=value2` (the inside of a `{{Template|…}}` invocation)
 * into a record. Whitespace around `=` and `|` is preserved inside values;
 * only the splitting characters are removed. Used by both extractors that
 * read template args (cite-vault-ref) and transforms that rewrite them
 * (cite-vault, cite-message).
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
