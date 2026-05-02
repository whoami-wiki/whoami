import { escapeQuotes } from '../wikitext-args.ts';

const DIALOGUE_RE = /\{\{Dialogue\|([^|}]*)\|([^}]*)\}\}/g;

export function transformDialogue(text: string): string {
  return text.replace(DIALOGUE_RE, (_match, speaker: string, body: string) => {
    const trimmed = speaker.trim();
    const speakerAttr = trimmed ? `{speaker="${escapeQuotes(trimmed)}"}` : '{}';
    return `:::dialogue${speakerAttr}\n${body.trim()}\n:::`;
  });
}
