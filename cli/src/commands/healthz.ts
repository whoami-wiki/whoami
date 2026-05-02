import type { ApiClient } from '../api-client.js';

export interface HealthzOptions {
  client: Pick<ApiClient, 'healthz'>;
  write: (s: string) => void;
}

export async function runHealthz(opts: HealthzOptions): Promise<void> {
  const h = await opts.client.healthz();
  opts.write(`${h.status} (${h.started})\n`);
}
