import matter from 'gray-matter';
import type { Page, PageMeta } from './types.ts';
import { parsePageMeta } from './schema.ts';

export function parsePage(slug: string, raw: string): Page {
  const { data, content } = matter(raw);
  const meta: PageMeta = parsePageMeta(data);
  return { slug, meta, body: content.trimStart() };
}

export function serializePage(page: Page): string {
  return `${renderFrontmatter(page.meta)}\n${page.body.trimStart()}`;
}

function renderFrontmatter(meta: PageMeta): string {
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
  if (meta.deletedAt) lines.push(`deletedAt: ${yamlScalar(meta.deletedAt)}`);
  lines.push('---');
  return lines.join('\n') + '\n';
}

function yamlScalar(s: string): string {
  if (/[:#\[\]{}'"|>&!*%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function flowArray(xs: string[]): string {
  return `[${xs.map(yamlScalar).join(', ')}]`;
}
