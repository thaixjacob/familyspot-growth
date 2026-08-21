import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken, cookieOptions } from '@/lib/auth';
import { loginPageHtml } from '@/lib/loginPage';

/**
 * Lightweight password gate for the private dashboard.
 *
 * If DASHBOARD_PASSWORD is set, every page (except /api/*, which authenticates
 * itself) requires a cookie matching the password's hash. Not hardened auth —
 * a "keep casual visitors out" gate for a private analytics tool.
 *
 * Two ways in:
 *   1. The login form (posts to /api/auth) — the one that works on a phone.
 *   2. A one-time ?pw=<password> link — kept for existing bookmarks.
 *
 * Mobile notes: the old flow *only* offered ?pw=, which phones mangle (the URL
 * bar autocapitalises the first letter and often treats host+query as a search),
 * and the gate page had no viewport meta, so it rendered desktop-wide.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  // API routes authenticate themselves (CRON_SECRET / the login form itself).
  if (pathname.startsWith('/api/')) return NextResponse.next();

  const token = await authToken(password);
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');

  // One-time unlock via ?pw= (trimmed: mobile keyboards love a trailing space).
  const provided = searchParams.get('pw');
  if (provided != null && provided.trim() === password.trim()) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('pw');
    const res = NextResponse.redirect(url);
    res.cookies.set(AUTH_COOKIE, token, cookieOptions(proto));
    return res;
  }

  if (req.cookies.get(AUTH_COOKIE)?.value === token) return NextResponse.next();

  const failed = searchParams.get('e') === '1';
  return new NextResponse(loginPageHtml({ failed, next: pathname }), {
    status: failed ? 401 : 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
