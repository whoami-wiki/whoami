import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  migrate,
  validateRegistry,
  type Migration,
  MissingMigrationError,
  FutureSchemaVersionError,
} from '../../src/pages/migrations/index.ts';

test('CURRENT_SCHEMA_VERSION is a positive integer', () => {
  assert.equal(typeof CURRENT_SCHEMA_VERSION, 'number');
  assert.ok(Number.isInteger(CURRENT_SCHEMA_VERSION));
  assert.ok(CURRENT_SCHEMA_VERSION >= 1);
});

test('migrate is a no-op when fromVersion equals CURRENT_SCHEMA_VERSION', () => {
  const meta = { title: 'x', schemaVersion: CURRENT_SCHEMA_VERSION };
  const out = migrate(meta, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(out, meta);
});

test('migrate throws FutureSchemaVersionError when fromVersion > CURRENT', () => {
  assert.throws(
    () => migrate({}, CURRENT_SCHEMA_VERSION + 1),
    FutureSchemaVersionError,
  );
});

test('migrate composes a synthetic chain in order', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'add foo', applyMeta: (m) => ({ ...m, foo: 1 }) },
    { from: 2, to: 3, description: 'add bar', applyMeta: (m) => ({ ...m, bar: 2 }) },
  ];
  const out = migrate({ title: 'x' }, 1, synth, /* targetVersion */ 3);
  assert.deepEqual(out, { title: 'x', foo: 1, bar: 2, schemaVersion: 3 });
});

test('migrate throws MissingMigrationError when the chain has a gap', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'add foo', applyMeta: (m) => m },
    // gap: no 2→3
    { from: 3, to: 4, description: 'add baz', applyMeta: (m) => m },
  ];
  assert.throws(
    () => migrate({}, 1, synth, 4),
    MissingMigrationError,
  );
});

test('validateRegistry passes for a contiguous registry', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'a', applyMeta: (m) => m },
    { from: 2, to: 3, description: 'b', applyMeta: (m) => m },
  ];
  assert.doesNotThrow(() => validateRegistry(synth, 3));
});

test('validateRegistry throws on a gap', () => {
  const synth: Migration[] = [
    { from: 1, to: 2, description: 'a', applyMeta: (m) => m },
    { from: 3, to: 4, description: 'b', applyMeta: (m) => m },
  ];
  assert.throws(() => validateRegistry(synth, 4), MissingMigrationError);
});

test('the real registry is contiguous up to CURRENT_SCHEMA_VERSION', () => {
  assert.doesNotThrow(() => validateRegistry(MIGRATIONS, CURRENT_SCHEMA_VERSION));
});
