import type { ApiClient } from '../api-client.js';

export interface ReadOptions {
  slug: string;
  json: boolean;
  client: Pick<ApiClient, 'read'>;
  write: (s: string) => void;
}

export async function runRead(opts: ReadOptions): Promise<void> {
  const page = await opts.client.read(opts.slug);
  if (opts.json) {
    opts.write(JSON.stringify(page, null, 2));
  } else {
    opts.write(`${page.body}\n`);
  }
}
