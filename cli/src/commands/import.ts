import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { getDataPath } from '../data-path.js';
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
      `tar -xzf ${shellEscape(resolved)} -O manifest.json`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    throw new WaiError('Invalid archive: no manifest.json found', 1);
  }

  let manifest: { version: number; createdAt: string; dbSize: number; imageCount: number };
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
      console.log(`  created:  ${manifest.createdAt}`);
      console.log(`  database: ${formatSize(manifest.dbSize)}`);
      console.log(`  images:   ${manifest.imageCount}`);
    }
    return;
  }

  const dataPath = getDataPath();

  // Check for existing data
  if (existsSync(join(dataPath, 'wiki.db')) && !force) {
    throw new WaiError(
      `Data directory already has a wiki database. Use --force to overwrite.`,
      1,
    );
  }

  // Create data directory if needed
  mkdirSync(dataPath, { recursive: true });

  // Extract archive
  try {
    execSync(
      `tar -xzf ${shellEscape(resolved)} -C ${shellEscape(dataPath)}`,
      { stdio: 'pipe' },
    );
  } catch (e: any) {
    throw new WaiError(`Failed to extract archive: ${e.message}`, 1);
  }

  // Ensure expected directories exist
  mkdirSync(join(dataPath, 'images'), { recursive: true });
  mkdirSync(join(dataPath, 'cache'), { recursive: true });

  if (globals.json) {
    outputJson({ restored: true, dataPath, ...manifest });
  } else if (!globals.quiet) {
    console.log(`Imported to ${dataPath}`);
    console.log(`  database: ${formatSize(manifest.dbSize)}`);
    console.log(`  images:   ${manifest.imageCount}`);
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
