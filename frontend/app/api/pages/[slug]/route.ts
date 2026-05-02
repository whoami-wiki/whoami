import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPageStore, invalidateListCache } from '@/lib/server-services';
import { requireAuth } from '@/lib/route-helpers';
import { isValidSlug } from '@core/pages/index.ts';

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

  const auth = await requireAuth(req, slug);
  if (auth instanceof NextResponse) return auth;

  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  // Trust boundary: read on-disk frontmatter to preserve owner; never accept
  // owner from request body. requireAuth already read the page during the
  // owner check, but it doesn't return it (the AuthService API hides that).
  // Reading again is two file reads of one small file — acceptable today.
  const existing = await auth.pages.read(slug);
  const updated = { ...existing, body: parsed.data.body };

  await auth.pages.write(slug, updated, auth.author, parsed.data.summary);
  invalidateListCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });

  const auth = await requireAuth(req, slug);
  if (auth instanceof NextResponse) return auth;

  await auth.pages.softDelete(slug, auth.author);
  invalidateListCache();
  return NextResponse.json({ ok: true });
}
