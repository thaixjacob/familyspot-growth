import type { StoreSummary } from './index';

/**
 * App Store Connect — ratings + downloads.
 *
 * Planned auth: JWT (ES256) signed with an App Store Connect API key (.p8) —
 * needs the key ID, issuer ID and the private key.
 *
 * Planned data:
 *   - Average rating + rating count and recent reviews via
 *     /v1/apps/{id}/customerReviews and the app's ratings.
 *   - Downloads via Sales & Trends reports (gzipped TSV — gnarlier; second pass).
 *
 * Env (to be added when implemented):
 *   APPSTORE_KEY_ID
 *   APPSTORE_ISSUER_ID
 *   APPSTORE_PRIVATE_KEY     contents of the .p8 file
 *   APPSTORE_APP_ID          numeric App Store app id
 *
 * Not implemented yet — returns "not configured" so the UI shows a placeholder
 * without breaking. Implemented right after the Meta connector is validated live.
 */

interface AppStoreResult {
  store: StoreSummary | null;
  notes: string[];
}

export async function fetchAppStore(): Promise<AppStoreResult> {
  if (!process.env.APPSTORE_APP_ID) {
    return { store: null, notes: ['App Store: conector pendente (Fase 2).'] };
  }
  // TODO: implement JWT auth + customerReviews / ratings pull.
  return { store: null, notes: ['App Store: conector pendente (Fase 2).'] };
}
