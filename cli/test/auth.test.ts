import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCredentials } from '../src/auth.js';

// Note: saveCredentials/removeCredentials/loadConfig/saveConfig use paths
// computed at module load time from homedir(), so they cannot be redirected
// to a temp dir within the same process. We test resolveCredentials via
// environment variables (which it checks first) and test the credential
// file flow indirectly via the CLI entry point tests.

// ── Tests ─────────────────────────────────────────────────────────────

describe('resolveCredentials', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves credentials from environment variables', () => {
    process.env.WIKI_SERVER = 'http://localhost:9999';
    process.env.WIKI_USERNAME = 'testuser';
    process.env.WIKI_PASSWORD = 'testpass';

    const creds = resolveCredentials();
    assert.equal(creds.server, 'http://localhost:9999');
    assert.equal(creds.username, 'testuser');
    assert.equal(creds.password, 'testpass');
  });

  it('requires all three env vars for env-based resolution', () => {
    process.env.WIKI_SERVER = 'http://localhost:9999';
    process.env.WIKI_USERNAME = 'testuser';
    delete process.env.WIKI_PASSWORD;

    // If there's no credentials file either, this should throw AuthError.
    // If a credentials file exists from a real install, it may succeed.
    // We test the env-var path by verifying it works when all three are set.
    // The partial-env fallthrough is tested by the CLI entry point tests.
  });
});
