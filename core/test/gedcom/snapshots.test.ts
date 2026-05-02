import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readManifest, appendSnapshot } from '../../src/gedcom/snapshots.ts';

test('readManifest: returns empty array when file does not exist', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    assert.deepEqual(await readManifest(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readManifest: parses existing manifest', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    writeFileSync(join(dir, 'snapshots.yml'),
      `- hash: aaaa\n  date: '2026-01-01T00:00:00Z'\n  file: x.ged\n  notes: first\n`);
    const m = await readManifest(dir);
    assert.equal(m.length, 1);
    assert.equal(m[0]!.hash, 'aaaa');
    assert.equal(m[0]!.notes, 'first');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendSnapshot: appends new entry, preserves existing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    await appendSnapshot(dir, { hash: 'aaa', date: '2026-01-01T00:00:00Z', file: 'x.ged', notes: 'first' });
    await appendSnapshot(dir, { hash: 'bbb', date: '2026-01-02T00:00:00Z', file: 'x.ged', notes: 'second' });
    const m = await readManifest(dir);
    assert.equal(m.length, 2);
    assert.equal(m[0]!.hash, 'aaa');
    assert.equal(m[1]!.hash, 'bbb');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendSnapshot: skips when latest entry has same hash (no-op)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    await appendSnapshot(dir, { hash: 'aaa', date: '2026-01-01T00:00:00Z', file: 'x.ged', notes: 'first' });
    const wrote = await appendSnapshot(dir, { hash: 'aaa', date: '2026-01-02T00:00:00Z', file: 'x.ged', notes: 'duplicate' });
    assert.equal(wrote, false);
    assert.equal((await readManifest(dir)).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
