import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SearchIndex } from './index.ts';

/** Serialize the index's shards to a single JSON file (atomic write). */
export async function saveSearchIndex(idx: SearchIndex, path: string): Promise<void> {
  const shards: Record<string, unknown> = {};
  await idx._raw().export((key, data) => {
    shards[String(key)] = data;
  });
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(shards), 'utf-8');
  renameSync(tmp, path);
}

/** Load shards into an existing index. Returns false on missing/corrupt. */
export async function loadSearchIndex(idx: SearchIndex, path: string): Promise<boolean> {
  let shards: Record<string, unknown>;
  try {
    shards = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return false;
  }
  if (!shards || typeof shards !== 'object') return false;
  for (const [key, data] of Object.entries(shards)) {
    idx._raw().import(key, data as never);
  }
  return true;
}
