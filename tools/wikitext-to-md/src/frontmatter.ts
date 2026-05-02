import type { PageMeta } from './types.ts';

export function renderFrontmatter(meta: PageMeta): string {
  const lines: string[] = ['---'];
  lines.push(`title: ${yamlScalar(meta.title)}`);
  lines.push(`owner: ${meta.owner}`);
  lines.push(`editors: ${flowArray(meta.editors)}`);
  lines.push(`type: ${meta.type}`);
  lines.push(`aliases: ${flowArray(meta.aliases)}`);
  lines.push(`categories: ${flowArray(meta.categories)}`);
  if (meta.gedcom) {
    lines.push('gedcom:');
    lines.push(`  file: ${meta.gedcom.file}`);
    lines.push(`  record: ${meta.gedcom.record}`);
    lines.push(`  snapshot: ${meta.gedcom.snapshot}`);
  }
  lines.push(`created: ${meta.created}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

/**
 * Quote a value if it contains YAML-significant characters or leading/trailing
 * whitespace; otherwise return it bare. Shared with the infobox transforms.
 */
export function yamlScalar(s: string): string {
  if (/[:#\[\]{}'"|>&!*%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function flowArray(xs: string[]): string {
  return `[${xs.map(yamlScalar).join(', ')}]`;
}
