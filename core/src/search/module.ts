export type { SearchDoc, SearchHit, SearchResult } from './types.ts';
export { createSearchIndex, type SearchIndex } from './index.ts';
export { buildSearchDoc } from './doc-builder.ts';
export { saveSearchIndex, loadSearchIndex } from './persist.ts';
export { rebuildSearchIndex, type RebuildConfig } from './rebuild.ts';
