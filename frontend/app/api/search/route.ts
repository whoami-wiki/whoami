import { NextRequest, NextResponse } from 'next/server';
import { searchAndJoin } from '@/lib/server-services';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const limitRaw = req.nextUrl.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 25)) : 25;
  const results = await searchAndJoin(q, limit);
  return NextResponse.json({ results });
}
