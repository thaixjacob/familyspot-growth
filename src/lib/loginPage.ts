/**
 * The dashboard's login screen, rendered by the middleware (Edge runtime), so
 * it must be a plain string — no React, no Node APIs.
 *
 * Deliberately mobile-first: viewport meta, a real <input type="password"> with
 * autocapitalise/autocorrect off, and a big tap target. Typing `?pw=…` by hand
 * in a phone URL bar is what used to break.
 */
export function loginPageHtml({ failed, next }: { failed?: boolean; next?: string }): string {
  const target = escapeAttr(next && next.startsWith('/') ? next : '/');
  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>FamilySpot Growth</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #0b1220; color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .card { width: 100%; max-width: 360px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 20px; font-size: 14px; color: #94a3b8; line-height: 1.5; }
  label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
  input {
    width: 100%; padding: 14px; font-size: 16px; /* 16px stops iOS zooming on focus */
    border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0;
  }
  input:focus { outline: 2px solid #2563eb; outline-offset: 1px; }
  button {
    width: 100%; margin-top: 12px; padding: 14px; font-size: 16px; font-weight: 600;
    border: 0; border-radius: 10px; background: #2563eb; color: #fff; cursor: pointer;
  }
  button:active { background: #1d4ed8; }
  .err { color: #fca5a5; font-size: 13px; margin: 0 0 12px; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/api/auth">
    <h1>FamilySpot Growth</h1>
    <p>Painel privado. Introduz a senha para entrar.</p>
    ${failed ? '<p class="err">Senha incorreta. Tenta de novo.</p>' : ''}
    <input type="hidden" name="next" value="${target}">
    <label for="pw">Senha</label>
    <input id="pw" name="pw" type="password" inputmode="text" autocomplete="current-password"
           autocapitalize="none" autocorrect="off" spellcheck="false" autofocus required>
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
