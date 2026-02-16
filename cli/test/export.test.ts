import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { exportCommand } from '../src/commands/export.js';

// ── Helpers ───────────────────────────────────────────────────────────

const TAR_NAME = `whoami-${new Date().toISOString().slice(0, 10)}.tar`;

/** Create a fake data directory that looks like the wiki data path. */
function makeFakeDataDir(tmp: string): string {
  const dataPath = join(tmp, 'data');
  mkdirSync(dataPath, { recursive: true });
  writeFileSync(join(dataPath, 'wiki.sqlite'), 'fake-sqlite-db');
  writeFileSync(join(dataPath, 'LocalData.php'), '<?php $secret = "s";');
  const imagesDir = join(dataPath, 'images');
  mkdirSync(imagesDir, { recursive: true });
  writeFileSync(join(imagesDir, 'photo.jpg'), 'fake-jpg');
  writeFileSync(join(imagesDir, 'icon.png'), 'fake-png');
  return dataPath;
}

function runWithDataPath(dataPath: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.WAI_DATA_PATH;
  process.env.WAI_DATA_PATH = dataPath;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.WAI_DATA_PATH;
    else process.env.WAI_DATA_PATH = prev;
  });
}

// ── exportCommand ─────────────────────────────────────────────────────

describe('exportCommand', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-export-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('throws UsageError when no dir given', async () => {
    await assert.rejects(
      () => exportCommand([], { json: false, quiet: false }),
      { name: 'UsageError' },
    );
  });

  it('throws when destination directory does not exist', async () => {
    const dataPath = makeFakeDataDir(tmp);
    await assert.rejects(
      () => runWithDataPath(dataPath, () =>
        exportCommand([join(tmp, 'nonexistent')], { json: false, quiet: false }),
      ),
      { name: 'WaiError' },
    );
  });

  it('throws when wiki.sqlite does not exist', async () => {
    const dataPath = join(tmp, 'empty-data');
    mkdirSync(dataPath, { recursive: true });
    const outDir = join(tmp, 'out');
    mkdirSync(outDir);

    await assert.rejects(
      () => runWithDataPath(dataPath, () =>
        exportCommand([outDir], { json: false, quiet: false }),
      ),
      { name: 'WaiError' },
    );
  });

  it('dry run lists contents without creating archive', async () => {
    const dataPath = makeFakeDataDir(tmp);
    const outDir = join(tmp, 'out');
    mkdirSync(outDir);

    await runWithDataPath(dataPath, () =>
      exportCommand([outDir, '--dry-run'], { json: false, quiet: false }),
    );

    assert.equal(readdirSync(outDir).length, 0);
  });

  it('dry run with --json outputs manifest', async () => {
    const dataPath = makeFakeDataDir(tmp);
    const outDir = join(tmp, 'out');
    mkdirSync(outDir);
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await runWithDataPath(dataPath, () =>
        exportCommand([outDir, '--dry-run'], { json: true, quiet: false }),
      );
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.version, 1);
      assert.equal(output.imageCount, 2);
      assert.ok(output.files.includes('wiki.sqlite'));
      assert.ok(output.files.includes('images'));
    } finally {
      console.log = origLog;
    }
  });

  it('creates YYYY-MM-DD.tar with correct contents', async () => {
    const dataPath = makeFakeDataDir(tmp);
    const outDir = join(tmp, 'out');
    mkdirSync(outDir);

    await runWithDataPath(dataPath, () =>
      exportCommand([outDir], { json: false, quiet: true }),
    );

    const tarPath = join(outDir, TAR_NAME);
    assert.ok(existsSync(tarPath));

    const listing = execSync(`tar -tf '${tarPath}'`, { encoding: 'utf-8' });
    assert.ok(listing.includes('wiki.sqlite'));
    assert.ok(listing.includes('manifest.json'));
    assert.ok(listing.includes('LocalData.php'));
    assert.ok(listing.includes('images/'));
  });

  it('includes WAL file when present', async () => {
    const dataPath = makeFakeDataDir(tmp);
    writeFileSync(join(dataPath, 'wiki.sqlite-wal'), 'wal-data');
    const outDir = join(tmp, 'out');
    mkdirSync(outDir);

    await runWithDataPath(dataPath, () =>
      exportCommand([outDir], { json: false, quiet: true }),
    );

    const tarPath = join(outDir, TAR_NAME);
    const listing = execSync(`tar -tf '${tarPath}'`, { encoding: 'utf-8' });
    assert.ok(listing.includes('wiki.sqlite-wal'));
  });

  it('json output includes file path and manifest data', async () => {
    const dataPath = makeFakeDataDir(tmp);
    const outDir = join(tmp, 'out');
    mkdirSync(outDir);
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await runWithDataPath(dataPath, () =>
        exportCommand([outDir], { json: true, quiet: false }),
      );
      const output = JSON.parse(logs[logs.length - 1]);
      assert.ok(output.file.endsWith(TAR_NAME));
      assert.equal(output.version, 1);
      assert.equal(output.imageCount, 2);
      assert.ok(output.dbSize > 0);
    } finally {
      console.log = origLog;
    }
  });
});
