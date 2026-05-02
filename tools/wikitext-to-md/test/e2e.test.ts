import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { readPages } from '../src/db.ts';
import { convertPage } from '../src/pipeline.ts';
import { hashGedcom, writeSnapshotManifest } from '../src/gedcom-snapshot.ts';
import { slugify } from '../src/slug.ts';
import { buildTestDb } from './helpers/build-test-db.ts';

test('e2e: synthetic db + ged → expected files in out/', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
  try {
    // 1. Make a tiny .ged
    const gedPath = join(dir, 'tiny.ged');
    writeFileSync(gedPath, '0 HEAD\n1 SOUR test\n');
    const hash = hashGedcom(gedPath);

    // 2. Make a tiny SQLite via the helper, write to disk for realism
    const memDb = buildTestDb([
      { namespace: 0, title: 'Steven_Barash', text: `{{Infobox person|name=Steven Barash}}\n\nBody.\n[[Category:Family]]\n[[Category:People]]\n`, createdAt: '20260429140700' },
      { namespace: 0, title: 'Me', text: '#REDIRECT [[Steven Barash]]', createdAt: '20260429140700' },
    ]);
    const dbPath = join(dir, 'wiki.sqlite');
    await memDb.backup(dbPath);
    memDb.close();

    // 3. Read + convert
    const db = new Database(dbPath, { readonly: true });
    const raw = readPages(db, '20260429140653');
    const results = raw.map(r => convertPage(r, hash, 'steven'));

    // 4. Split + write
    const pagesDir = join(dir, 'pages');
    const genealogyDir = join(dir, 'genealogy');
    mkdirSync(pagesDir, { recursive: true });
    writeSnapshotManifest(genealogyDir, hash, 'tiny.ged', 'test');

    const aliases = new Map<string, string[]>();
    for (const r of results) {
      if (r.kind === 'redirect') {
        const key = r.target.replace(/_/g, ' ');
        const list = aliases.get(key) ?? [];
        list.push(r.fromTitle);
        aliases.set(key, list);
      }
    }
    for (const r of results) {
      if (r.kind !== 'page') continue;
      const slug = slugify(r.title);
      let md = r.md;
      const humanTitle = r.title.replace(/_/g, ' ');
      const al = aliases.get(humanTitle);
      if (al) md = md.replace(/^aliases: \[\]/m, `aliases: [${al.join(', ')}]`);
      writeFileSync(join(pagesDir, `${slug}.md`), md);
    }

    // 5. Assert
    const files = readdirSync(pagesDir);
    assert.deepEqual(files.sort(), ['steven-barash.md']);
    const stevenMd = readFileSync(join(pagesDir, 'steven-barash.md'), 'utf-8');
    assert.match(stevenMd, /title: Steven Barash/);
    assert.match(stevenMd, /aliases: \[Me\]/);
    assert.match(stevenMd, /categories: \[Family, People\]/);
    assert.match(stevenMd, /:::infobox-person/);

    const snapYml = readFileSync(join(genealogyDir, 'snapshots.yml'), 'utf-8');
    assert.match(snapYml, new RegExp(`hash: ${hash}`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
