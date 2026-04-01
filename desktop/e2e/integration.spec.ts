import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { join } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

// ── Config ─────────────────────────────────────────────────────────────

const APP_DIR = join(import.meta.dirname, '..');
const CLI_DIR = join(APP_DIR, '..', 'cli');
const MAIN_ENTRY = join(APP_DIR, 'dist', 'src', 'main.js');

// ── Helpers ────────────────────────────────────────────────────────────

let electronApp: ElectronApplication;
let window: Page;
let tmpDataDir: string;

function runWai(args: string, env?: Record<string, string>): string {
  const waiEntry = join(CLI_DIR, 'dist', 'wai.cjs');
  return execSync(`node ${waiEntry} ${args}`, {
    encoding: 'utf-8',
    timeout: 15_000,
    env: { ...process.env, ...env },
  }).trim();
}

test.beforeAll(async () => {
  // Build CLI if not already built
  const waiEntry = join(CLI_DIR, 'dist', 'wai.cjs');
  if (!existsSync(waiEntry)) {
    execSync('pnpm build', { cwd: CLI_DIR, timeout: 30_000 });
  }
});

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close();
  }
  if (tmpDataDir && existsSync(tmpDataDir)) {
    rmSync(tmpDataDir, { recursive: true, force: true });
  }
});

// ── Tests ──────────────────────────────────────────────────────────────

test.describe('CLI ↔ Desktop integration', () => {
  test('wai auth status reports connection state', async () => {
    // Without a running wiki, auth status should report "not configured" or fail gracefully
    try {
      const output = runWai('auth status');
      // Should output status information regardless of connection state
      expect(output).toMatch(/Status:|status/i);
    } catch (err: any) {
      // Auth status with no credentials should exit non-zero but not crash
      expect(err.stderr || err.stdout || '').toMatch(/credentials|configured|login/i);
    }
  });

  test('wai --version matches CLI package version', async () => {
    const version = runWai('--version');
    const pkgJson = JSON.parse(
      require('node:fs').readFileSync(join(CLI_DIR, 'package.json'), 'utf-8'),
    );
    expect(version).toBe(pkgJson.version);
  });

  test('wai search without wiki returns connection error', async () => {
    // With credentials pointing to a non-existent server, search should fail with a connection error
    try {
      runWai('search "test"', {
        WIKI_SERVER: 'http://localhost:19999',
        WIKI_USERNAME: 'test',
        WIKI_PASSWORD: 'test',
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err: any) {
      const output = err.stderr || err.stdout || '';
      expect(output).toMatch(/connect|ECONNREFUSED|error/i);
    }
  });

  test('wai search requires a query argument', async () => {
    try {
      runWai('search', {
        WIKI_SERVER: 'http://localhost:8080',
        WIKI_USERNAME: 'test',
        WIKI_PASSWORD: 'test',
      });
      expect(true).toBe(false);
    } catch (err: any) {
      const output = err.stderr || '';
      expect(output).toMatch(/Usage|query/i);
    }
  });
});
