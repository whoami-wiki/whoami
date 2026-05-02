import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export function hashGedcom(path: string): string {
  const data = readFileSync(path);
  return createHash('sha256').update(data).digest('hex');
}

interface SnapshotEntry {
  hash: string;
  date: string;            // ISO 8601
  file: string;
  notes: string;
}

export function writeSnapshotManifest(
  genealogyDir: string,
  hash: string,
  file: string,
  notes: string,
): void {
  mkdirSync(genealogyDir, { recursive: true });
  const path = join(genealogyDir, 'snapshots.yml');
  let entries: SnapshotEntry[] = [];
  if (existsSync(path)) {
    const parsed = yaml.load(readFileSync(path, 'utf-8'));
    if (Array.isArray(parsed)) entries = parsed as SnapshotEntry[];
  }
  entries.push({
    hash,
    date: new Date().toISOString(),
    file,
    notes,
  });
  writeFileSync(path, yaml.dump(entries, { lineWidth: 200 }));
}
