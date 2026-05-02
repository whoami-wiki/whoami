import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Page, PageMetaSummary } from './types.ts';
import { parsePage } from './frontmatter.ts';
import { assertValidSlug } from './slug.ts';

export interface PageStoreConfig {
  repoRoot: string;
  pagesDir: string;
}

export interface PageStore {
  read(slug: string): Promise<Page>;
  list(): Promise<PageMetaSummary[]>;
}

export function createPageStore(cfg: PageStoreConfig): PageStore {
  return {
    async read(slug: string): Promise<Page> {
      assertValidSlug(slug);
      const path = join(cfg.pagesDir, `${slug}.md`);
      if (!existsSync(path)) {
        throw new Error(`page not found: ${slug}`);
      }
      const raw = readFileSync(path, 'utf-8');
      return parsePage(slug, raw);
    },

    async list(): Promise<PageMetaSummary[]> {
      const out: PageMetaSummary[] = [];
      for (const entry of readdirSync(cfg.pagesDir, { withFileTypes: true })) {
        if (entry.isDirectory()) continue;
        if (!entry.name.endsWith('.md')) continue;
        const isTalk = entry.name.endsWith('.talk.md');
        const slug = isTalk
          ? basename(entry.name, '.talk.md') + '.talk'
          : basename(entry.name, '.md');
        try {
          const raw = readFileSync(join(cfg.pagesDir, entry.name), 'utf-8');
          const page = parsePage(slug, raw);
          out.push({
            slug,
            title: page.meta.title,
            type: page.meta.type,
            categories: page.meta.categories,
            isTalk,
            isArchived: !!page.meta.deletedAt,
          });
        } catch {}
      }
      return out.sort((a, b) => a.slug.localeCompare(b.slug));
    },
  };
}
