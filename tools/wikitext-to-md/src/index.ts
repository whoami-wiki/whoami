#!/usr/bin/env -S npx tsx
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { readPages } from './db.ts';
import { convertPage, type ConvertResult } from './pipeline.ts';
import { hashGedcom, writeSnapshotManifest } from './gedcom-snapshot.ts';
import { slugify } from './slug.ts';
import type { Report, Warning } from './types.ts';

const CUTOFF = '20260429140653';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      db:        { type: 'string' },
      ged:       { type: 'string' },
      out:       { type: 'string' },
      genealogy: { type: 'string' },
      owner:     { type: 'string', default: 'steven' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  for (const k of ['db', 'ged', 'out', 'genealogy'] as const) {
    if (!values[k]) {
      console.error(`error: --${k} is required`);
      process.exit(2);
    }
  }

  const db = new Database(values.db!, { readonly: true });
  const ged = values.ged!;
  const out = values.out!;
  const genealogy = values.genealogy!;
  const owner = values.owner!;
  const dryRun = values['dry-run']!;

  // 1. Hash the .ged and write the initial snapshots manifest
  const hash = hashGedcom(ged);
  if (!dryRun) {
    mkdirSync(genealogy, { recursive: true });
    writeSnapshotManifest(genealogy, hash, 'barash-tree.ged', 'Initial migration import');
  }

  // 2. Read pages from the legacy DB
  const raw = readPages(db, CUTOFF);
  console.log(`Read ${raw.length} post-cutoff pages from ${values.db}`);

  // 3. Convert each page; partition into pages and redirects
  const results: ConvertResult[] = raw.map(p => convertPage(p, hash, owner));
  const pages = results.filter(r => r.kind === 'page') as Extract<ConvertResult, { kind: 'page' }>[];
  const redirects = results.filter(r => r.kind === 'redirect') as Extract<ConvertResult, { kind: 'redirect' }>[];

  // 4. Apply redirects to targets as aliases.
  // MediaWiki page titles use underscores (`Steven_Barash`); wikilink targets in
  // `#REDIRECT [[Steven Barash]]` use spaces. Normalize both sides to spaces before
  // comparing — the canonical human-readable form.
  const canon = (s: string) => s.replace(/_/g, ' ');
  const aliasesByTarget = new Map<string, string[]>();
  for (const r of redirects) {
    const key = canon(r.target);
    const list = aliasesByTarget.get(key) ?? [];
    list.push(canon(r.fromTitle));
    aliasesByTarget.set(key, list);
  }

  // 5. Write each page (with merged aliases)
  if (!dryRun) mkdirSync(out, { recursive: true });

  let pagesWritten = 0;
  const warnings: Warning[] = [];
  for (const p of pages) {
    const slug = slugify(p.title);
    const aliases = aliasesByTarget.get(canon(p.title)) ?? [];
    const md = aliases.length > 0 ? insertAliases(p.md, aliases) : p.md;
    // Talk pages (NS 1) become `<slug>.talk.md` siblings of their main page.
    const filename = p.namespace === 1 ? `${slug}.talk.md` : `${slug}.md`;
    const path = join(out, filename);
    if (!dryRun) writeFileSync(path, md);
    pagesWritten += 1;
    warnings.push(...p.warnings);
  }

  // 6. Emit warnings log
  if (warnings.length > 0 && !dryRun) {
    const logPath = join(out, 'migration-warnings.log');
    const log = warnings.map(w => `${w.page}\t${w.kind}\t${w.detail}`).join('\n');
    writeFileSync(logPath, log + '\n');
  }

  const report: Report = {
    pagesWritten,
    pagesSkipped: raw.length - results.length,
    redirects: redirects.length,
    warnings,
    snapshotHash: hash,
  };
  console.log(JSON.stringify(report, null, 2));
}

function insertAliases(md: string, aliases: string[]): string {
  // Replace the existing aliases line with the merged set
  return md.replace(
    /^aliases: \[\]/m,
    `aliases: [${aliases.join(', ')}]`,
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
