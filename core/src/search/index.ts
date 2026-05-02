import FlexSearch from 'flexsearch';
import type { SearchDoc, SearchHit } from './types.ts';

export interface SearchIndex {
  upsert(doc: SearchDoc): void;
  remove(slug: string): void;
  query(q: string, limit?: number): SearchHit[];
  // Internals exposed for persistence in persist.ts
  _raw(): FlexSearch.Document<SearchDoc>;
}

export function createSearchIndex(): SearchIndex {
  const raw = makeIndex();
  return {
    upsert(doc) { raw.add(doc); },
    remove(slug) { raw.remove(slug); },
    query(q, limit = 25) {
      if (!q.trim()) return [];
      const results = raw.search(q, { limit });
      const slugs = new Set<string>();
      for (const fieldResult of results) {
        for (const id of fieldResult.result) slugs.add(String(id));
      }
      return [...slugs].slice(0, limit).map(slug => ({ slug }));
    },
    _raw() { return raw; },
  };
}

function makeIndex(): FlexSearch.Document<SearchDoc> {
  return new FlexSearch.Document<SearchDoc>({
    document: {
      id: 'slug',
      index: [
        { field: 'title',       tokenize: 'forward' },
        { field: 'aliases',     tokenize: 'forward' },
        { field: 'categories',  tokenize: 'forward' },
        { field: 'places',      tokenize: 'forward' },
        { field: 'related',     tokenize: 'forward' },
        { field: 'occupations', tokenize: 'forward' },
        { field: 'body',        tokenize: 'strict' },
        { field: 'type',        tokenize: 'strict' },
      ],
    },
    tokenize: 'forward',
  });
}
