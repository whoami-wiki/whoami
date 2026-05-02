import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { syncGedcom } from '@core/gedcom/index.ts';
import { invalidateListCache, rebuildSearchIndexFromDisk } from '@/lib/server-services';
import { WHOAMI_ROOT, DEFAULT_AUTHOR } from '@/lib/env';

const Body = z.object({
  gedFile: z.string().regex(/^[a-z0-9._-]+\.ged$/i),
  notes: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const genealogyDir = join(WHOAMI_ROOT, 'genealogy');
  const gedPath = join(genealogyDir, parsed.data.gedFile);
  if (!existsSync(gedPath)) return NextResponse.json({ error: 'ged-not-found' }, { status: 404 });

  try {
    const result = await syncGedcom({
      repoRoot: WHOAMI_ROOT,
      genealogyDir,
      gedFile: parsed.data.gedFile,
      author: DEFAULT_AUTHOR,
      notes: parsed.data.notes,
    });
    invalidateListCache();
    await rebuildSearchIndexFromDisk();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'sync-failed', detail: (err as Error).message }, { status: 500 });
  }
}
