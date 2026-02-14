import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const CONFIG_DIR = join(homedir(), '.whoami');
const CACHE_FILE = join(CONFIG_DIR, 'update-check.json');
const REPO = 'whoami-wiki/whoami';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

/**
 * Background update check. Returns a notice string if an update is
 * available, or null. Never throws — all errors are swallowed.
 */
export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  try {
    const cache = readCache();
    const now = Date.now();

    if (cache && now - cache.lastCheck < CHECK_INTERVAL_MS) {
      return compareVersions(currentVersion, cache.latestVersion);
    }

    const latest = await fetchLatestVersion();
    if (!latest) return null;

    writeCache({ lastCheck: now, latestVersion: latest });
    return compareVersions(currentVersion, latest);
  } catch {
    return null;
  }
}

/**
 * `wai update` command — fetches latest and re-runs the installer.
 */
export async function updateCommand(): Promise<void> {
  const latest = await fetchLatestVersion();
  if (!latest) {
    console.error('Could not fetch latest version.');
    process.exitCode = 1;
    return;
  }

  console.log(`Latest version: ${latest}`);
  console.log('Updating...');

  try {
    execSync(
      `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/cli/install.sh | bash`,
      { stdio: 'inherit' },
    );
  } catch {
    console.error('Update failed. Try manually: curl -fsSL https://whoami.wiki/install.sh | bash');
    process.exitCode = 1;
  }
}

function readCache(): UpdateCache | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // best-effort
  }
}

function fetchLatestVersion(): Promise<string | null> {
  try {
    const out = execSync(
      `gh api repos/${REPO}/releases --jq '[.[] | select(.tag_name | startswith("cli-v")) | select(.draft | not) | select(.prerelease | not)][0].tag_name'`,
      { timeout: 10000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return Promise.resolve(out ? out.replace(/^cli-v/, '') : null);
  } catch {
    return Promise.resolve(null);
  }
}

function compareVersions(current: string, latest: string): string | null {
  if (!latest || latest === current) return null;
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) {
      return `Update available: ${current} → ${latest}  (run \`wai update\`)`;
    }
    if ((l[i] ?? 0) < (c[i] ?? 0)) return null;
  }
  return null;
}
