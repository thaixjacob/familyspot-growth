import { fetchMeta } from './meta';
import { fetchPlayStore } from './playStore';
import { fetchAppStore } from './appStore';

/**
 * Phase 2 — data GA4 cannot see: social reach (Meta) and store acquisition
 * (Play / App Store). Each connector is independent and NEVER throws: it returns
 * its data or null + a human note, so a missing credential degrades one card
 * instead of breaking the dashboard.
 */

export interface SocialSummary {
  source: 'meta_facebook' | 'meta_instagram';
  label: string;
  followers: number | null;
  reach7d: number | null;
  engagement7d: number | null;
}

export interface StoreSummary {
  source: 'play' | 'appstore';
  label: string;
  ratingAvg: number | null; // e.g. 4.6
  ratingCount: number | null;
  installs7d: number | null;
  reviews7d: number | null;
}

export interface Phase2Snapshot {
  social: SocialSummary[];
  stores: StoreSummary[];
  notes: string[];
  configured: boolean;
}

export async function getPhase2Snapshot(): Promise<Phase2Snapshot> {
  const [meta, play, appstore] = await Promise.all([
    fetchMeta().catch((e) => ({ social: [], notes: [`Meta: ${errMsg(e)}`] })),
    fetchPlayStore().catch((e) => ({ store: null, notes: [`Play Store: ${errMsg(e)}`] })),
    fetchAppStore().catch((e) => ({ store: null, notes: [`App Store: ${errMsg(e)}`] })),
  ]);

  const stores: StoreSummary[] = [play.store, appstore.store].filter(
    (s): s is StoreSummary => s != null
  );

  const notes = [...meta.notes, ...play.notes, ...appstore.notes];

  return {
    social: meta.social,
    stores,
    notes,
    configured: meta.social.length > 0 || stores.length > 0,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'erro desconhecido';
}
