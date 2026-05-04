import type { ApiClient } from '../api-client.js';

export interface RebuildSearchOptions {
  check: boolean;
  client: Pick<ApiClient, 'rebuildSearch' | 'rebuildSearchCheck'>;
  write: (s: string) => void;
}

export async function runRebuildSearch(opts: RebuildSearchOptions): Promise<void> {
  if (opts.check) {
    const { stale } = await opts.client.rebuildSearchCheck();
    opts.write(stale ? 'stale\n' : 'fresh\n');
    if (stale) throw new Error('search index is stale');
    return;
  }
  const { pages, ms } = await opts.client.rebuildSearch();
  opts.write(`rebuilt ${pages} pages in ${ms}ms\n`);
}
