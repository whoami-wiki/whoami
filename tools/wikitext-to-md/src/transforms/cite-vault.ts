import { parsePipeArgs, buildDirectiveAttrs } from '../wikitext-args.ts';

const CITE_VAULT_RE = /\{\{Cite vault\s*\|([^}]+)\}\}/gi;

export function transformCiteVault(text: string): string {
  return text.replace(CITE_VAULT_RE, (_match, args: string) => {
    return `::cite-vault{${buildDirectiveAttrs(parsePipeArgs(args))}}`;
  });
}
