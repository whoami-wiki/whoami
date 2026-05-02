import type { ApiClient } from '../api-client.js';

export interface SearchOptions {
  query: string;
  limit: number;
  json: boolean;
  client: Pick<ApiClient, 'search'>;
  write: (s: string) => void;
}

export async function runSearch(opts: SearchOptions): Promise<void> {
  if (!opts.query.trim()) throw new Error('search query is required');
  const { results } = await opts.client.search(opts.query, opts.limit);
  if (opts.json) {
    opts.write(JSON.stringify(results, null, 2));
    return;
  }
  if (results.length === 0) {
    opts.write('no results\n');
    return;
  }
  for (const r of results) {
    opts.write(`${r.slug.padEnd(40)} ${r.title} (${r.type})\n`);
  }
}
