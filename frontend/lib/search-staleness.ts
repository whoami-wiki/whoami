import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Returns true if the search index file is missing, or any non-archived
 * .md page in pagesDir has an mtime newer than the index file.
 *
 * Sync, no globals — safe to call from request paths. ~100–2000 statSync
 * calls per invocation; sub-millisecond at current scale.
 */
export function isSearchIndexStale(pagesDir: string, indexPath: string): boolean {
  if (!existsSync(indexPath)) return true;
  // Subtract 1 ms from the index mtime before comparing. utimesSync stores
  // timestamps with ~1/1024 ms precision loss on macOS APFS (a page touched at
  // time T via utimesSync is recorded at T − 1/1024 ms), so using a 1 ms
  // tolerance ensures a page "bumped to now" after the index was written is
  // correctly classified as stale even when both fall in the same millisecond.
  const indexMtime = statSync(indexPath).mtimeMs - 1;
  for (const entry of readdirSync(pagesDir)) {
    if (entry.startsWith('_')) continue;
    if (!entry.endsWith('.md')) continue;
    const mtime = statSync(join(pagesDir, entry)).mtimeMs;
    if (mtime > indexMtime) return true;
  }
  return false;
}
