import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

interface Page {
  namespace: number;
  title: string;
  text: string;
  createdAt: string;            // YYYYMMDDHHmmss
}

/**
 * Build an in-memory SQLite database that mimics MediaWiki's storage shape
 * just enough for the converter's reader to work. Schema is the minimum
 * subset required; tables MediaWiki has but we don't read are omitted.
 */
export function buildTestDb(pages: Page[]): DB {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE page (
      page_id INTEGER PRIMARY KEY,
      page_namespace INTEGER NOT NULL,
      page_title TEXT NOT NULL,
      page_latest INTEGER NOT NULL
    );
    CREATE TABLE revision (
      rev_id INTEGER PRIMARY KEY,
      rev_page INTEGER NOT NULL,
      rev_timestamp TEXT NOT NULL
    );
    CREATE TABLE slots (
      slot_revision_id INTEGER NOT NULL,
      slot_content_id INTEGER NOT NULL
    );
    CREATE TABLE content (
      content_id INTEGER PRIMARY KEY,
      content_address TEXT NOT NULL
    );
    CREATE TABLE text (
      old_id INTEGER PRIMARY KEY,
      old_text TEXT NOT NULL
    );
  `);

  const insertPage = db.prepare(
    'INSERT INTO page (page_id, page_namespace, page_title, page_latest) VALUES (?, ?, ?, ?)'
  );
  const insertRev = db.prepare(
    'INSERT INTO revision (rev_id, rev_page, rev_timestamp) VALUES (?, ?, ?)'
  );
  const insertSlot = db.prepare(
    'INSERT INTO slots (slot_revision_id, slot_content_id) VALUES (?, ?)'
  );
  const insertContent = db.prepare(
    'INSERT INTO content (content_id, content_address) VALUES (?, ?)'
  );
  const insertText = db.prepare(
    'INSERT INTO text (old_id, old_text) VALUES (?, ?)'
  );

  pages.forEach((p, idx) => {
    const id = idx + 1;
    insertText.run(id, p.text);
    insertContent.run(id, `tt:${id}`);
    insertSlot.run(id, id);
    insertRev.run(id, id, p.createdAt);
    insertPage.run(id, p.namespace, p.title, id);
  });

  return db;
}
