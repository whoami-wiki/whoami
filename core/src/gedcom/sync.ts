import { existsSync, readdirSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import yaml from 'js-yaml';
import type { DerivedRecord, SyncDiff, SnapshotEntry } from './types.ts';
import type { AuthorIdentity } from '../pages/types.ts';
import { parseGedcomFile } from './parser.ts';
import { deriveIndividual, writeDerivedYaml, hashGedcomFile } from './derive.ts';
import { appendSnapshot, latestSnapshot } from './snapshots.ts';

export interface SyncConfig {
  repoRoot: string;
  genealogyDir: string;
  gedFile: string;
  author: AuthorIdentity;
  notes: string;
}

export type SyncResult =
  | {
      kind: 'wrote';
      diff: SyncDiff;
      commit: string;
      snapshot: SnapshotEntry;
    }
  | {
      kind: 'no-op';
      reason: 'unchanged-hash';
    };

export async function syncGedcom(cfg: SyncConfig): Promise<SyncResult> {
  const gedPath = join(cfg.genealogyDir, cfg.gedFile);
  const hash = await hashGedcomFile(gedPath);
  const last = await latestSnapshot(cfg.genealogyDir);
  const derivedDir = join(cfg.genealogyDir, 'derived');
  // No-op only when the .ged hash is unchanged AND derived/ is already populated.
  // Pre-Plan-D installs (Plan B's migration import) wrote a snapshot entry but
  // not the derived/ tree, so on the first sync after Plan D we want to do the
  // work even though hash matches.
  const derivedReady = existsSync(derivedDir)
    && readdirSync(derivedDir).some(n => n.endsWith('.yml'));
  if (last && last.hash === hash && derivedReady) {
    return { kind: 'no-op', reason: 'unchanged-hash' };
  }

  const parsed = await parseGedcomFile(gedPath);

  // Read existing derived/ for diff
  const existing = new Map<string, string>();
  if (existsSync(derivedDir)) {
    for (const entry of readdirSync(derivedDir)) {
      if (!entry.endsWith('.yml')) continue;
      existing.set(basename(entry, '.yml'), readFileSync(join(derivedDir, entry), 'utf-8'));
    }
  }

  const diff: SyncDiff = { added: [], changed: [], removed: [] };
  const newDerived = new Map<string, DerivedRecord>();
  for (const [record, node] of parsed.individuals) {
    newDerived.set(record, deriveIndividual(node, record, parsed));
  }

  for (const [record, derived] of newDerived) {
    const newText = yaml.dump(derived, { lineWidth: 200, noRefs: true });
    const oldText = existing.get(record);
    if (oldText === undefined) diff.added.push(record);
    else if (oldText !== newText) diff.changed.push(record);
  }
  for (const record of existing.keys()) {
    if (!newDerived.has(record)) diff.removed.push(record);
  }

  // Write all derived files; remove obsolete ones from disk
  mkdirSync(derivedDir, { recursive: true });
  for (const [, derived] of newDerived) {
    await writeDerivedYaml(derivedDir, derived);
  }
  for (const removed of diff.removed) {
    const path = join(derivedDir, `${removed}.yml`);
    if (existsSync(path)) unlinkSync(path);
  }

  // Append snapshot manifest entry — no-ops if hash matches latest (e.g.
  // back-filling derived/ for an existing Plan B snapshot).
  const entry: SnapshotEntry = {
    hash,
    date: new Date().toISOString(),
    file: cfg.gedFile,
    notes: cfg.notes,
  };
  const appended = await appendSnapshot(cfg.genealogyDir, entry);
  // If we didn't append (hash matched Plan B's entry), the canonical snapshot
  // is the existing one. Use it for the result so callers see the real date.
  const effectiveEntry = appended ? entry : (await latestSnapshot(cfg.genealogyDir))!;

  // Single commit. `git add -A <derivedDir>` stages adds, mods, AND deletions.
  const git = simpleGit(cfg.repoRoot);
  await git.raw(['add', '-A', derivedDir]);
  await git.add([join(cfg.genealogyDir, 'snapshots.yml'), gedPath]);
  const result = await git.commit(`gedcom: sync ${cfg.gedFile} (${cfg.notes})`, undefined, {
    '--author': `${cfg.author.name} <${cfg.author.email}>`,
  });

  return {
    kind: 'wrote',
    diff,
    commit: result.commit,
    snapshot: effectiveEntry,
  };
}
