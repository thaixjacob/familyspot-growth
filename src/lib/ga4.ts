import { BetaAnalyticsDataClient } from '@google-analytics/data';

/**
 * Single GA4 Data API client, authenticated with a service account.
 *
 * The whole service-account JSON key lives in GOOGLE_SERVICE_ACCOUNT_JSON so it
 * can be a single Vercel env var (no key file to ship). Vercel/CI often store
 * the private key with escaped "\n" — we normalise those back to real newlines.
 */
let cached: BetaAnalyticsDataClient | null = null;

export function getGa4Client(): BetaAnalyticsDataClient {
  if (cached) return cached;

  // Production (Vercel): the whole service-account JSON in one env var.
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    let creds: { client_email?: string; private_key?: string; project_id?: string };
    try {
      creds = JSON.parse(raw);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
    if (!creds.client_email || !creds.private_key) {
      throw new Error('Service-account JSON is missing client_email / private_key');
    }
    cached = new BetaAnalyticsDataClient({
      projectId: creds.project_id,
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key.replace(/\\n/g, '\n'),
      },
    });
    return cached;
  }

  // Local dev: point at the downloaded key file, no minifying needed.
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile) {
    cached = new BetaAnalyticsDataClient({ keyFilename: keyFile });
    return cached;
  }

  throw new Error(
    'Configura GOOGLE_SERVICE_ACCOUNT_JSON (produção) ou GOOGLE_APPLICATION_CREDENTIALS (caminho do ficheiro .json, local)'
  );
}

export function propertyPath(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error('GA4_PROPERTY_ID is not set');
  return `properties/${id.replace(/^properties\//, '')}`;
}

/** The blog lives in a separate GA4 property. Null when not configured. */
export function blogPropertyPath(): string | null {
  const id = process.env.GA4_BLOG_PROPERTY_ID;
  if (!id) return null;
  return `properties/${id.replace(/^properties\//, '')}`;
}
