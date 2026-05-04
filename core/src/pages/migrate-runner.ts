import { readFileSync, writeFileSync, fsyncSync, openSync, closeSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { simpleGit } from 'simple-git';
import {
  CURRENT_SCHEMA_VERSION,
  FutureSchemaVersionError,
  migrate,
} from './migrations/index.ts';
import { parsePageMeta } from './schema.ts';
import { serializePage } from './frontmatter.ts';
import { addAndCommit } from './git.ts';
import type { Page, PageMeta, AuthorIdentity } from './types.ts';

/**
 * Synthetic commit author for migration commits — distinguishes
 * tool-authored schema migrations from user authorship in `git log`.
 */
export const MIGRATE_AUTHOR: AuthorIdentity = {
  name: 'wai migrate',
  email: 'migrate@whoami.local',
};

/** Result of one walk; one entry per file the runner touched. */
export interface MigrateReport {
  walked: number;
  migrated: { slug: string; from: number; to: number }[];
  skipped: { slug: string; version: number }[];
  failed: { slug: string; error: string }[];
}

/**
 * Thrown by runMigrate when the data repo has uncommitted changes
 * and `force: true` was not supplied. The runner does not interleave
 * its commits with in-progress user edits unless explicitly told to.
 */
export class DirtyRepoError extends Error {
  constructor(public readonly repoRoot: string) {
    super(`data repo at ${repoRoot} has uncommitted changes — commit, stash, or rerun with --force`);
    this.name = 'DirtyRepoError';
  }
}

export interface MigrateRunnerOptions {
  repoRoot: string;
  pagesDir: string;
  /** Migrate this slug only; walks both dirs to find it. */
  page?: string;
  /** Compute report without writing. */
  dryRun?: boolean;
  /** Bypass the dirty-repo preflight. */
  force?: boolean;
}

interface WalkedFile {
  absPath: string;
  slug: string;
}

/**
 * Walks pages dir (recursively, picks up `_archived/`), applies any
 * pending migrations, writes each migrated page back atomically and
 * commits it as `chore: migrate <slug> from v<N> to v<M>`.
 *
 * The runner does not enforce the strict-write rule that
 * `store.write` does — that is precisely the rule it must violate.
 * Strict-write callers continue to throw StaleSchemaVersionError
 * until the user runs this.
 */
export async function runMigrate(opts: MigrateRunnerOptions): Promise<MigrateReport> {
  if (!opts.force) {
    const status = await simpleGit(opts.repoRoot).status();
    if (!status.isClean()) throw new DirtyRepoError(opts.repoRoot);
  }

  const files = walk(opts.pagesDir, opts.page);
  const report: MigrateReport = { walked: files.length, migrated: [], skipped: [], failed: [] };

  for (const f of files) {
    const raw = readFileSync(f.absPath, 'utf-8');
    const { data, content } = matter(raw);
    const fromVersion = ((data as { schemaVersion?: unknown }).schemaVersion as number | undefined) ?? 1;

    if (fromVersion > CURRENT_SCHEMA_VERSION) {
      // Whole-run condition: code older than data. Abort; do not
      // touch any files.
      throw new FutureSchemaVersionError(fromVersion, CURRENT_SCHEMA_VERSION);
    }
    if (fromVersion === CURRENT_SCHEMA_VERSION) {
      report.skipped.push({ slug: f.slug, version: fromVersion });
      continue;
    }

    let migratedMeta: PageMeta;
    try {
      const migratedRaw = migrate(data as Record<string, unknown>, fromVersion);
      migratedMeta = parsePageMeta(migratedRaw);
    } catch (err) {
      report.failed.push({
        slug: f.slug,
        error: `migration of ${f.slug} from v${fromVersion} to v${CURRENT_SCHEMA_VERSION} produced invalid frontmatter: ${(err as Error).message}`,
      });
      continue;
    }

    if (opts.dryRun) {
      report.migrated.push({ slug: f.slug, from: fromVersion, to: CURRENT_SCHEMA_VERSION });
      continue;
    }

    try {
      const page: Page = { slug: f.slug, meta: migratedMeta, body: content.trimStart() };
      atomicWrite(f.absPath, serializePage(page));
      await addAndCommit(
        opts.repoRoot,
        [f.absPath],
        MIGRATE_AUTHOR,
        `chore: migrate ${f.slug} from v${fromVersion} to v${CURRENT_SCHEMA_VERSION}`,
      );
      report.migrated.push({ slug: f.slug, from: fromVersion, to: CURRENT_SCHEMA_VERSION });
    } catch (err) {
      report.failed.push({ slug: f.slug, error: (err as Error).message });
    }
  }

  return report;
}

function walk(pagesDir: string, onlySlug?: string): WalkedFile[] {
  const out: WalkedFile[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      const isTalk = entry.name.endsWith('.talk.md');
      const slug = isTalk
        ? entry.name.slice(0, -'.talk.md'.length) + '.talk'
        : entry.name.slice(0, -'.md'.length);
      if (onlySlug && slug !== onlySlug) continue;
      out.push({ absPath: abs, slug });
    }
  };
  visit(pagesDir);
  return out;
}

function atomicWrite(target: string, content: string): void {
  const tmp = `${target}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, target);
}
