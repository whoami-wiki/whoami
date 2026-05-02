import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDerivedRecord } from './derived';

test('loadDerivedRecord: reads and parses YAML', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'der-'));
  try {
    mkdirSync(join(dir, 'genealogy', 'derived'), { recursive: true });
    writeFileSync(join(dir, 'genealogy', 'derived', 'I1.yml'),
      `record: I1\nname: John Doe\nbirth: { date: '1950', place: null }\ndeath: null\nparents: []\nspouses: []\nchildren: []\nresidences: []\noccupations: []\nsources: []\n`);
    const r = await loadDerivedRecord(dir, 'I1');
    assert.equal(r?.record, 'I1');
    assert.equal(r?.name, 'John Doe');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadDerivedRecord: returns null for missing file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'der-'));
  try {
    mkdirSync(join(dir, 'genealogy', 'derived'), { recursive: true });
    assert.equal(await loadDerivedRecord(dir, 'I999'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadDerivedRecord: rejects malformed record id (path-traversal guard)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'der-'));
  try {
    assert.equal(await loadDerivedRecord(dir, '../etc/passwd'), null);
    assert.equal(await loadDerivedRecord(dir, 'I1; rm -rf'), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
