/**
 * Canonicalize a user-provided title into the slug shape that core/pages
 * accepts: ^[a-z0-9][a-z0-9-]*(\.talk)?$. Non-alphanumeric chars are
 * collapsed to hyphens, then leading/trailing hyphens are stripped.
 */
export function toSlug(input: string): string {
  const trimmed = input.trim();
  const talk = trimmed.endsWith('.talk');
  const base = talk ? trimmed.slice(0, -5) : trimmed;
  const slug = base
    .toLowerCase()
    .replace(/['']/g, '')          // strip apostrophes (no separator)
    .replace(/[^a-z0-9]+/g, '-')   // anything else → hyphen
    .replace(/^-+|-+$/g, '');      // strip edges
  return talk ? `${slug}.talk` : slug;
}
