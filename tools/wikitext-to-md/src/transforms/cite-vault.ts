const CITE_VAULT_RE = /\{\{Cite vault\s*\|([^}]+)\}\}/gi;

export function transformCiteVault(text: string): string {
  return text.replace(CITE_VAULT_RE, (_match, args: string) => {
    const pairs = parsePipeArgs(args);
    const attrs = Object.entries(pairs)
      .map(([k, v]) => `${k}="${escapeQuotes(v)}"`)
      .join(' ');
    return `:::cite-vault{${attrs}}:::`;
  });
}

function parsePipeArgs(s: string): Record<string, string> {
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

function escapeQuotes(v: string): string {
  return v.replace(/"/g, '\\"');
}
