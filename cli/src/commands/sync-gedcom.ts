import type { ApiClient } from '../api-client.js';

export interface SyncGedcomOptions {
  gedFile: string;
  notes: string;
  client: Pick<ApiClient, 'syncGedcom'>;
  write: (s: string) => void;
}

export async function runSyncGedcom(opts: SyncGedcomOptions): Promise<void> {
  if (!opts.gedFile) throw new Error('--ged-file is required');
  if (!opts.notes) throw new Error('--notes is required');
  const result = await opts.client.syncGedcom(opts.gedFile, opts.notes);
  if (result.kind === 'no-op') {
    opts.write(`no-op: ${result.reason}\n`);
  } else {
    const d = result.diff;
    opts.write(`commit ${result.commit.slice(0, 8)}: +${d.added.length} ~${d.changed.length} -${d.removed.length}\n`);
  }
}
