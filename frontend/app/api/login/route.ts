import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthService } from '@/lib/server-services';

const Body = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  // Pass null when neither header is present so AuthService skips rate-limiting
  // rather than putting every header-stripped request in a single shared bucket.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null;

  const result = await getAuthService().login(parsed.data.username, parsed.data.password, ip);
  if (result.kind === 'error') {
    const status = result.reason === 'rate-limited' ? 429 : 401;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const res = NextResponse.json({ ok: true, csrf: result.session.csrf });
  res.cookies.set('session', result.session.id, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(result.session.expiresAt),
    path: '/',
  });
  res.cookies.set('csrf', result.session.csrf, {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(result.session.expiresAt),
    path: '/',
  });
  return res;
}
