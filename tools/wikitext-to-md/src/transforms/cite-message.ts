import { parsePipeArgs, buildDirectiveAttrs } from '../wikitext-args.ts';

const CITE_MESSAGE_RE = /\{\{Cite message\s*\|([^}]+)\}\}/gi;

export function transformCiteMessage(text: string): string {
  return text.replace(CITE_MESSAGE_RE, (_match, args: string) => {
    return `::cite-message{${buildDirectiveAttrs(parsePipeArgs(args))}}`;
  });
}
