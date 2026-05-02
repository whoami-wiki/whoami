import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import type { Session } from './types.ts';

export interface SessionStoreOptions {
  ttlMs?: number;
}

export interface SessionStore {
  create(userId: string): Promise<Session>;
  get(id: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
}

const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000;

export function createSessionStore(dbPath: string, opts: SessionStoreOptions = {}): SessionStore {
  const ttl = opts.ttlMs ?? DEFAULT_TTL;
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      csrf TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  const insert = db.prepare(
    'INSERT INTO sessions (id, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  );
  const select = db.prepare('SELECT id, user_id, csrf, created_at, expires_at FROM sessions WHERE id = ?');
  const remove = db.prepare('DELETE FROM sessions WHERE id = ?');

  return {
    async create(userId: string): Promise<Session> {
      const id = randomBytes(32).toString('hex');
      const csrf = randomBytes(32).toString('hex');
      const now = new Date();
      const exp = new Date(now.getTime() + ttl);
      insert.run(id, userId, csrf, now.toISOString(), exp.toISOString());
      return { id, userId, csrf, createdAt: now.toISOString(), expiresAt: exp.toISOString() };
    },

    async get(id: string): Promise<Session | null> {
      const row = select.get(id) as
        | { id: string; user_id: string; csrf: string; created_at: string; expires_at: string }
        | undefined;
      if (!row) return null;
      if (new Date(row.expires_at).getTime() < Date.now()) {
        remove.run(id);
        return null;
      }
      return {
        id: row.id,
        userId: row.user_id,
        csrf: row.csrf,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    },

    async delete(id: string): Promise<void> {
      remove.run(id);
    },
  };
}
