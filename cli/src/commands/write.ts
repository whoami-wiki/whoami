import type { ApiClient } from '../api-client.js';

export interface WriteOptions {
  slug: string;
  body: string;
  summary: string;
  client: Pick<ApiClient, 'write'>;
  write: (s: string) => void;
}

export async function runWrite(opts: WriteOptions): Promise<void> {
  if (!opts.summary) throw new Error('--summary is required');
  await opts.client.write(opts.slug, opts.body, opts.summary);
  opts.write(`wrote ${opts.slug}\n`);
}
