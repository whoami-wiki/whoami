import { z } from 'zod';
import type { PageMeta } from './types.ts';
import { CURRENT_SCHEMA_VERSION } from './migrations/index.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GedcomRefSchema = z.object({
  file: z.string().min(1),
  record: z.string().regex(/^I\d+$/),
  snapshot: z.string().min(1),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PageMetaSchema: z.ZodType<PageMeta, any, any> = z.object({
  schemaVersion: z.number().int().positive().default(CURRENT_SCHEMA_VERSION),
  title: z.string().min(1),
  owner: z.string().min(1),
  editors: z.array(z.string()),
  type: z.enum(['person', 'family', 'event', 'tree', 'meta']),
  aliases: z.array(z.string()),
  categories: z.array(z.string()),
  gedcom: GedcomRefSchema.optional(),
  portrait: z.string().min(1).optional(),
  created: z.union([
    z.string().regex(ISO_DATE, 'expected YYYY-MM-DD'),
    z.date().transform(d => d.toISOString().slice(0, 10))
  ]),
  deletedAt: z.union([
    z.string(),
    z.date().transform(d => d.toISOString().slice(0, 10))
  ]).optional(),
});

/**
 * Validate a raw frontmatter object against the current PageMeta
 * schema. Callers that read pages from disk must run frontmatter
 * through `migrate(...)` first — the schema describes the current
 * shape only.
 */
export function parsePageMeta(input: unknown): PageMeta {
  return PageMetaSchema.parse(input);
}
