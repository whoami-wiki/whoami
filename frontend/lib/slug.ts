/**
 * Canonicalize a name or title into the slug shape that core/pages accepts:
 * ^[a-z0-9][a-z0-9-]*(\.talk)?$. Apostrophes are dropped (no separator);
 * everything else non-alphanumeric becomes a hyphen, then leading/trailing
 * hyphens are stripped.
 *
 * Match-keep this in sync with cli/src/slug.ts (CLI cannot import frontend).
 */
export function toSlug(input: string): string {
  const trimmed = input.trim();
  const talk = trimmed.endsWith('.talk');
  const base = talk ? trimmed.slice(0, -5) : trimmed;
  const slug = base
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return talk ? `${slug}.talk` : slug;
}
