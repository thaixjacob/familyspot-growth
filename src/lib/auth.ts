/**
 * Shared bits for the dashboard's password gate, used by both the middleware
 * (Edge runtime) and /api/auth (Node) — so no Node-only APIs here, just Web
 * Crypto, which both runtimes provide.
 *
 * The cookie stores a SHA-256 of the password rather than the password itself:
 * same "does this browser know the secret" check, without the secret sitting in
 * the browser and riding along on every request.
 */

export const AUTH_COOKIE = 'fs_dash';

export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`familyspot-growth:${password.trim()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** `secure` only over HTTPS: on plain http (a phone hitting the dev server over
 *  the LAN) a Secure cookie is silently dropped and the login loops forever. */
export function cookieOptions(proto: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: proto === 'https',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  };
}
