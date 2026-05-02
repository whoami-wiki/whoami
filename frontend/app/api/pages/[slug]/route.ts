import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPageStore, getAuthService } from '@/lib/server-services';
import { isValidSlug } from '@core/pages/index.ts';
import { verifyCsrfToken } from '@core/auth/index.ts';

const PutBody = z.object({
  body: z.string(),
  summary: z.string().min(1).max(200),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });
  try {
    const page = await getPageStore().read(slug);
    return NextResponse.json(page);
  } catch (err) {
    if ((err as Error).message.includes('not found')) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    throw err;
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });

  // CSRF: double-submit
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

  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  // Trust boundary: read on-disk frontmatter to preserve owner; never accept owner from request body
  const existing = await pages.read(slug);
  const updated = { ...existing, body: parsed.data.body };

  await pages.write(slug, updated, { name: session.user.username, email: `${session.user.username}@local` }, parsed.data.summary);
  return NextResponse.json({ ok: true });
}
