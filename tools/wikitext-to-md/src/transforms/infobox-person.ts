const INFOBOX_PERSON_RE = /\{\{Infobox person\s*((?:\|[^{}]*?)+)\}\}/gs;

export function transformInfoboxPerson(text: string): string {
  return text.replace(INFOBOX_PERSON_RE, (_match, args: string) => {
    const body = parseInfoboxArgs(args);
    return `:::infobox-person\n${body}\n:::`;
  });
}

function parseInfoboxArgs(args: string): string {
  // Split on `|` but only when it's at the start of a logical key=value line.
  // Real-world infoboxes use `|key = value\n` with trailing newline before `|`.
  const lines: string[] = [];
  for (const part of args.split(/\n\s*\|/).map(s => s.replace(/^\|/, ''))) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (!k || !v) continue;
    lines.push(`${k}: ${needsQuotes(v) ? JSON.stringify(v) : v}`);
  }
  return lines.join('\n');
}

function needsQuotes(v: string): boolean {
  // YAML rules: quote if value contains :, [, {, ', or other special chars
  return /[:#\[\]{}'"|>&!*%@`,]/.test(v) || /^\s|\s$/.test(v);
}
