import { parseArgs } from 'node:util';
import { existsSync, statSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataPath } from '../data-path.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) count++;
    else if (entry.isDirectory()) count += countFiles(join(dir, entry.name));
  }
  return count;
}

export async function exportCommand(
  args: string[],
  globals: GlobalFlags,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      'dry-run': { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const outPath = positionals[0];
  if (!outPath) throw new UsageError('Usage: wai export <file> [--dry-run]');

  const dryRun = values['dry-run'] as boolean;
  const dataPath = getDataPath();

  if (!existsSync(dataPath)) {
    throw new WaiError(`Data directory not found: ${dataPath}`, 1);
  }

  const dbPath = join(dataPath, 'wiki.db');
  if (!existsSync(dbPath)) {
    throw new WaiError(`No wiki database found at: ${dbPath}`, 1);
  }

  // Collect files to archive
  const entries: string[] = ['wiki.db'];
  if (existsSync(join(dataPath, 'wiki.db-wal'))) entries.push('wiki.db-wal');
  if (existsSync(join(dataPath, 'wiki.db-shm'))) entries.push('wiki.db-shm');
  if (existsSync(join(dataPath, 'LocalData.php'))) entries.push('LocalData.php');

  const imagesDir = join(dataPath, 'images');
  const imageCount = countFiles(imagesDir);
  if (existsSync(imagesDir)) entries.push('images');

  // Build manifest
  const dbSize = statSync(dbPath).size;
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    dbSize,
    imageCount,
  };

  if (dryRun) {
    if (globals.json) {
      outputJson({ ...manifest, files: entries });
    } else {
      console.log('Would archive:');
      for (const e of entries) {
        console.log(`  ${e}`);
      }
      console.log(`\n  database: ${formatSize(dbSize)}`);
      console.log(`  images:   ${imageCount}`);
    }
    return;
  }

  // Write manifest to temp dir, create archive
  const tmpDir = mkdtempSync(join(tmpdir(), 'wai-export-'));
  try {
    writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    const tarEntries = entries.map((e) => `--include='${e}' --include='${e}/*'`).join(' ');
    const resolved = resolve(outPath);

    execSync(
      `tar -czf ${shellEscape(resolved)} -C ${shellEscape(dataPath)} ${entries.join(' ')} -C ${shellEscape(tmpDir)} manifest.json`,
      { stdio: 'pipe' },
    );

    if (globals.json) {
      outputJson({ file: resolved, ...manifest });
    } else if (!globals.quiet) {
      console.log(`Exported to ${resolved}`);
      console.log(`  database: ${formatSize(dbSize)}`);
      console.log(`  images:   ${imageCount}`);
    }
  } catch (e: any) {
    throw new WaiError(`Failed to create archive: ${e.message}`, 1);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
