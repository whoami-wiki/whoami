import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getDataPath, getVaultPath } from '../src/data-path.js';

// ── Tests ─────────────────────────────────────────────────────────────

describe('getDataPath', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns WAI_DATA_PATH when set', () => {
    process.env.WAI_DATA_PATH = '/custom/data';
    assert.equal(getDataPath(), '/custom/data');
  });

  it('returns a platform-appropriate default path', () => {
    delete process.env.WAI_DATA_PATH;
    const path = getDataPath();
    assert.ok(path.includes('whoami'));
    assert.ok(path.endsWith('data'));
  });
});

describe('getVaultPath', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns WAI_VAULT_PATH when set', () => {
    process.env.WAI_VAULT_PATH = '/custom/vault';
    assert.equal(getVaultPath(), '/custom/vault');
  });

  it('returns a platform-appropriate default path', () => {
    delete process.env.WAI_VAULT_PATH;
    const path = getVaultPath();
    assert.ok(path.includes('whoami'));
    assert.ok(path.endsWith('vault'));
  });
});
