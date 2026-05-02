import type { Database } from 'better-sqlite3';
import type { RawPage } from './types.ts';

/**
 * Read pages from the legacy MediaWiki SQLite that pass the migration
 * cutoff filter:
 *   - first revision timestamp >= cutoff (post-`.ged`-import only)
 *   - namespace != 828 (drop Scribunto Module: namespace; Scribunto is removed)
 *
 * Returns the latest revision's text for each surviving page.
 */
export function readPages(db: Database, cutoff: string): RawPage[] {
  const rows = db.prepare(`
    SELECT
      p.page_namespace AS namespace,
      p.page_title AS title,
      t.old_text AS text,
      (SELECT MIN(rev_timestamp) FROM revision WHERE rev_page = p.page_id) AS createdAt
    FROM page p
    JOIN revision r ON p.page_latest = r.rev_id
    JOIN slots s ON s.slot_revision_id = r.rev_id
    JOIN content c ON s.slot_content_id = c.content_id
    JOIN text t ON CAST(SUBSTR(c.content_address, 4) AS INTEGER) = t.old_id
    WHERE p.page_namespace <> 828
      AND (SELECT MIN(rev_timestamp) FROM revision WHERE rev_page = p.page_id) >= ?
  `).all(cutoff) as Array<{ namespace: number; title: string; text: string; createdAt: string }>;

  return rows;
}
