import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { SnapshotEntry } from './types.ts';

export async function readManifest(genealogyDir: string): Promise<SnapshotEntry[]> {
  const path = join(genealogyDir, 'snapshots.yml');
  if (!existsSync(path)) return [];
  const parsed = yaml.load(readFileSync(path, 'utf-8'));
  if (!Array.isArray(parsed)) return [];
  return parsed as SnapshotEntry[];
}

/**
 * Append a snapshot entry. If the latest existing entry already has the same
 * hash, this is a no-op and returns false (the .ged hasn't changed).
 */
export async function appendSnapshot(
  genealogyDir: string,
  entry: SnapshotEntry,
): Promise<boolean> {
  const existing = await readManifest(genealogyDir);
  const last = existing[existing.length - 1];
  if (last && last.hash === entry.hash) return false;
  const out = [...existing, entry];
  writeFileSync(join(genealogyDir, 'snapshots.yml'), yaml.dump(out, { lineWidth: 200 }));
  return true;
}

export async function latestSnapshot(genealogyDir: string): Promise<SnapshotEntry | null> {
  const m = await readManifest(genealogyDir);
  return m[m.length - 1] ?? null;
}
