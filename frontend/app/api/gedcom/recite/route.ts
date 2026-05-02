import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { z } from 'zod';
import { reciteDrift, applyRecite } from '@core/gedcom/index.ts';
import { invalidateListCache, rebuildSearchIndexFromDisk } from '@/lib/server-services';
import { WHOAMI_ROOT, PAGES_DIR, DEFAULT_AUTHOR } from '@/lib/env';

export async function GET() {
  const drift = await reciteDrift({
    repoRoot: WHOAMI_ROOT,
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
    pagesDir: PAGES_DIR,
  });
  return NextResponse.json({ drift });
}

const ApplyBody = z.object({ apply: z.literal(true) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ApplyBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const updated = await applyRecite({
    repoRoot: WHOAMI_ROOT,
    genealogyDir: join(WHOAMI_ROOT, 'genealogy'),
    pagesDir: PAGES_DIR,
    author: DEFAULT_AUTHOR,
  });
  invalidateListCache();
  await rebuildSearchIndexFromDisk();
  return NextResponse.json({ updated });
}
