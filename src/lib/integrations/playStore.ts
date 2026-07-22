import type { StoreSummary } from './index';

/**
 * Google Play — installs + ratings.
 *
 * Planned auth: reuse a Google service account (can be the SAME GCP project as
 * GA4). Grant it access in Play Console → Users & permissions, and link the app.
 *
 * Planned data:
 *   - Ratings + install metrics via the Play Developer Reporting API
 *     (playdeveloperreporting.googleapis.com).
 *   - Recent reviews via Android Publisher API (androidpublisher.reviews.list).
 *
 * Env (to be added when implemented):
 *   PLAY_PACKAGE_NAME              e.g. app.familyspot
 *   GOOGLE_SERVICE_ACCOUNT_JSON    reused from GA4 (must have Play access)
 *
 * Not implemented yet — returns "not configured" so the UI shows a placeholder
 * without breaking. Implemented right after the Meta connector is validated live.
 */

interface PlayResult {
  store: StoreSummary | null;
  notes: string[];
}

export async function fetchPlayStore(): Promise<PlayResult> {
  if (!process.env.PLAY_PACKAGE_NAME) {
    return { store: null, notes: ['Play Store: conector pendente (Fase 2).'] };
  }
  // TODO: implement Play Developer Reporting API + reviews.list pull.
  return { store: null, notes: ['Play Store: conector pendente (Fase 2).'] };
}
