import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPageStore, type PageStore, type PageMetaSummary } from '@core/pages/index.ts';
import { createAuthService, type AuthService } from '@core/auth/index.ts';
import { buildSlugIndex, type SlugIndex } from './wikilinks';
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

// Cached page list + slug index. `store.list()` is O(N) over the pages dir
// (107 file reads today, ~2k at scale); we don't want that on every render.
// 2-second TTL is a pragmatic trade-off — recent edits stay visible quickly,
// reads of repeated pages share the parsed list. Writes call invalidateListCache.
const LIST_TTL_MS = 2000;
let _listCache: { list: PageMetaSummary[]; index: SlugIndex; expiresAt: number } | null = null;

export async function getCachedList(): Promise<{ list: PageMetaSummary[]; index: SlugIndex }> {
  const now = Date.now();
  if (_listCache && _listCache.expiresAt > now) {
    return { list: _listCache.list, index: _listCache.index };
  }
  const list = await getPageStore().list();
  const index = buildSlugIndex(list.filter(p => !p.isTalk).map(p => ({
    slug: p.slug,
    title: p.title,
    aliases: p.aliases,
  })));
  _listCache = { list, index, expiresAt: now + LIST_TTL_MS };
  return { list, index };
}

export function invalidateListCache(): void {
  _listCache = null;
}
