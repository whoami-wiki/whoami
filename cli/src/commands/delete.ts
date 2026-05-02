import type { ApiClient } from '../api-client.js';

export interface DeleteOptions {
  slug: string;
  yes: boolean;
  client: Pick<ApiClient, 'delete'>;
  write: (s: string) => void;
}

export async function runDelete(opts: DeleteOptions): Promise<void> {
  if (!opts.yes) throw new Error(`refusing to delete without --yes (would soft-delete ${opts.slug})`);
  await opts.client.delete(opts.slug);
  opts.write(`deleted ${opts.slug}\n`);
}
