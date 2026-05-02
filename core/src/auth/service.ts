import type { Session, User } from './types.ts';
import { loadUsers } from './users.ts';
import { verifyPassword } from './passwords.ts';
import { createSessionStore, type SessionStore } from './sessions.ts';
import { createRateLimiter, type RateLimiter } from './rate-limit.ts';
import type { PageStore } from '../pages/index.ts';

export interface AuthServiceConfig {
  usersPath: string;
  sessionsPath: string;
  loginWindowMs?: number;
  loginMaxAttempts?: number;
}

export type LoginResult =
  | { kind: 'ok'; session: Session }
  | { kind: 'error'; reason: 'invalid-credentials' | 'rate-limited' };

export interface AuthService {
  login(username: string, password: string, ip: string): Promise<LoginResult>;
  validateSession(sessionId: string): Promise<{ user: User; csrf: string } | null>;
  logout(sessionId: string): Promise<void>;
  requireOwnerOrEditor(slug: string, user: User, pages: PageStore): Promise<void>;
}

export function createAuthService(cfg: AuthServiceConfig): AuthService {
  const sessions: SessionStore = createSessionStore(cfg.sessionsPath);
  const limiter: RateLimiter = createRateLimiter({
    windowMs: cfg.loginWindowMs ?? 60_000,
    maxAttempts: cfg.loginMaxAttempts ?? 5,
  });

  return {
    async login(username, password, ip): Promise<LoginResult> {
      if (limiter.check(`login:${ip}`) === 'limited') {
        return { kind: 'error', reason: 'rate-limited' };
      }
      const users = await loadUsers(cfg.usersPath);
      const user = users.find(u => u.username === username);
      // Always run bcrypt to avoid user-enumeration timing
      const ok = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, '$2b$12$invalid_____________________________________');
      if (!user || !ok) return { kind: 'error', reason: 'invalid-credentials' };
      const session = await sessions.create(user.username);
      return { kind: 'ok', session };
    },

    async validateSession(sessionId) {
      const s = await sessions.get(sessionId);
      if (!s) return null;
      const users = await loadUsers(cfg.usersPath);
      const user = users.find(u => u.username === s.userId);
      if (!user) return null;
      return { user, csrf: s.csrf };
    },

    async logout(sessionId) {
      await sessions.delete(sessionId);
    },

    async requireOwnerOrEditor(slug, user, pages) {
      const page = await pages.read(slug);
      const owner = page.meta.owner;
      const editors = page.meta.editors ?? [];
      if (user.username === owner) return;
      if (editors.includes(user.username)) return;
      const err = new Error('forbidden');
      (err as Error & { status?: number }).status = 403;
      throw err;
    },
  };
}
