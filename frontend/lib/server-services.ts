import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPageStore, type PageStore } from '@core/pages/index.ts';
import { createAuthService, type AuthService } from '@core/auth/index.ts';
import { WHOAMI_ROOT, PAGES_DIR, DATA_DIR } from './env.ts';

let _pages: PageStore | null = null;
let _auth: AuthService | null = null;

export function getPageStore(): PageStore {
  if (!_pages) {
    _pages = createPageStore({ repoRoot: WHOAMI_ROOT, pagesDir: PAGES_DIR });
  }
  return _pages;
}

export function getAuthService(): AuthService {
  if (!_auth) {
    mkdirSync(DATA_DIR, { recursive: true });
    _auth = createAuthService({
      usersPath: join(DATA_DIR, 'users.json'),
      sessionsPath: join(DATA_DIR, 'sessions.db'),
    });
  }
  return _auth;
}
