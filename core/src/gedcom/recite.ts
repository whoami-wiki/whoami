import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { ReciteEntry, DerivedRecord, SnapshotEntry } from './types.ts';
import { latestSnapshot, readManifest } from './snapshots.ts';

export interface ReciteConfig {
  repoRoot: string;
  genealogyDir: string;
  pagesDir: string;
}

/**
 * Walk every page that pins a `gedcom.snapshot` older than the latest manifest
 * hash and report which fields drifted. Looks up the commit corresponding to a
 * cited snapshot by date (`git log --before=<date+epsilon> -n1 -- snapshots.yml`)
 * — avoids needing a commit SHA in the manifest.
 *
 * Pre-Plan-D snapshots resolve to their import commit, where
 * `genealogy/derived/` doesn't exist yet. recite detects this (record file
 * missing at cited commit) and reports the drift as fully-changed so the user
 * can `applyRecite` to clean up.
 */
export async function reciteDrift(cfg: ReciteConfig): Promise<ReciteEntry[]> {
  const latest = await latestSnapshot(cfg.genealogyDir);
  if (!latest) return [];
  const manifest = await readManifest(cfg.genealogyDir);
  const byHash = new Map(manifest.map(s => [s.hash, s] as const));
  const out: ReciteEntry[] = [];
  const git = simpleGit(cfg.repoRoot);

  for (const file of walkPages(cfg.pagesDir)) {
    const slug = basename(file).replace(/\.md$/, '');
    const text = readFileSync(file, 'utf-8');
    const fm = matter(text);
    const ged = (fm.data as Record<string, unknown>).gedcom as
      | { file?: string; record?: string; snapshot?: string }
      | undefined;
    if (!ged?.snapshot || !ged.record) continue;
    if (ged.snapshot === latest.hash) continue;

    const cited = byHash.get(ged.snapshot);
    if (!cited) continue;

    const oldDerived = await loadDerivedAt(git, cited, ged.record);
    const currentPath = join(cfg.genealogyDir, 'derived', `${ged.record}.yml`);
    if (!existsSync(currentPath)) continue;
    const currentDerived = yaml.load(readFileSync(currentPath, 'utf-8')) as DerivedRecord;

    const changedFields = diffFields(oldDerived, currentDerived);
    if (changedFields.length > 0) {
      out.push({
        slug,
        record: ged.record,
        citedSnapshot: ged.snapshot,
        latestSnapshot: latest.hash,
        changedFields,
      });
    }
  }
  return out;
}

async function loadDerivedAt(
  git: ReturnType<typeof simpleGit>,
  cited: SnapshotEntry,
  record: string,
): Promise<DerivedRecord | null> {
  // Use pickaxe (-S) to find the exact commit that introduced this snapshot hash
  // into snapshots.yml — more precise than date-based lookup which can collide
  // when two syncs happen close together.
  let sha: string | null = null;
  try {
    const out = await git.raw([
      'log',
      '-S', cited.hash,
      '-n', '1',
      '--format=%H',
      '--',
      'genealogy/snapshots.yml',
    ]);
    sha = out.trim() || null;
  } catch { return null; }

  // Fall back to date-based lookup for pre-Plan-D snapshots that may not have
  // their hash string literal in the manifest commit diff.
  if (!sha) {
    const before = new Date(new Date(cited.date).getTime() + 5_000)
      .toISOString()
      .replace(/\.\d+Z$/, 'Z');
    try {
      const out = await git.raw([
        'log',
        `--before=${before}`,
        '-n', '1',
        '--format=%H',
        '--',
        'genealogy/snapshots.yml',
      ]);
      sha = out.trim() || null;
    } catch { return null; }
  }

  if (!sha) return null;

  try {
    const oldText = await git.show([`${sha}:genealogy/derived/${record}.yml`]);
    return yaml.load(oldText) as DerivedRecord;
  } catch {
    return null;
  }
}

function walkPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith('.md')) continue;
    out.push(join(dir, entry.name));
  }
  return out;
}

function diffFields(a: DerivedRecord | null, b: DerivedRecord): string[] {
  if (!a) {
    return ['(record was not in derived/ at cited snapshot — treat as fully drifted)'];
  }
  const fields: (keyof DerivedRecord)[] = [
    'name', 'birth', 'death', 'parents', 'spouses', 'children',
    'residences', 'occupations', 'sources',
  ];
  return fields.filter(f => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
}
