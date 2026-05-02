/**
 * Normalize a wiki title into a kebab-case slug for filesystem and URL use.
 *
 * Rules (matches the Phase 3 wikilink resolution rule in the spec):
 *   1. lowercase
 *   2. drop apostrophes and quotes (', ', ", ", ")
 *   3. drop parens, brackets, braces (replace with hyphen)
 *   4. drop colons, semicolons, commas
 *   5. collapse runs of [\s_]+ into a single hyphen
 *   6. collapse runs of '-+' into a single hyphen
 *   7. trim leading/trailing hyphens
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[''"""]/g, '')
    .replace(/[()[\]{}]/g, '-')
    .replace(/[:;,]/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
