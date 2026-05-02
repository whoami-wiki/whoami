import { NextRequest, NextResponse } from 'next/server';
import { getCachedList, getSearchIndex } from '@/lib/server-services';
import type { SearchResult } from '@core/search/module.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 25)) : 25;

  if (!q.trim()) return NextResponse.json({ results: [] });

  const idx = await getSearchIndex();
  const hits = idx.query(q, limit);
  if (hits.length === 0) return NextResponse.json({ results: [] });

  const { list } = await getCachedList();
  const bySlug = new Map(list.map(p => [p.slug, p]));
  const results: SearchResult[] = [];
  for (const h of hits) {
    const meta = bySlug.get(h.slug);
    if (!meta || meta.isArchived) continue;
    results.push({ slug: h.slug, title: meta.title, type: meta.type });
  }
  return NextResponse.json({ results });
}
