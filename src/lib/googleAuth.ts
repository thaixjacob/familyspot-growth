import { GoogleAuth } from 'google-auth-library';

/**
 * Mint a Google OAuth2 access token for a given API scope, reusing the same
 * service-account credentials as GA4 (JSON env var in prod, key file locally).
 * Used by the Play connector (androidpublisher scope) and any future Google API.
 */
const cache = new Map<string, GoogleAuth>();

function authFor(scope: string): GoogleAuth {
  const cached = cache.get(scope);
  if (cached) return cached;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let auth: GoogleAuth;
  if (raw) {
    const creds = JSON.parse(raw) as {
      client_email: string;
      private_key: string;
      project_id?: string;
    };
    auth = new GoogleAuth({
      scopes: [scope],
      projectId: creds.project_id,
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key.replace(/\\n/g, '\n'),
      },
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    auth = new GoogleAuth({ scopes: [scope], keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS });
  } else {
    throw new Error('No Google credentials configured');
  }
  cache.set(scope, auth);
  return auth;
}

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const token = await authFor(scope).getAccessToken();
  if (!token) throw new Error('Failed to obtain Google access token');
  return token;
}
