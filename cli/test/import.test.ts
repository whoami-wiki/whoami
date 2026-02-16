import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { importCommand } from '../src/commands/import.js';

// ── Helpers ───────────────────────────────────────────────────────────

/** Create a valid backup archive in tmp. */
function makeArchive(tmp: string, opts?: { imageCount?: number }): string {
  const staging = join(tmp, 'staging');
  mkdirSync(staging, { recursive: true });
  writeFileSync(join(staging, 'wiki.db'), 'fake-sqlite-db');
  writeFileSync(join(staging, 'LocalData.php'), '<?php $secret = "s";');

  const imagesDir = join(staging, 'images');
  mkdirSync(imagesDir, { recursive: true });
  const count = opts?.imageCount ?? 1;
  for (let i = 0; i < count; i++) {
    writeFileSync(join(imagesDir, `img${i}.jpg`), `fake-${i}`);
  }

  const manifest = {
    version: 1,
    createdAt: '2025-01-15T10:00:00.000Z',
    dbSize: 15,
    imageCount: count,
  };
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const archivePath = join(tmp, 'backup.tar.gz');
  execSync(`tar -czf '${archivePath}' -C '${staging}' wiki.db LocalData.php images manifest.json`);
  return archivePath;
}

function runWithDataPath(dataPath: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.WAI_DATA_PATH;
  process.env.WAI_DATA_PATH = dataPath;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.WAI_DATA_PATH;
    else process.env.WAI_DATA_PATH = prev;
  });
}

// ── importCommand ────────────────────────────────────────────────────

describe('importCommand', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-restore-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('throws UsageError when no file given', async () => {
    await assert.rejects(
      () => importCommand([], { json: false, quiet: false }),
      { name: 'UsageError' },
    );
  });

  it('throws when archive does not exist', async () => {
    await assert.rejects(
      () => importCommand([join(tmp, 'nope.tar.gz')], { json: false, quiet: false }),
      { name: 'WaiError' },
    );
  });

  it('throws on archive without manifest', async () => {
    const badArchive = join(tmp, 'bad.tar.gz');
    const staging = join(tmp, 'bad-staging');
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'junk.txt'), 'not a backup');
    execSync(`tar -czf '${badArchive}' -C '${staging}' junk.txt`);

    await assert.rejects(
      () => importCommand([badArchive], { json: false, quiet: false }),
      { name: 'WaiError', message: /no manifest.json/ },
    );
  });

  it('dry run shows manifest without extracting', async () => {
    const archivePath = makeArchive(tmp);
    const dataPath = join(tmp, 'data');

    await runWithDataPath(dataPath, () =>
      importCommand([archivePath, '--dry-run'], { json: false, quiet: false }),
    );

    assert.equal(existsSync(dataPath), false);
  });

  it('dry run with --json outputs manifest', async () => {
    const archivePath = makeArchive(tmp, { imageCount: 3 });
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await runWithDataPath(join(tmp, 'data'), () =>
        importCommand([archivePath, '--dry-run'], { json: true, quiet: false }),
      );
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.version, 1);
      assert.equal(output.imageCount, 3);
      assert.equal(output.createdAt, '2025-01-15T10:00:00.000Z');
    } finally {
      console.log = origLog;
    }
  });

  it('refuses to overwrite existing data without --force', async () => {
    const archivePath = makeArchive(tmp);
    const dataPath = join(tmp, 'data');
    mkdirSync(dataPath, { recursive: true });
    writeFileSync(join(dataPath, 'wiki.db'), 'existing');

    await assert.rejects(
      () => runWithDataPath(dataPath, () =>
        importCommand([archivePath], { json: false, quiet: false }),
      ),
      { name: 'WaiError', message: /--force/ },
    );
  });

  it('restores with --force when data exists', async () => {
    const archivePath = makeArchive(tmp);
    const dataPath = join(tmp, 'data');
    mkdirSync(dataPath, { recursive: true });
    writeFileSync(join(dataPath, 'wiki.db'), 'old-data');

    await runWithDataPath(dataPath, () =>
      importCommand([archivePath, '--force'], { json: false, quiet: true }),
    );

    const restored = readFileSync(join(dataPath, 'wiki.db'), 'utf-8');
    assert.equal(restored, 'fake-sqlite-db');
  });

  it('extracts all files to data directory', async () => {
    const archivePath = makeArchive(tmp, { imageCount: 2 });
    const dataPath = join(tmp, 'data');

    await runWithDataPath(dataPath, () =>
      importCommand([archivePath], { json: false, quiet: true }),
    );

    assert.ok(existsSync(join(dataPath, 'wiki.db')));
    assert.ok(existsSync(join(dataPath, 'LocalData.php')));
    assert.ok(existsSync(join(dataPath, 'manifest.json')));
    assert.ok(existsSync(join(dataPath, 'images', 'img0.jpg')));
    assert.ok(existsSync(join(dataPath, 'images', 'img1.jpg')));
    // Should create cache dir even though it's not in archive
    assert.ok(existsSync(join(dataPath, 'cache')));
  });

  it('creates data directory if it does not exist', async () => {
    const archivePath = makeArchive(tmp);
    const dataPath = join(tmp, 'nested', 'deep', 'data');

    await runWithDataPath(dataPath, () =>
      importCommand([archivePath], { json: false, quiet: true }),
    );

    assert.ok(existsSync(join(dataPath, 'wiki.db')));
  });

  it('json output includes restore details', async () => {
    const archivePath = makeArchive(tmp);
    const dataPath = join(tmp, 'data');
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await runWithDataPath(dataPath, () =>
        importCommand([archivePath], { json: true, quiet: false }),
      );
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.restored, true);
      assert.equal(output.dataPath, dataPath);
      assert.equal(output.version, 1);
    } finally {
      console.log = origLog;
    }
  });
});
