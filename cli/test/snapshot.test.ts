import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { snapshotCommand } from '../src/commands/snapshot.js';
import type { WikiClient } from '../src/wiki-client.js';

// ── Helpers ───────────────────────────────────────────────────────────

function mockClient(overrides: Partial<Record<string, any>> = {}): WikiClient {
  return {
    createPage: async () => ({}),
    ...overrides,
  } as unknown as WikiClient;
}

const globals = { json: false, quiet: false };

function runWithArchivePath(archivePath: string, fn: () => Promise<void>): Promise<void> {
  const prev = process.env.WAI_ARCHIVE_PATH;
  process.env.WAI_ARCHIVE_PATH = archivePath;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.WAI_ARCHIVE_PATH;
    else process.env.WAI_ARCHIVE_PATH = prev;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('snapshotCommand', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-snapshot-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('throws UsageError when no dir given', async () => {
    await assert.rejects(
      () => snapshotCommand([], globals, mockClient()),
      { name: 'UsageError' },
    );
  });

  it('writes object files and snapshot JSON', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'hello.txt'), 'hello world');

    const archiveDir = join(tmp, 'archive');

    await runWithArchivePath(archiveDir, () =>
      snapshotCommand([sourceDir], { json: false, quiet: true }, mockClient()),
    );

    // Snapshot JSON should exist
    const snapshotsDir = join(archiveDir, 'snapshots');
    assert.ok(existsSync(snapshotsDir), 'snapshots dir should exist');
    const snapshots = readdirSync(snapshotsDir);
    assert.equal(snapshots.length, 1);
    assert.ok(snapshots[0].endsWith('.json'));

    // Object file should exist
    const objectsDir = join(archiveDir, 'objects');
    assert.ok(existsSync(objectsDir), 'objects dir should exist');

    // Verify the object content is addressable by hash
    const content = Buffer.from('hello world');
    const hash = createHash('sha256').update(content).digest('hex');
    const prefix = hash.slice(0, 2);
    const objectPath = join(objectsDir, prefix, hash);
    assert.ok(existsSync(objectPath), 'object file should exist at content-addressable path');
    assert.equal(readFileSync(objectPath, 'utf-8'), 'hello world');
  });

  it('snapshot JSON contains correct manifest', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'a.txt'), 'aaa');
    writeFileSync(join(sourceDir, 'b.txt'), 'bbb');

    const archiveDir = join(tmp, 'archive');

    await runWithArchivePath(archiveDir, () =>
      snapshotCommand([sourceDir], { json: false, quiet: true }, mockClient()),
    );

    const snapshotsDir = join(archiveDir, 'snapshots');
    const snapshotFile = readdirSync(snapshotsDir)[0];
    const manifest = JSON.parse(readFileSync(join(snapshotsDir, snapshotFile), 'utf-8'));

    assert.equal(manifest.files.length, 2);
    const paths = manifest.files.map((f: any) => f.path).sort();
    assert.deepEqual(paths, ['a.txt', 'b.txt']);
  });

  it('dry run does not write anything', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'hello.txt'), 'hello world');

    const archiveDir = join(tmp, 'archive');

    await runWithArchivePath(archiveDir, () =>
      snapshotCommand([sourceDir, '--dry-run'], { json: false, quiet: true }, mockClient()),
    );

    assert.equal(existsSync(archiveDir), false, 'archive dir should not be created on dry run');
  });

  it('skips existing objects (deduplication)', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'hello.txt'), 'hello world');

    const archiveDir = join(tmp, 'archive');

    // Run twice
    await runWithArchivePath(archiveDir, () =>
      snapshotCommand([sourceDir], { json: false, quiet: true }, mockClient()),
    );

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await runWithArchivePath(archiveDir, () =>
        snapshotCommand([sourceDir], globals, mockClient()),
      );
      const newLine = logs.find((l) => l.includes('new:'));
      assert.ok(newLine);
      assert.match(newLine, /new:\s+0/);
    } finally {
      console.log = origLog;
    }
  });

  it('warns on unreadable files instead of silently skipping', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'good.txt'), 'readable');
    writeFileSync(join(sourceDir, 'bad.txt'), 'secret');
    chmodSync(join(sourceDir, 'bad.txt'), 0o000);

    const archiveDir = join(tmp, 'archive');

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);
    try {
      await runWithArchivePath(archiveDir, () =>
        snapshotCommand([sourceDir], { json: false, quiet: true }, mockClient()),
      );
      assert.ok(warnings.length > 0, 'should emit a warning for unreadable file');
      assert.ok(warnings.some((w) => w.includes('bad.txt')), 'warning should mention the file');
    } finally {
      console.warn = origWarn;
      // Restore permissions so cleanup works
      chmodSync(join(sourceDir, 'bad.txt'), 0o644);
    }
  });

  it('json output includes snapshot details', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'hello.txt'), 'hello world');

    const archiveDir = join(tmp, 'archive');

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await runWithArchivePath(archiveDir, () =>
        snapshotCommand([sourceDir], { json: true, quiet: false }, mockClient()),
      );
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.files, 1);
      assert.equal(output.newObjects, 1);
      assert.ok(output.snapshotId);
      assert.ok(output.sourcePage);
    } finally {
      console.log = origLog;
    }
  });

  it('creates source page via wiki client', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'data.csv'), 'a,b,c');

    const archiveDir = join(tmp, 'archive');

    let createdTitle = '';
    let createdContent = '';
    const client = mockClient({
      createPage: async (title: string, content: string) => {
        createdTitle = title;
        createdContent = content;
        return {};
      },
    });

    await runWithArchivePath(archiveDir, () =>
      snapshotCommand([sourceDir], { json: false, quiet: true }, client),
    );

    assert.ok(createdTitle.startsWith('Source:'));
    assert.ok(createdContent.includes('{{Source'));
    assert.ok(createdContent.includes('[[Category:Sources]]'));
  });

  it('skips dotfiles', async () => {
    const sourceDir = join(tmp, 'source');
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, 'visible.txt'), 'yes');
    writeFileSync(join(sourceDir, '.hidden'), 'no');

    const archiveDir = join(tmp, 'archive');

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    try {
      await runWithArchivePath(archiveDir, () =>
        snapshotCommand([sourceDir], { json: true, quiet: false }, mockClient()),
      );
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.files, 1, 'should only count visible files');
    } finally {
      console.log = origLog;
    }
  });
});
