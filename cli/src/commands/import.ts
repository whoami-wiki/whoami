import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { getDataPath, getArchivePath } from '../data-path.js';
import { UsageError, WaiError } from '../errors.js';
import { type GlobalFlags, outputJson } from '../output.js';

export async function importCommand(
  args: string[],
  globals: GlobalFlags,
): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const archivePath = positionals[0];
  if (!archivePath) throw new UsageError('Usage: wai import <file> [--force] [--dry-run]');

  const resolved = resolve(archivePath);
  if (!existsSync(resolved)) {
    throw new WaiError(`Archive not found: ${resolved}`, 1);
  }

  const dryRun = values['dry-run'] as boolean;
  const force = values.force as boolean;

  // Extract and validate manifest
  let manifestJson: string;
  try {
    manifestJson = execSync(
      `tar -xf ${shellEscape(resolved)} -O manifest.json`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new WaiError('Invalid archive: no manifest.json found', 1);
  }

  let manifest: { version: number; createdAt: string; dbSize: number; imageCount: number; objectCount?: number; snapshotCount?: number };
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    throw new WaiError('Invalid archive: corrupt manifest.json', 1);
  }

  if (manifest.version !== 1) {
    throw new WaiError(`Unsupported archive version: ${manifest.version}`, 1);
  }

  if (dryRun) {
    if (globals.json) {
      outputJson(manifest);
    } else {
      console.log('Archive contents:');
      console.log(`  created:   ${manifest.createdAt}`);
      console.log(`  database:  ${formatSize(manifest.dbSize)}`);
      console.log(`  images:    ${manifest.imageCount}`);
      if (manifest.objectCount) console.log(`  objects:   ${manifest.objectCount}`);
      if (manifest.snapshotCount) console.log(`  snapshots: ${manifest.snapshotCount}`);
    }
    return;
  }

  const dataPath = getDataPath();

  // Check for existing data
  if (existsSync(join(dataPath, 'wiki.sqlite')) && !force) {
    throw new WaiError(
      `Data directory already has a wiki database. Use --force to overwrite.`,
      1,
    );
  }

  // Create data directory if needed
  mkdirSync(dataPath, { recursive: true });

  // Extract wiki data (exclude archive/ which goes elsewhere)
  try {
    execSync(
      `tar -xf ${shellEscape(resolved)} -C ${shellEscape(dataPath)} --exclude=archive`,
      { stdio: 'pipe' },
    );
  } catch (e: any) {
    throw new WaiError(`Failed to extract archive: ${e.message}`, 1);
  }

  // Extract snapshot archive if present in backup
  const snapshotArchivePath = getArchivePath();
  mkdirSync(dirname(snapshotArchivePath), { recursive: true });
  try {
    execSync(
      `tar -xf ${shellEscape(resolved)} -C ${shellEscape(dirname(snapshotArchivePath))} archive`,
      { stdio: 'pipe' },
    );
  } catch {
    // Not present in older backups — OK
  }

  // Ensure expected directories exist
  mkdirSync(join(dataPath, 'images'), { recursive: true });
  mkdirSync(join(dataPath, 'cache'), { recursive: true });

  if (globals.json) {
    outputJson({ restored: true, dataPath, ...manifest });
  } else if (!globals.quiet) {
    console.log(`Imported to ${dataPath}`);
    console.log(`  database:  ${formatSize(manifest.dbSize)}`);
    console.log(`  images:    ${manifest.imageCount}`);
    if (manifest.objectCount) console.log(`  objects:   ${manifest.objectCount}`);
    if (manifest.snapshotCount) console.log(`  snapshots: ${manifest.snapshotCount}`);
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
