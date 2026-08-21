import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken, cookieOptions } from '@/lib/auth';

/**
 * Login form target. The middleware skips /api/*, so this route is reachable
 * while locked out; it checks the password and sets the same cookie the
 * middleware looks for.
 *
 * Also accepts JSON ({ pw }) so a phone shortcut or curl can unlock too.
 */
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.redirect(new URL('/', req.url), 303);

  const { pw, next } = await readCredentials(req);
  const target = next.startsWith('/') ? next : '/';

  if (pw.trim() !== password.trim()) {
    const url = new URL(target, req.url);
    url.searchParams.set('e', '1');
    return NextResponse.redirect(url, 303);
  }

  const res = NextResponse.redirect(new URL(target, req.url), 303);
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  res.cookies.set(AUTH_COOKIE, await authToken(password), cookieOptions(proto));
  return res;
}

async function readCredentials(req: NextRequest): Promise<{ pw: string; next: string }> {
  const type = req.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) {
      const body = (await req.json()) as { pw?: string; next?: string };
      return { pw: body.pw ?? '', next: body.next ?? '/' };
    }
    const form = await req.formData();
    return { pw: String(form.get('pw') ?? ''), next: String(form.get('next') ?? '/') };
  } catch {
    return { pw: '', next: '/' };
  }
}
