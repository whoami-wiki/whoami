const NAMED_REF_RE = /<ref\s+name="([^"]+)"\s*>([\s\S]*?)<\/ref>/g;
const NAMED_REF_SELFCLOSE_RE = /<ref\s+name="([^"]+)"\s*\/>/g;
const UNNAMED_REF_RE = /<ref>([\s\S]*?)<\/ref>/g;
const REFERENCES_TAG = /<references\s*\/>\s*/g;

export function transformRefs(text: string): string {
  const footnotes = new Map<string, string>();      // id → body
  let auto = 0;

  // Pass 1: named refs with body. Record body, replace with [^id].
  let out = text.replace(NAMED_REF_RE, (_m, name: string, body: string) => {
    if (!footnotes.has(name)) footnotes.set(name, body.trim());
    return `[^${name}]`;
  });

  // Pass 2: named self-closing refs (re-use). Replace with [^id].
  out = out.replace(NAMED_REF_SELFCLOSE_RE, (_m, name: string) => `[^${name}]`);

  // Pass 3: unnamed refs. Auto-id, record body, replace.
  out = out.replace(UNNAMED_REF_RE, (_m, body: string) => {
    auto += 1;
    const id = `auto-${auto}`;
    footnotes.set(id, body.trim());
    return `[^${id}]`;
  });

  // Strip <references /> (Markdown footnotes are emitted naturally below)
  out = out.replace(REFERENCES_TAG, '');

  // Append footnote definitions at the end
  if (footnotes.size === 0) return out.trimEnd();
  const defs = Array.from(footnotes.entries()).map(([id, body]) => `[^${id}]: ${body}`);
  return `${out.trimEnd()}\n\n${defs.join('\n')}`.trimEnd();
}
