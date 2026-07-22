import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight password gate for the private dashboard.
 *
 * If DASHBOARD_PASSWORD is set, every page (except the /api/* endpoints, which
 * have their own CRON_SECRET auth) requires a cookie matching it. This is a
 * simple "keep casual visitors out" gate, not hardened auth — good enough for a
 * private analytics tool. Set the cookie by visiting /?pw=<password> once.
 */
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  // API routes authenticate themselves via CRON_SECRET.
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // One-time unlock via ?pw=
  const provided = searchParams.get('pw');
  if (provided === password) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('pw');
    const res = NextResponse.redirect(url);
    res.cookies.set('fs_dash', password, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  }

  if (req.cookies.get('fs_dash')?.value === password) return NextResponse.next();

  return new NextResponse(
    `<html><body style="font-family:sans-serif;background:#0b1220;color:#e2e8f0;display:flex;height:100vh;align-items:center;justify-content:center;margin:0;">
      <div style="text-align:center;">
        <h1 style="font-size:18px;">FamilySpot Growth</h1>
        <p style="color:#94a3b8;font-size:14px;">Acesso privado. Adiciona <code>?pw=A_TUA_SENHA</code> ao URL.</p>
      </div>
    </body></html>`,
    { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
