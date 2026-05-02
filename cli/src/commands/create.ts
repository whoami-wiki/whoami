import type { ApiClient } from '../api-client.js';
import { NotFound } from '../api-client.js';

export interface CreateOptions {
  slug: string;
  body: string;
  summary: string;
  client: Pick<ApiClient, 'read' | 'write'>;
  write: (s: string) => void;
}

export async function runCreate(opts: CreateOptions): Promise<void> {
  if (!opts.summary) throw new Error('--summary is required');
  let exists = true;
  try { await opts.client.read(opts.slug); } catch (err) {
    if (err instanceof NotFound) exists = false;
    else throw err;
  }
  if (exists) throw new Error(`page ${opts.slug} already exists — use 'wai write' to overwrite or 'wai edit' to modify`);
  await opts.client.write(opts.slug, opts.body, opts.summary);
  opts.write(`created ${opts.slug}\n`);
}
