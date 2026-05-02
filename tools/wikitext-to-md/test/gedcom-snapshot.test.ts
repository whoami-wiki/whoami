import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashGedcom, writeSnapshotManifest } from '../src/gedcom-snapshot.ts';

test('hashGedcom: returns 64-char lowercase hex digest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gedhash-'));
  try {
    const path = join(dir, 'tiny.ged');
    writeFileSync(path, '0 HEAD\n1 SOUR test\n');
    const hash = hashGedcom(path);
    assert.match(hash, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashGedcom: identical content produces identical hashes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gedhash-'));
  try {
    const a = join(dir, 'a.ged');
    const b = join(dir, 'b.ged');
    writeFileSync(a, '0 HEAD\n1 SOUR same\n');
    writeFileSync(b, '0 HEAD\n1 SOUR same\n');
    assert.equal(hashGedcom(a), hashGedcom(b));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('hashGedcom: different content produces different hashes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gedhash-'));
  try {
    const a = join(dir, 'a.ged');
    const b = join(dir, 'b.ged');
    writeFileSync(a, '0 HEAD\n1 SOUR one\n');
    writeFileSync(b, '0 HEAD\n1 SOUR two\n');
    assert.notEqual(hashGedcom(a), hashGedcom(b));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeSnapshotManifest: appends a row when manifest exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'));
  try {
    writeSnapshotManifest(dir, 'aaaa', 'barash-tree.ged', 'first');
    writeSnapshotManifest(dir, 'bbbb', 'barash-tree.ged', 'second');
    const yml = readFileSync(join(dir, 'snapshots.yml'), 'utf-8');
    assert.match(yml, /hash: aaaa/);
    assert.match(yml, /hash: bbbb/);
    assert.match(yml, /notes: first/);
    assert.match(yml, /notes: second/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
