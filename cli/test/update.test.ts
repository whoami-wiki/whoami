import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate } from '../src/update.js';

// Note: checkForUpdate uses a cache file at ~/.whoami/update-check.json
// with the path computed at module load time from homedir(). We can't
// redirect it to a temp dir within the same process. We test the behaviors
// that don't depend on cache file manipulation.

// ── Tests ─────────────────────────────────────────────────────────────

describe('checkForUpdate', () => {
  it('returns null and never throws for any version string', async () => {
    // Without a valid gh CLI or matching cache, should return null
    const result = await checkForUpdate('99.99.99');
    assert.equal(result, null);
  });

  it('returns null for current version', async () => {
    // Even if there's a cache, same version should return null
    const result = await checkForUpdate('1.2.1');
    assert.equal(result, null);
  });

  it('never throws on error', async () => {
    // Should swallow all errors and return null
    const result = await checkForUpdate('');
    assert.equal(result, null);
  });
});
