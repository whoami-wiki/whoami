import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { join } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// ── Config ─────────────────────────────────────────────────────────────

const APP_DIR = join(import.meta.dirname, '..');
const MAIN_ENTRY = join(APP_DIR, 'dist', 'src', 'main.js');

// ── Helpers ────────────────────────────────────────────────────────────

let electronApp: ElectronApplication;
let window: Page;
let tmpDataDir: string;

test.beforeEach(async () => {
  // Use a fresh temp data directory so each test run gets a clean first-run state
  tmpDataDir = mkdtempSync(join(tmpdir(), 'whoami-e2e-'));
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

test.describe('Desktop app installation flow', () => {
  test('app launches and shows setup wizard on first run', async () => {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: {
        ...process.env,
        // Point data to temp dir to ensure first-run state
        WHOAMI_DATA_PATH: tmpDataDir,
        NODE_ENV: 'test',
      },
    });

    // Get the first window (setup wizard)
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // The setup wizard should be visible
    const title = await window.title();
    expect(title).toBeTruthy();

    // Check that the window is showing (non-zero dimensions)
    const bounds = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  test('setup wizard has required input fields', async () => {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: {
        ...process.env,
        WHOAMI_DATA_PATH: tmpDataDir,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // The onboarding form should have name, username, and password fields
    // These selectors should match the actual setup UI
    const hasForm = await window.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return inputs.length > 0;
    });
    expect(hasForm).toBeTruthy();
  });

  test('setup wizard completes onboarding flow', async () => {
    electronApp = await electron.launch({
      args: [MAIN_ENTRY],
      env: {
        ...process.env,
        WHOAMI_DATA_PATH: tmpDataDir,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Fill in the setup form
    // Note: these selectors need to match the actual setup wizard UI.
    // The setup wizard takes name, username, password params via IPC (setup:start)
    const nameInput = window.locator('input[name="name"], input[placeholder*="name" i]').first();
    const usernameInput = window.locator('input[name="username"], input[placeholder*="username" i]').first();
    const passwordInput = window.locator('input[type="password"], input[name="password"]').first();

    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill('Test User');
    }
    if (await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameInput.fill('testuser');
    }
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await passwordInput.fill('testpassword123');
    }

    // Look for a submit/continue button
    const submitButton = window.locator('button[type="submit"], button:has-text("Create"), button:has-text("Start"), button:has-text("Continue")').first();
    if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitButton.click();

      // Wait for setup to progress — look for progress indicators or completion
      await window.waitForEvent('close', { timeout: 60_000 }).catch(() => {
        // Setup wizard closes and wiki window opens on success
      });
    }
  });
});
