import { NextRequest, NextResponse } from 'next/server';
import { getPageStore } from '@/lib/server-services';
import { isValidSlug } from '@core/pages/index.ts';

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
