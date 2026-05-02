import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDerivedRecordsForTree } from './family';

test('loadDerivedRecordsForTree: skips malformed derived YAML', () => {
  const dir = mkdtempSync(join(tmpdir(), 'family-derived-'));
  try {
    writeFileSync(join(dir, 'I1.yml'), [
      'record: I1',
      'name: Steven',
      'birth: null',
      'death: null',
      'parents: []',
      'spouses: []',
      'children: []',
      'residences: []',
      'occupations: []',
      'sources: []',
      '',
    ].join('\n'));
    writeFileSync(join(dir, 'I2.yml'), 'record: [broken');

    const records = loadDerivedRecordsForTree(dir);

    assert.equal(records.size, 1);
    assert.equal(records.get('I1')?.name, 'Steven');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadDerivedRecordsForTree: missing directory returns an empty map', () => {
  const records = loadDerivedRecordsForTree('/path/that/does/not/exist');

  assert.equal(records.size, 0);
});
