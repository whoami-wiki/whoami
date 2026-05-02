const TOKENS = ['Open', 'Closed', 'Superseded'] as const;

export function transformAdmonitions(text: string): string {
  let out = text;
  for (const t of TOKENS) {
    const re = new RegExp(`\\{\\{${t}\\}\\}`, 'g');
    out = out.replace(re, `:::${t.toLowerCase()}:::`);
  }
  return out;
}
