export class ApiError extends Error {
  constructor(public status: number, public detail?: string) {
    super(`HTTP ${status}${detail ? `: ${detail}` : ''}`);
  }
}
export class NotFound extends ApiError {}
export class BadRequest extends ApiError {}
export class ServerError extends ApiError {}

export interface PageMeta {
  title: string;
  owner: string;
  editors: string[];
  type: string;
  aliases: string[];
  categories: string[];
  gedcom?: { file: string; record: string; snapshot: string };
  created: string;
  deletedAt?: string;
}

export interface Page {
  slug: string;
  meta: PageMeta;
  body: string;
}

export type SyncResult =
  | {
      kind: 'wrote';
      diff: { added: string[]; changed: string[]; removed: string[] };
      commit: string;
      snapshot: { hash: string; date: string; file: string; notes: string };
    }
  | {
      kind: 'no-op';
      reason: 'unchanged-hash';
    };

export interface ReciteEntry {
  slug: string;
  record: string;
  citedSnapshot: string;
  latestSnapshot: string;
  changedFields: string[];
}

export interface SearchResult {
  slug: string;
  title: string;
  type: string;
}

/** Mirror of core's MigrateReport — the wire format. */
export interface MigrateReport {
  walked: number;
  migrated: { slug: string; from: number; to: number }[];
  skipped: { slug: string; version: number }[];
  failed: { slug: string; error: string }[];
}

export interface MigrateOptions {
  page?: string;
  dryRun?: boolean;
  force?: boolean;
}

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async healthz(): Promise<{ status: string; started: string }> {
    return this.json('GET', '/api/healthz');
  }

  async read(slug: string): Promise<Page> {
    return this.json<Page>('GET', `/api/pages/${slug}`);
  }

  async write(slug: string, body: string, summary: string): Promise<{ ok: true }> {
    return this.json('PUT', `/api/pages/${slug}`, { body, summary });
  }

  async delete(slug: string): Promise<{ ok: true }> {
    return this.json('DELETE', `/api/pages/${slug}`);
  }

  async syncGedcom(gedFile: string, notes: string): Promise<SyncResult> {
    return this.json('POST', '/api/gedcom/sync', { gedFile, notes });
  }

  async reciteDrift(): Promise<{ drift: ReciteEntry[] }> {
    return this.json('GET', '/api/gedcom/recite');
  }

  async applyRecite(): Promise<{ updated: string[] }> {
    return this.json('POST', '/api/gedcom/recite', { apply: true });
  }

  async search(q: string, limit = 25): Promise<{ results: SearchResult[] }> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return this.json('GET', `/api/search?${params.toString()}`);
  }

  async rebuildSearch(): Promise<{ ok: true; pages: number; ms: number }> {
    return this.json('POST', '/api/search/rebuild');
  }

  async rebuildSearchCheck(): Promise<{ stale: boolean }> {
    return this.json('GET', '/api/search/rebuild');
  }

  /**
   * Trigger a migration walk on the server.
   *
   * The server returns 409 with `error: "dirty-repo"` if the data
   * repo is dirty (rerun with `force: true` after committing or
   * stashing); 409 with `error: "future-schema-version"` if the data
   * is ahead of the running build.
   */
  async migrate(opts: MigrateOptions = {}): Promise<MigrateReport> {
    return this.json<MigrateReport>('POST', '/api/migrate', opts);
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { /* keep as text */ }
    if (!res.ok) {
      const detail = parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : text || undefined;
      if (res.status === 404) throw new NotFound(404, detail);
      if (res.status === 400) throw new BadRequest(400, detail);
      throw new ServerError(res.status, detail);
    }
    return parsed as T;
  }
}
