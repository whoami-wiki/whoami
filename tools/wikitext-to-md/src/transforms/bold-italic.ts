/**
 * Convert wikitext emphasis to Markdown:
 *   ''''' x ''''' → *** x ***   (bold-italic; 5 apostrophes)
 *   '''   x '''   → **  x **    (bold; 3 apostrophes)
 *   ''    x ''    → *   x *     (italic; 2 apostrophes)
 *
 * Order matters: longest run first so bold doesn't eat italic's apostrophes.
 */
const BOLD_ITALIC = /'{5}(.+?)'{5}/g;
const BOLD = /'{3}(.+?)'{3}/g;
const ITALIC = /'{2}(.+?)'{2}/g;

export function transformBoldItalic(text: string): string {
  return text
    .replace(BOLD_ITALIC, '***$1***')
    .replace(BOLD, '**$1**')
    .replace(ITALIC, '*$1*');
}
