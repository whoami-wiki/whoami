import { parseArgs } from 'node:util';
import { existsSync, statSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { getDataPath, getArchivePath } from '../data-path.js';
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

  const destDir = positionals[0];
  if (!destDir) throw new UsageError('Usage: wai export <dir> [--dry-run]');

  const resolvedDir = resolve(destDir);
  if (!existsSync(resolvedDir)) {
    throw new WaiError(`Destination directory not found: ${resolvedDir}`, 1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const outPath = join(resolvedDir, `whoami-${date}.tar`);

  const dryRun = values['dry-run'] as boolean;
  const dataPath = getDataPath();

  if (!existsSync(dataPath)) {
    throw new WaiError(`Data directory not found: ${dataPath}`, 1);
  }

  const dbPath = join(dataPath, 'wiki.sqlite');
  if (!existsSync(dbPath)) {
    throw new WaiError(`No wiki database found at: ${dbPath}`, 1);
  }

  // Collect files to archive
  const entries: string[] = [];

  // All .sqlite databases and their WAL/SHM files
  const dataFiles = readdirSync(dataPath);
  for (const name of dataFiles) {
    if (name.endsWith('.sqlite') || name.endsWith('.sqlite-wal') || name.endsWith('.sqlite-shm')) {
      entries.push(name);
    }
  }

  if (existsSync(join(dataPath, 'LocalData.php'))) entries.push('LocalData.php');

  const imagesDir = join(dataPath, 'images');
  const imageCount = countFiles(imagesDir);
  if (existsSync(imagesDir)) entries.push('images');

  // Check for snapshot archive
  const archivePath = getArchivePath();
  const hasArchive = existsSync(archivePath);
  const objectCount = hasArchive ? countFiles(join(archivePath, 'objects')) : 0;
  const snapshotCount = hasArchive ? countFiles(join(archivePath, 'snapshots')) : 0;

  // Build manifest
  const dbSize = statSync(dbPath).size;
  const manifest: Record<string, unknown> = {
    version: 1,
    createdAt: new Date().toISOString(),
    dbSize,
    imageCount,
  };
  if (hasArchive) {
    manifest.objectCount = objectCount;
    manifest.snapshotCount = snapshotCount;
  }

  if (dryRun) {
    if (globals.json) {
      outputJson({ ...manifest, files: entries });
    } else {
      console.log('Would archive:');
      for (const e of entries) {
        console.log(`  ${e}`);
      }
      if (hasArchive) console.log('  archive/');
      console.log(`\n  database:  ${formatSize(dbSize)}`);
      console.log(`  images:    ${imageCount}`);
      if (hasArchive) {
        console.log(`  objects:   ${objectCount}`);
        console.log(`  snapshots: ${snapshotCount}`);
      }
    }
    return;
  }

  // Write manifest to temp dir, create archive
  const tmpDir = mkdtempSync(join(tmpdir(), 'wai-export-'));
  try {
    writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    let tarCmd = `tar -cf ${shellEscape(outPath)} -C ${shellEscape(dataPath)} ${entries.join(' ')}`;
    if (hasArchive) {
      tarCmd += ` -C ${shellEscape(dirname(archivePath))} archive`;
    }
    tarCmd += ` -C ${shellEscape(tmpDir)} manifest.json`;
    execSync(tarCmd, { stdio: 'pipe' });

    if (globals.json) {
      outputJson({ file: outPath, ...manifest });
    } else if (!globals.quiet) {
      console.log(`Exported to ${outPath}`);
      console.log(`  database:  ${formatSize(dbSize)}`);
      console.log(`  images:    ${imageCount}`);
      if (hasArchive) {
        console.log(`  objects:   ${objectCount}`);
        console.log(`  snapshots: ${snapshotCount}`);
      }
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
