import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

// ── Helpers ───────────────────────────────────────────────────────────

const CLI_ENTRY = join(import.meta.dirname, '..', 'src', 'index.ts');

function runCli(args: string[], extraEnv?: Record<string, string>): { stdout: string; stderr: string; exitCode: number } {
  // Build a clean env without wiki credentials
  const env = { ...process.env, ...extraEnv };
  delete env.WIKI_SERVER;
  delete env.WIKI_USERNAME;
  delete env.WIKI_PASSWORD;

  try {
    const stdout = execFileSync('tsx', [CLI_ENTRY, ...args], {
      encoding: 'utf-8',
      timeout: 10_000,
      env,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.status ?? 1,
    };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('CLI entry point', () => {
  it('--version prints a semver version string', () => {
    const { stdout, exitCode } = runCli(['--version']);
    assert.equal(exitCode, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it('-V is an alias for --version', () => {
    const { stdout, exitCode } = runCli(['-V']);
    assert.equal(exitCode, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it('--help prints usage information', () => {
    const { stdout, exitCode } = runCli(['--help']);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('wai'));
    assert.ok(stdout.includes('Usage:'));
  });

  it('-h is an alias for --help', () => {
    const { stdout, exitCode } = runCli(['-h']);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('Usage:'));
  });

  it('no arguments prints help', () => {
    const { stdout, exitCode } = runCli([]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('Usage:'));
  });

  it('unknown command exits with code 2', () => {
    const { stderr, exitCode } = runCli(['nonexistent']);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('Unknown command'));
  });

  it('help text lists all documented commands', () => {
    const { stdout } = runCli(['--help']);
    const expected = [
      'read', 'write', 'edit', 'create', 'search',
      'section', 'talk', 'upload', 'link', 'category',
      'changes', 'source', 'snapshot', 'export', 'import',
      'auth', 'update', 'task',
    ];
    for (const cmd of expected) {
      assert.ok(stdout.includes(cmd), `Help text should mention "${cmd}"`);
    }
  });

  it('wiki commands fail with auth error when no credentials', () => {
    // Use a temp HOME so no credentials.json is found
    const tmpHome = mkdtempSync(join(tmpdir(), 'wai-test-'));
    const { stderr, exitCode } = runCli(['search', 'test'], { HOME: tmpHome });
    assert.ok(exitCode !== 0);
    assert.ok(
      stderr.includes('credentials') || stderr.includes('login') || stderr.includes('WIKI_SERVER'),
      `Expected auth error in stderr, got: ${stderr}`,
    );
  });

  it('auth subcommand without action prints usage error', () => {
    const { stderr, exitCode } = runCli(['auth']);
    assert.ok(exitCode !== 0);
    assert.ok(stderr.includes('Usage'));
  });
});
