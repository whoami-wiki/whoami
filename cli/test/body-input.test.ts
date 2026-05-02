import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFromFile } from '../src/body-input.js';

test('readFromFile: reads utf-8 contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'body-'));
  try {
    const p = join(dir, 'a.md');
    writeFileSync(p, '# Heading\n\nbody\n');
    assert.equal(readFromFile(p), '# Heading\n\nbody\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('readFromFile: throws on missing', () => {
  assert.throws(() => readFromFile('/nope/does-not-exist.md'));
});
