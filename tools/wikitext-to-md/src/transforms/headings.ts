/**
 * Convert wikitext headings (`= … =` … `====== … ======`) to Markdown ATX
 * headings (`#` … `######`). Only line-leading headings are recognized;
 * indented or mid-line `=` patterns are left as-is.
 *
 * The backreference `\1` enforces matching open/close lengths so unbalanced
 * runs like `=== foo ==` are correctly skipped.
 */
const HEADING_RE = /^(={1,6})\s*([^=]+?)\s*\1\s*$/gm;

export function transformHeadings(text: string): string {
  return text.replace(HEADING_RE, (_match, equals: string, content: string) => {
    return `${'#'.repeat(equals.length)} ${content}`;
  });
}
