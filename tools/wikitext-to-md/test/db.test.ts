import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPages } from '../src/db.ts';
import { buildTestDb } from './helpers/build-test-db.ts';

const CUTOFF = '20260429140653';

test('readPages: includes pages whose first revision is at or after cutoff', () => {
  const db = buildTestDb([
    { namespace: 0, title: 'Pre',  text: 'old',  createdAt: '20260420000000' },
    { namespace: 0, title: 'Post', text: 'new',  createdAt: '20260429140700' },
    { namespace: 0, title: 'Edge', text: 'edge', createdAt: CUTOFF },
  ]);
  const pages = readPages(db, CUTOFF);
  const titles = pages.map(p => p.title).sort();
  assert.deepEqual(titles, ['Edge', 'Post']);
});

test('readPages: excludes Module: namespace (NS 828) entirely', () => {
  const db = buildTestDb([
    { namespace: 0,   title: 'Person',     text: 'x', createdAt: '20260429140700' },
    { namespace: 828, title: 'UpgradeTest', text: 'y', createdAt: '20260429140700' },
  ]);
  const pages = readPages(db, CUTOFF);
  const titles = pages.map(p => p.title);
  assert.deepEqual(titles, ['Person']);
});

test('readPages: returns latest revision text', () => {
  const db = buildTestDb([
    { namespace: 0, title: 'Page', text: 'first',  createdAt: '20260429140700' },
  ]);
  // Insert a second revision manually
  db.exec(`INSERT INTO text (old_id, old_text) VALUES (99, 'latest');`);
  db.exec(`INSERT INTO content (content_id, content_address) VALUES (99, 'tt:99');`);
  db.exec(`INSERT INTO revision (rev_id, rev_page, rev_timestamp) VALUES (99, 1, '20260430120000');`);
  db.exec(`INSERT INTO slots (slot_revision_id, slot_content_id) VALUES (99, 99);`);
  db.exec(`UPDATE page SET page_latest = 99 WHERE page_id = 1;`);

  const pages = readPages(db, CUTOFF);
  assert.equal(pages.length, 1);
  assert.equal(pages[0]!.text, 'latest');
});

test('readPages: createdAt is the FIRST revision timestamp, not latest', () => {
  const db = buildTestDb([
    { namespace: 0, title: 'Page', text: 'first', createdAt: '20260429140700' },
  ]);
  db.exec(`INSERT INTO revision (rev_id, rev_page, rev_timestamp) VALUES (99, 1, '20260501000000');`);

  const pages = readPages(db, CUTOFF);
  assert.equal(pages[0]!.createdAt, '20260429140700');
});
