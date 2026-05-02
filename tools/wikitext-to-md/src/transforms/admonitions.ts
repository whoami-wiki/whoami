const ADMONITIONS: ReadonlyArray<[RegExp, string]> = [
  [/\{\{Open\}\}/g, ':::open:::'],
  [/\{\{Closed\}\}/g, ':::closed:::'],
  [/\{\{Superseded\}\}/g, ':::superseded:::'],
];

export function transformAdmonitions(text: string): string {
  let out = text;
  for (const [re, replacement] of ADMONITIONS) {
    out = out.replace(re, replacement);
  }
  return out;
}
