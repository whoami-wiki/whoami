const CITE_MESSAGE_RE = /\{\{Cite message\s*\|([^}]+)\}\}/gi;

export function transformCiteMessage(text: string): string {
  return text.replace(CITE_MESSAGE_RE, (_match, args: string) => {
    const pairs: Record<string, string> = {};
    for (const part of args.split('|')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k) pairs[k] = v;
    }
    const attrs = Object.entries(pairs)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .join(' ');
    return `:::cite-message{${attrs}}:::`;
  });
}
