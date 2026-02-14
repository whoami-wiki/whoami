import { existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';

const BIN_DIR = join(homedir(), '.local', 'bin');

function getWaiSourcePath(): string {
  // In the packaged app, wai binary lives in the resources
  const resourcesPath = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), '..', 'cli', 'dist');
  return join(resourcesPath, 'wai.cjs');
}

export async function installWaiCli(): Promise<void> {
  const source = getWaiSourcePath();
  const target = join(BIN_DIR, 'wai');

  // Skip if source doesn't exist (dev mode without bundled CLI)
  if (!existsSync(source)) {
    console.log('[cli] wai binary not found, skipping CLI install');
    return;
  }

  mkdirSync(BIN_DIR, { recursive: true });

  // Remove existing symlink if it points somewhere else
  if (existsSync(target)) {
    try {
      const current = readlinkSync(target);
      if (current === source) return; // Already correct
    } catch {
      // Not a symlink — leave it alone
      console.log('[cli] existing wai at', target, 'is not a symlink, skipping');
      return;
    }
    unlinkSync(target);
  }

  symlinkSync(source, target);
  console.log('[cli] symlinked wai →', target);
}
