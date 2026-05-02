import { yamlScalar } from '../frontmatter.ts';

const INFOBOX_PERSON_RE = /\{\{Infobox person\s*((?:\|[^{}]*?)+)\}\}/gs;

export function transformInfoboxPerson(text: string): string {
  return text.replace(INFOBOX_PERSON_RE, (_match, args: string) => {
    return `:::infobox-person\n${parseInfoboxArgs(args)}\n:::`;
  });
}

/**
 * Parse a multi-line `|key = value` infobox arg block into YAML key:value
 * lines. Splits on newline-prefixed pipes (real-world infoboxes use one
 * key per line) rather than bare `|` so that wikilinks like `[[A|B]]`
 * inside values aren't treated as separators.
 */
export function parseInfoboxArgs(args: string): string {
  const lines: string[] = [];
  for (const part of args.split(/\n\s*\|/).map(s => s.replace(/^\|/, ''))) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (!k || !v) continue;
    lines.push(`${k}: ${yamlScalar(v)}`);
  }
  return lines.join('\n');
}
