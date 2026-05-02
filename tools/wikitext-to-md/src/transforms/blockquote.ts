import { escapeQuotes } from '../wikitext-args.ts';

const BLOCKQUOTE_RE = /\{\{Blockquote\|([^|}]*)(?:\|([^}]*))?\}\}/g;

export function transformBlockquote(text: string): string {
  return text.replace(BLOCKQUOTE_RE, (_match, body: string, by?: string) => {
    const trimmedBy = by?.trim();
    const attr = trimmedBy ? `{by="${escapeQuotes(trimmedBy)}"}` : '';
    return `:::blockquote${attr}\n${body.trim()}\n:::`;
  });
}
