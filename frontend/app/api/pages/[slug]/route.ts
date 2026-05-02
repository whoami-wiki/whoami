import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPageStore, invalidateListCache, getSearchIndex, persistSearchIndex } from '@/lib/server-services';
import { DEFAULT_AUTHOR, WHOAMI_ROOT } from '@/lib/env';
import { isValidSlug } from '@core/pages/index.ts';
import type { Page, PageMeta } from '@core/pages/index.ts';
import { buildSearchDoc } from '@core/search/module.ts';
import { loadDerivedRecord } from '@/lib/derived';

const PutBody = z.object({
  body: z.string(),
  summary: z.string().min(1).max(200),
});

function defaultMeta(slug: string): PageMeta {
  return {
    title: titleCaseFromSlug(slug),
    owner: DEFAULT_AUTHOR.name,
    editors: [],
    type: 'meta',
    aliases: [],
    categories: [],
    created: new Date().toISOString().slice(0, 10),
  };
}

function titleCaseFromSlug(slug: string): string {
  const base = slug.endsWith('.talk') ? slug.slice(0, -5) : slug;
  return base.split('-').map(w => w ? w[0]!.toUpperCase() + w.slice(1) : '').join(' ');
}

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
  // PUT is upsert: read existing meta if available, otherwise synthesize defaults.
  let page: Page;
  try {
    const existing = await pages.read(slug);
    page = { ...existing, body: parsed.data.body };
  } catch (err) {
    if (!(err as Error).message.includes('not found')) throw err;
    page = { slug, meta: defaultMeta(slug), body: parsed.data.body };
  }

  try {
    await pages.write(slug, page, DEFAULT_AUTHOR, parsed.data.summary);
  } catch (err) {
    return NextResponse.json({ error: 'write-failed', detail: (err as Error).message }, { status: 500 });
  }
  const idx = await getSearchIndex();
  const derived = page.meta.gedcom?.record
    ? await loadDerivedRecord(WHOAMI_ROOT, page.meta.gedcom.record)
    : null;
  idx.upsert(buildSearchDoc(page, derived));
  await persistSearchIndex();
  invalidateListCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'bad-slug' }, { status: 400 });

  try {
    await getPageStore().softDelete(slug, DEFAULT_AUTHOR);
  } catch (err) {
    return NextResponse.json({ error: 'delete-failed', detail: (err as Error).message }, { status: 500 });
  }
  const idx = await getSearchIndex();
  idx.remove(slug);
  await persistSearchIndex();
  invalidateListCache();
  return NextResponse.json({ ok: true });
}
