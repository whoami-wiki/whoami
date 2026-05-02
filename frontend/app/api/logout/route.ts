import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '@/lib/server-services';

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('session')?.value;
  if (sessionId) await getAuthService().logout(sessionId);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('session');
  res.cookies.delete('csrf');
  return res;
}
