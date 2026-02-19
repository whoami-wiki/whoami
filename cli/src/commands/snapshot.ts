import { parseArgs } from 'node:util';
import { readdirSync, statSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, extname, basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { UsageError, WaiError, ConflictError } from '../errors.js';
import { getArchivePath } from '../data-path.js';
import { type GlobalFlags, outputJson } from '../output.js';
import type { WikiClient } from '../wiki-client.js';

interface HashedFile {
  path: string;
  hash: string;
  size: number;
}

export async function snapshotCommand(
  args: string[],
  globals: GlobalFlags,
  client: WikiClient,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      name: { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  });

  const dir = positionals[0];
  if (!dir) throw new UsageError('Usage: wai snapshot <dir> [--name "Source Name"] [--dry-run]');

  const resolvedDir = resolve(dir);
  const dryRun = values['dry-run'] as boolean | undefined;
  const sourceName = (values.name as string | undefined) || basename(resolvedDir);

  // 1. Walk directory and hash files
  const files = walkAndHash(resolvedDir);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // 2. Build manifest (path + hash only, sorted by path)
  const manifest = {
    files: files
      .map((f) => ({ path: f.path, hash: f.hash }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };

  // 3. Derive deterministic snapshot ID
  const manifestJson = JSON.stringify(manifest, null, 2);
  const snapshotId = createHash('sha256').update(manifestJson).digest('hex').slice(0, 16);

  // 4. Copy files to content-addressable store
  const archiveDir = getArchivePath();
  const objectsDir = join(archiveDir, 'objects');
  const snapshotsDir = join(archiveDir, 'snapshots');
  let newObjects = 0;

  if (!dryRun) {
    for (const file of files) {
      const prefix = file.hash.slice(0, 2);
      const objectDir = join(objectsDir, prefix);
      const objectPath = join(objectDir, file.hash);
      if (!existsSync(objectPath)) {
        mkdirSync(objectDir, { recursive: true });
        const srcPath = join(resolvedDir, file.path);
        copyFileSync(srcPath, objectPath);
        // Verify the copy landed on disk
        const written = statSync(objectPath, { throwIfNoEntry: false });
        if (!written || written.size !== file.size) {
          throw new WaiError(
            `Failed to write object ${file.hash} (expected ${file.size} bytes, got ${written?.size ?? 0})`,
            1,
          );
        }
        newObjects++;
      }
    }

    // 5. Write snapshot manifest
    mkdirSync(snapshotsDir, { recursive: true });
    const snapshotPath = join(snapshotsDir, `${snapshotId}.json`);
    const snapshotContent = manifestJson + '\n';
    writeFileSync(snapshotPath, snapshotContent);
    // Verify the snapshot was written correctly
    const writtenSnapshot = statSync(snapshotPath, { throwIfNoEntry: false });
    if (!writtenSnapshot || writtenSnapshot.size !== Buffer.byteLength(snapshotContent)) {
      throw new WaiError(
        `Failed to write snapshot ${snapshotId}.json (expected ${Buffer.byteLength(snapshotContent)} bytes, got ${writtenSnapshot?.size ?? 0})`,
        1,
      );
    }
  } else {
    // Count what would be new
    for (const file of files) {
      const prefix = file.hash.slice(0, 2);
      const objectPath = join(objectsDir, prefix, file.hash);
      if (!existsSync(objectPath)) newObjects++;
    }
  }

  // 6. Create source page
  const sourceTitle = `Source:${sourceName}`;
  let sourceCreated = false;
  let sourceSkipped = false;

  if (!dryRun) {
    const pageContent = buildSourcePage(snapshotId, files, totalSize, basename(resolvedDir));
    try {
      await client.createPage(sourceTitle, pageContent, `Snapshot ${snapshotId}`);
      sourceCreated = true;
    } catch (e) {
      if (e instanceof ConflictError) {
        sourceSkipped = true;
      } else {
        throw e;
      }
    }
  }

  // 7. Output
  if (globals.json) {
    outputJson({
      snapshotId,
      files: files.length,
      totalSize,
      newObjects,
      sourcePage: sourceTitle,
    });
  } else {
    console.log(`Archived ${dir}`);
    console.log(`  files:    ${files.length}`);
    console.log(`  size:     ${formatSize(totalSize)}`);
    console.log(`  new:      ${newObjects} (objects added)`);
    console.log(`  snapshot: ${snapshotId}`);
    console.log(`  source:   ${sourceTitle}`);
    if (dryRun) console.log('  (dry run — nothing written)');
    if (sourceSkipped) console.log(`  note: ${sourceTitle} already exists, skipped`);
  }
}

function walkAndHash(dir: string, base?: string): HashedFile[] {
  const root = base || dir;
  const entries: HashedFile[] = [];

  let items: string[];
  try {
    items = readdirSync(dir);
  } catch (e: any) {
    throw new WaiError(`Cannot read directory: ${dir} (${e.message})`, 1);
  }

  for (const name of items) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        entries.push(...walkAndHash(full, root));
      } else if (stat.isFile()) {
        const content = readFileSync(full);
        const hash = createHash('sha256').update(content).digest('hex');
        entries.push({
          path: relative(root, full),
          hash,
          size: stat.size,
        });
      }
    } catch (e: any) {
      console.warn(`warning: skipping ${full}: ${e.message}`);
    }
  }

  return entries;
}

function buildSourcePage(
  snapshotId: string,
  files: HashedFile[],
  totalSize: number,
  dirName: string,
): string {
  // Count extensions
  const extCounts: Record<string, number> = {};
  for (const f of files) {
    const ext = extname(f.path).toLowerCase() || '(none)';
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  }
  const sortedExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);

  let page = `{{Source\n|snapshot=${snapshotId}\n|files=${files.length}\n|size=${formatSize(totalSize)}\n}}\nA data snapshot of ${dirName}.\n\n== File types ==\n{| class="wikitable sortable"\n! Extension !! Count\n`;
  for (const [ext, count] of sortedExts) {
    page += `|-\n| ${ext} || ${count}\n`;
  }
  page += `|}\n\n[[Category:Sources]]`;

  return page;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}
