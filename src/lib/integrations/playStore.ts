import type { StoreSummary } from './index';
import { getGoogleAccessToken } from '../googleAuth';

/**
 * Google Play — recent reviews via the Android Publisher Reviews API.
 *
 * Auth: reuses the GA4 service account. It must be added as a user in Play
 * Console (with review-read permission) and the "Google Play Android Developer
 * API" enabled in the GCP project.
 *
 * Note: the Reviews API only returns reviews from ~the last week that have a
 * text comment (pure star ratings without text are not returned), so this is
 * "recent reviews", not the lifetime store rating. Installs need the Play
 * Console → Cloud Storage report export (a separate step, "Play passo 2").
 *
 * Env: PLAY_PACKAGE_NAME (e.g. com.familyspot.app)
 */

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const WEEK_MS = 7 * 24 * 3600 * 1000;

interface PlayResult {
  store: StoreSummary | null;
  notes: string[];
}

interface PlayReview {
  comments?: Array<{
    userComment?: { starRating?: number; lastModified?: { seconds?: string | number } };
  }>;
}

export async function fetchPlayStore(): Promise<PlayResult> {
  const pkg = process.env.PLAY_PACKAGE_NAME;
  if (!pkg) return { store: null, notes: ['Play Store: define PLAY_PACKAGE_NAME.'] };

  try {
    const token = await getGoogleAccessToken(SCOPE);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      pkg
    )}/reviews?maxResults=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.json()) as { reviews?: PlayReview[]; error?: { message?: string } };
    if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);

    const cutoff = Date.now() - WEEK_MS;
    let count = 0;
    let sum = 0;
    for (const review of body.reviews ?? []) {
      const uc = review.comments?.find((c) => c.userComment)?.userComment;
      if (!uc) continue;
      const ms = uc.lastModified?.seconds ? Number(uc.lastModified.seconds) * 1000 : Date.now();
      if (ms < cutoff) continue;
      count++;
      sum += uc.starRating ?? 0;
    }

    const store: StoreSummary = {
      source: 'play',
      label: 'Google Play',
      ratingAvg: count ? Number((sum / count).toFixed(1)) : null,
      ratingCount: count || null,
      installs7d: null, // Play passo 2 (Cloud Storage export)
      reviews7d: count,
    };
    return {
      store,
      notes: count ? [] : ['Play Store: sem reviews com texto nos últimos 7 dias.'],
    };
  } catch (e) {
    return { store: null, notes: [`Play Store: ${e instanceof Error ? e.message : 'erro'}`] };
  }
}
