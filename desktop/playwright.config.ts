import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 0,
  workers: 1, // Electron tests must run serially
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
