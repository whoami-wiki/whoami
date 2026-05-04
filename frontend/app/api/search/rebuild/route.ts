import { NextResponse } from 'next/server';
import { rebuildSearchIndexFromDisk } from '@/lib/server-services';
import { isSearchIndexStale } from '@/lib/search-staleness';
import { PAGES_DIR, SEARCH_INDEX_FILE } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stale = isSearchIndexStale(PAGES_DIR, SEARCH_INDEX_FILE);
  return NextResponse.json({ stale });
}

export async function POST() {
  try {
    const { pages, ms } = await rebuildSearchIndexFromDisk();
    return NextResponse.json({ ok: true, pages, ms });
  } catch (err) {
    return NextResponse.json(
      { error: 'rebuild-failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
}
