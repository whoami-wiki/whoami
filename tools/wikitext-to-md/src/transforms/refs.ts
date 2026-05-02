const NAMED_REF_RE = /<ref\s+name="([^"]+)"\s*>([\s\S]*?)<\/ref>/g;
const NAMED_REF_SELFCLOSE_RE = /<ref\s+name="([^"]+)"\s*\/>/g;
const UNNAMED_REF_RE = /<ref>([\s\S]*?)<\/ref>/g;
const REFERENCES_TAG = /<references\s*\/>/;

export function transformRefs(text: string): string {
  const footnotes = new Map<string, string>();
  let auto = 0;

  let out = text.replace(NAMED_REF_RE, (_m, name: string, body: string) => {
    if (!footnotes.has(name)) footnotes.set(name, body.trim());
    return `[^${name}]`;
  });
  out = out.replace(NAMED_REF_SELFCLOSE_RE, (_m, name: string) => `[^${name}]`);
  out = out.replace(UNNAMED_REF_RE, (_m, body: string) => {
    auto += 1;
    const id = `auto-${auto}`;
    footnotes.set(id, body.trim());
    return `[^${id}]`;
  });

  const defs = footnotes.size > 0
    ? Array.from(footnotes.entries()).map(([id, body]) => `[^${id}]: ${body}`).join('\n')
    : '';

  // Place definitions where <references /> was, so they render under their
  // original section heading. If there's no <references /> tag, append at the end.
  if (REFERENCES_TAG.test(out)) {
    out = out.replace(REFERENCES_TAG, defs);
  } else if (defs) {
    out = `${out.trimEnd()}\n\n${defs}`;
  }

  return out.trimEnd();
}
