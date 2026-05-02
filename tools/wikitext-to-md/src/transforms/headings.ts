/**
 * Convert wikitext headings to Markdown ATX headings. Only line-leading
 * == headings are recognized; indented patterns are left as-is (matches
 * MediaWiki's behavior of treating non-leading == as plain text).
 *
 * Wikitext supports h1 ('= one ='), but in practice the page title is h1
 * and h1 doesn't appear in body content. Map level-for-level: h2 → ##.
 */
const HEADING_RE = /^(={2,6})\s*([^=]+?)\s*\1\s*$/gm;

export function transformHeadings(text: string): string {
  return text.replace(HEADING_RE, (_match, equals: string, content: string) => {
    return `${'#'.repeat(equals.length)} ${content}`;
  });
}
