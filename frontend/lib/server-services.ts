import { createPageStore, type PageStore, type PageMetaSummary } from '@core/pages/index.ts';
import { buildSlugIndex, type SlugIndex } from './wikilinks';
import { join } from 'node:path';
import {
  createSearchIndex, loadSearchIndex, saveSearchIndex, rebuildSearchIndex,
  type SearchIndex, type SearchResult,
} from '@core/search/module.ts';
import { WHOAMI_ROOT, PAGES_DIR, SEARCH_INDEX_FILE } from './env.ts';

let _pages: PageStore | null = null;

export function getPageStore(): PageStore {
  if (!_pages) {
    _pages = createPageStore({ repoRoot: WHOAMI_ROOT, pagesDir: PAGES_DIR });
  }
  return _pages;
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

let _search: SearchIndex | null = null;
let _searchReady: Promise<void> | null = null;

export async function getSearchIndex(): Promise<SearchIndex> {
  if (!_search) {
    _search = createSearchIndex();
    _searchReady = (async () => {
      const loaded = await loadSearchIndex(_search!, SEARCH_INDEX_FILE);
      if (!loaded) {
        await rebuildSearchIndex(_search!, {
          pagesDir: join(WHOAMI_ROOT, 'pages'),
          genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
        });
        await saveSearchIndex(_search!, SEARCH_INDEX_FILE);
      }
    })();
  }
  await _searchReady;
  return _search!;
}

export async function persistSearchIndex(): Promise<void> {
  if (!_search) return;
  await saveSearchIndex(_search, SEARCH_INDEX_FILE);
}

export async function rebuildSearchIndexFromDisk(): Promise<{ pages: number; ms: number }> {
  const t0 = Date.now();
  const idx = createSearchIndex();
  const pages = await rebuildSearchIndex(idx, {
    pagesDir: join(WHOAMI_ROOT, 'pages'),
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
  });
  await saveSearchIndex(idx, SEARCH_INDEX_FILE);
  _search = idx;
  return { pages, ms: Date.now() - t0 };
}

export async function searchAndJoin(query: string, limit: number): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const idx = await getSearchIndex();
  const hits = idx.query(query, limit);
  if (hits.length === 0) return [];
  const { list } = await getCachedList();
  const bySlug = new Map(list.map(p => [p.slug, p]));
  const results: SearchResult[] = [];
  for (const h of hits) {
    const meta = bySlug.get(h.slug);
    if (!meta || meta.isArchived) continue;
    results.push({ slug: h.slug, title: meta.title, type: meta.type });
  }
  return results;
}
