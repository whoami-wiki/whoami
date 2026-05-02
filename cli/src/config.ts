import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.whoami');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_SERVER = 'http://localhost:3001';

export interface WaiConfig {
  server: string;
}

export function getServer(): string {
  const env = process.env.WHOAMI_SERVER;
  if (env) return env.replace(/\/$/, '');
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Partial<WaiConfig>;
    if (typeof data.server === 'string' && data.server.length > 0) {
      return data.server.replace(/\/$/, '');
    }
  } catch { /* missing or malformed: fall through to default */ }
  return DEFAULT_SERVER;
}

export function setServer(server: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({ server }, null, 2) + '\n', { mode: 0o600 });
}
