import { parsePipeArgs } from '../wikitext-args.ts';

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

function escapeQuotes(v: string): string {
  return v.replace(/"/g, '\\"');
}
