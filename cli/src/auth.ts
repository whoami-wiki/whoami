import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { AuthError } from './errors.js';

const CONFIG_DIR = join(homedir(), '.whoami');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface Credentials {
  server: string;
  username: string;
  password: string;
}

export interface WaiConfig {
  googlePlacesApiKey?: string;
}

/** Resolve credentials: env vars → config file → .env in cwd */
export function resolveCredentials(): Credentials {
  // 1. Environment variables
  const envServer = process.env.WIKI_SERVER;
  const envUser = process.env.WIKI_USERNAME;
  const envPass = process.env.WIKI_PASSWORD;
  if (envServer && envUser && envPass) {
    return { server: envServer, username: envUser, password: envPass };
  }

  // 2. Config file
  if (existsSync(CREDENTIALS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
      if (data.server && data.username && data.password) {
        return data as Credentials;
      }
    } catch {
      // fall through
    }
  }

  // 3. .env in cwd
  const dotenv = join(process.cwd(), '.env');
  if (existsSync(dotenv)) {
    const env = parseDotenv(readFileSync(dotenv, 'utf-8'));
    const server = env.WIKI_SERVER;
    const username = env.WIKI_USERNAME;
    const password = env.WIKI_PASSWORD;
    if (server && username && password) {
      return { server, username, password };
    }
  }

  throw new AuthError(
    'No credentials found. Run `wai auth login` or set WIKI_SERVER, WIKI_USERNAME, WIKI_PASSWORD.',
  );
}

export function saveCredentials(creds: Credentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
}

export function removeCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE);
  }
}

export function credentialsPath(): string {
  return CREDENTIALS_FILE;
}

export function loadConfig(): WaiConfig {
  if (existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

export function saveConfig(config: WaiConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

function parseDotenv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}
