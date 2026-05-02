const REDIRECT_RE = /^\s*#REDIRECT\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/i;

export function extractRedirect(text: string): { target: string } | null {
  const m = REDIRECT_RE.exec(text);
  if (!m) return null;
  return { target: m[1]!.trim() };
}
