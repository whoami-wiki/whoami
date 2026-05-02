import { parsePipeArgs } from '../wikitext-args.ts';

const CITE_MESSAGE_RE = /\{\{Cite message\s*\|([^}]+)\}\}/gi;

export function transformCiteMessage(text: string): string {
  return text.replace(CITE_MESSAGE_RE, (_match, args: string) => {
    const pairs = parsePipeArgs(args);
    const attrs = Object.entries(pairs)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .join(' ');
    return `:::cite-message{${attrs}}:::`;
  });
}
