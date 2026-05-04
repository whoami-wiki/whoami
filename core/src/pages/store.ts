import { readFileSync, readdirSync, existsSync, writeFileSync, fsyncSync, openSync, closeSync, renameSync, mkdirSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import type { Page, PageMetaSummary, AuthorIdentity, Revision } from './types.ts';
import { parsePage, serializePage, peekSchemaVersion } from './frontmatter.ts';
import { assertValidSlug } from './slug.ts';
import { addAndCommit, fileHistory, restoreFromIndex } from './git.ts';
import { withLock } from './locks.ts';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
} from './migrations/index.ts';

/**
 * Thrown by store.write / store.softDelete when the on-disk page is
 * at a schemaVersion below CURRENT_SCHEMA_VERSION. Run `wai migrate`
 * to update before retrying the write.
 */
export class StaleSchemaVersionError extends Error {
  constructor(
    public readonly slug: string,
    public readonly onDisk: number,
    public readonly current: number,
  ) {
    super(`page ${slug} on disk is schema v${onDisk}; current is v${current}. run \`wai migrate\`.`);
    this.name = 'StaleSchemaVersionError';
  }
}

function assertPeekSchemaCurrent(slug: string, path: string): void {
  if (!existsSync(path)) return;
  const onDisk = peekSchemaVersion(path);
  if (onDisk < CURRENT_SCHEMA_VERSION) {
    throw new StaleSchemaVersionError(slug, onDisk, CURRENT_SCHEMA_VERSION);
  }
  if (onDisk > CURRENT_SCHEMA_VERSION) {
    throw new FutureSchemaVersionError(onDisk, CURRENT_SCHEMA_VERSION);
  }
}

export interface PageStoreConfig {
  repoRoot: string;
  pagesDir: string;
}

export interface PageStore {
  read(slug: string): Promise<Page>;
  write(slug: string, page: Page, author: AuthorIdentity, summary: string): Promise<void>;
  list(): Promise<PageMetaSummary[]>;
  history(slug: string, limit?: number): Promise<Revision[]>;
  softDelete(slug: string, author: AuthorIdentity): Promise<void>;
}

export function createPageStore(cfg: PageStoreConfig): PageStore {
  function pathFor(slug: string): string {
    return join(cfg.pagesDir, `${slug}.md`);
  }

  return {
    async read(slug: string): Promise<Page> {
      assertValidSlug(slug);
      const path = pathFor(slug);
      if (!existsSync(path)) throw new Error(`page not found: ${slug}`);
      return parsePage(slug, readFileSync(path, 'utf-8'));
    },

    async write(slug, page, author, summary) {
      assertValidSlug(slug);
      const target = pathFor(slug);
      assertPeekSchemaCurrent(slug, target);
      const tmp = `${target}.tmp`;
      const content = serializePage(page);

      await withLock(slug, async () => {
        const fd = openSync(tmp, 'w');
        try {
          writeFileSync(fd, content);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        renameSync(tmp, target);

        try {
          await addAndCommit(cfg.repoRoot, [target], author, summary);
        } catch (err) {
          await restoreFromIndex(cfg.repoRoot, target);
          throw err;
        }
      });
    },

    async list() {
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
            aliases: page.meta.aliases,
            gedcomRecord: page.meta.gedcom?.record,
            portrait: page.meta.portrait,
            isTalk,
            isArchived: !!page.meta.deletedAt,
          });
        } catch {}
      }
      return out.sort((a, b) => a.slug.localeCompare(b.slug));
    },

    async history(slug, limit = 50) {
      assertValidSlug(slug);
      return fileHistory(cfg.repoRoot, pathFor(slug), limit);
    },

    async softDelete(slug, author) {
      assertValidSlug(slug);
      const src = pathFor(slug);
      if (!existsSync(src)) throw new Error(`page not found: ${slug}`);
      assertPeekSchemaCurrent(slug, src);
      const archivedDir = join(cfg.pagesDir, '_archived');
      const dst = join(archivedDir, `${slug}.md`);

      await withLock(slug, async () => {
        const page = parsePage(slug, readFileSync(src, 'utf-8'));
        page.meta.deletedAt = new Date().toISOString();
        mkdirSync(archivedDir, { recursive: true });
        writeFileSync(dst, serializePage(page));

        const { simpleGit } = await import('simple-git');
        const git = simpleGit(cfg.repoRoot);
        await git.rm([relative(cfg.repoRoot, src)]);
        await git.add(relative(cfg.repoRoot, dst));
        await git.commit(`soft-delete ${slug}`, undefined, {
          '--author': `${author.name} <${author.email}>`,
        });
      });
    },
  };
}
