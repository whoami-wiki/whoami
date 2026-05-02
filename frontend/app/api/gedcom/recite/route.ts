import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { z } from 'zod';
import { reciteDrift, applyRecite } from '@core/gedcom/index.ts';
import { verifyCsrfToken } from '@core/auth/index.ts';
import { getAuthService, invalidateListCache } from '@/lib/server-services';
import { WHOAMI_ROOT, PAGES_DIR } from '@/lib/env';

async function gateRequest(req: NextRequest) {
  const sessionId = req.cookies.get('session')?.value;
  const csrfCookie = req.cookies.get('csrf')?.value;
  const csrfHeader = req.headers.get('x-csrf-token');
  if (req.method !== 'GET') {
    if (!sessionId || !csrfCookie || !csrfHeader || !verifyCsrfToken(csrfCookie, csrfHeader)) {
      return NextResponse.json({ error: 'csrf' }, { status: 403 });
    }
  } else if (!sessionId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const auth = getAuthService();
  const session = sessionId ? await auth.validateSession(sessionId) : null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return session;
}

export async function GET(req: NextRequest) {
  const session = await gateRequest(req);
  if (session instanceof NextResponse) return session;

  const drift = await reciteDrift({
    repoRoot: WHOAMI_ROOT,
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
    pagesDir: PAGES_DIR,
  });
  return NextResponse.json({ drift });
}

const ApplyBody = z.object({ apply: z.literal(true) });

export async function POST(req: NextRequest) {
  const session = await gateRequest(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  const parsed = ApplyBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const updated = await applyRecite({
    repoRoot: WHOAMI_ROOT,
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
    pagesDir: PAGES_DIR,
    author: { name: session.user.username, email: `${session.user.username}@local` },
  });
  invalidateListCache();
  return NextResponse.json({ updated });
}
