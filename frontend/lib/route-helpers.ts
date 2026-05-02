import { NextRequest, NextResponse } from 'next/server';
import type { PageStore } from '@core/pages/index.ts';
import { verifyCsrfToken } from '@core/auth/index.ts';
import type { AuthorIdentity } from '@core/pages/index.ts';
import type { User } from '@core/auth/index.ts';
import { getAuthService, getPageStore } from './server-services';

export interface AuthContext {
  user: User;
  pages: PageStore;
  author: AuthorIdentity;
}

/**
 * Run the CSRF + session + owner-or-editor checks shared by every mutating
 * route. Returns either a `NextResponse` to short-circuit the handler, or an
 * `AuthContext` ready for the operation. Callers do:
 *
 *   const ctx = await requireAuth(req, slug);
 *   if (ctx instanceof NextResponse) return ctx;
 *   await ctx.pages.write(slug, ..., ctx.author, ...);
 */
export async function requireAuth(
  req: NextRequest,
  slug: string,
): Promise<AuthContext | NextResponse> {
  const sessionId = req.cookies.get('session')?.value;
  const csrfCookie = req.cookies.get('csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (!sessionId || !csrfCookie || !csrfHeader || !verifyCsrfToken(csrfCookie, csrfHeader)) {
    return NextResponse.json({ error: 'csrf' }, { status: 403 });
  }

  const auth = getAuthService();
  const session = await auth.validateSession(sessionId);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const pages = getPageStore();
  try {
    await auth.requireOwnerOrEditor(slug, session.user, pages);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return {
    user: session.user,
    pages,
    author: { name: session.user.username, email: `${session.user.username}@local` },
  };
}
