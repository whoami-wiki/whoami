import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPageStore, invalidateListCache } from '@/lib/server-services';
import { DEFAULT_AUTHOR } from '@/lib/env';
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

  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const pages = getPageStore();
  const existing = await pages.read(slug);
  const updated = { ...existing, body: parsed.data.body };

  await pages.write(slug, updated, DEFAULT_AUTHOR, parsed.data.summary);
  invalidateListCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });

  await getPageStore().softDelete(slug, DEFAULT_AUTHOR);
  invalidateListCache();
  return NextResponse.json({ ok: true });
}
