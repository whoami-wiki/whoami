import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import type { Page, PageMeta } from './types.ts';
import { parsePageMeta } from './schema.ts';
import { migrate } from './migrations/index.ts';

/**
 * Parse a page from raw markdown text. Owns the full read chain:
 *
 *   parse YAML → migrate (no-op when current) → Zod-validate → Page
 *
 * Pages without an on-disk schemaVersion field default to v1 before
 * migration. Throws FutureSchemaVersionError if the page is on a
 * version newer than this build supports.
 */
export function parsePage(slug: string, raw: string): Page {
  const { data, content } = matter(raw);
  const fromVersion = ((data as { schemaVersion?: unknown }).schemaVersion as number | undefined) ?? 1;
  const migrated = migrate(data as Record<string, unknown>, fromVersion);
  const meta: PageMeta = parsePageMeta(migrated);
  return { slug, meta, body: content.trimStart() };
}

export function serializePage(page: Page): string {
  return `${renderFrontmatter(page.meta)}\n${page.body.trimStart()}`;
}

/**
 * Read just the on-disk schemaVersion of a page file, defaulting to 1
 * when the field is absent. Used by store.write / store.softDelete to
 * enforce the strict-write rule without instantiating a full Page or
 * running Zod validation.
 */
export function peekSchemaVersion(path: string): number {
  const raw = readFileSync(path, 'utf-8');
  const { data } = matter(raw);
  const v = (data as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return v;
  return 1;
}

function renderFrontmatter(meta: PageMeta): string {
  const lines: string[] = ['---'];
  lines.push(`schemaVersion: ${meta.schemaVersion}`);
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
  if (meta.portrait) lines.push(`portrait: ${yamlScalar(meta.portrait)}`);
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
