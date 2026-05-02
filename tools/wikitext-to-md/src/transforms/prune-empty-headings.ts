/**
 * Remove headings whose body is empty — i.e. the next non-blank line is
 * either another heading or end-of-document. Common after `<references />`
 * is replaced with empty (no `<ref>` tags on the page) under a `## References`
 * heading.
 */
const HEADING_RE = /^#{2,6} /;

export function pruneEmptyHeadings(text: string): string {
  const lines = text.split('\n');
  const keep: boolean[] = lines.map(() => true);

  for (let i = 0; i < lines.length; i++) {
    if (!HEADING_RE.test(lines[i]!)) continue;

    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === '') j++;

    if (j === lines.length || HEADING_RE.test(lines[j]!)) {
      keep[i] = false;
      for (let k = i + 1; k < j; k++) keep[k] = false;
    }
  }

  return lines.filter((_, i) => keep[i]).join('\n');
}
