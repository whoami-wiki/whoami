import type { ApiClient } from '../api-client.js';

export interface ReciteOptions {
  apply: boolean;
  client: Pick<ApiClient, 'reciteDrift' | 'applyRecite'>;
  write: (s: string) => void;
}

export async function runRecite(opts: ReciteOptions): Promise<void> {
  if (opts.apply) {
    const r = await opts.client.applyRecite();
    opts.write(`updated ${r.updated.length} pages: ${r.updated.join(', ') || '(none)'}\n`);
    return;
  }
  const r = await opts.client.reciteDrift();
  if (r.drift.length === 0) {
    opts.write('no drift\n');
    return;
  }
  for (const d of r.drift) {
    const fields = d.changedFields.length > 0 ? ` [${d.changedFields.join(', ')}]` : '';
    opts.write(`${d.slug}: ${d.citedSnapshot.slice(0, 8)} → ${d.latestSnapshot.slice(0, 8)} (${d.record})${fields}\n`);
  }
}
