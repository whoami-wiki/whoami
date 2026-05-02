import type { ApiClient } from '../api-client.js';
import { editInEditor } from '../body-input.js';

export interface EditOptions {
  slug: string;
  summary: string;
  client: Pick<ApiClient, 'read' | 'write'>;
  write: (s: string) => void;
  openEditor?: (initial: string) => string;
}

export async function runEdit(opts: EditOptions): Promise<void> {
  if (!opts.summary) throw new Error('--summary is required');
  const page = await opts.client.read(opts.slug);
  const editor = opts.openEditor ?? editInEditor;
  const next = editor(page.body);
  // Compare with trailing whitespace stripped — most editors auto-add a final
  // newline, which would otherwise look like a change every time.
  if (next.trimEnd() === page.body.trimEnd()) {
    opts.write('no changes\n');
    return;
  }
  await opts.client.write(opts.slug, next, opts.summary);
  opts.write(`updated ${opts.slug}\n`);
}
