import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import https from 'node:https';

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
  return new Promise((resolve) => {
    const req = https.get(
      `https://api.github.com/repos/${REPO}/releases?per_page=10`,
      {
        headers: { 'User-Agent': 'wai-cli', Accept: 'application/vnd.github.v3+json' },
        timeout: 3000,
      },
      (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          resolve(null);
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk));
        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            const cli = releases.find(
              (r: any) => r.tag_name?.startsWith('cli-v') && !r.draft && !r.prerelease,
            );
            resolve(cli ? cli.tag_name.replace(/^cli-v/, '') : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
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
