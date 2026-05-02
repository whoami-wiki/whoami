import { z } from 'zod';
import type { PageMeta } from './types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const GedcomRefSchema = z.object({
  file: z.string().min(1),
  record: z.string().regex(/^I\d+$/),
  snapshot: z.string().min(1),
});

const PageMetaSchema: z.ZodType<PageMeta> = z.object({
  title: z.string().min(1),
  owner: z.string().min(1),
  editors: z.array(z.string()),
  type: z.enum(['person', 'family', 'event', 'tree', 'meta']),
  aliases: z.array(z.string()),
  categories: z.array(z.string()),
  gedcom: GedcomRefSchema.optional(),
  created: z.string().regex(ISO_DATE, 'expected YYYY-MM-DD'),
  deletedAt: z.string().optional(),
});

export function parsePageMeta(input: unknown): PageMeta {
  return PageMetaSchema.parse(input);
}
