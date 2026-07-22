import type { WeeklySnapshot } from './metrics';
import type { Phase2Snapshot } from './integrations';

export function demoPhase2(): Phase2Snapshot {
  return {
    social: [
      { source: 'meta_instagram', label: 'Instagram', followers: 312, reach7d: 1840, engagement7d: 96 },
      { source: 'meta_facebook', label: 'Facebook', followers: 148, reach7d: 620, engagement7d: 31 },
    ],
    stores: [
      { source: 'play', label: 'Google Play', ratingAvg: 4.6, ratingCount: 23, installs7d: 14, reviews7d: 2 },
      { source: 'appstore', label: 'App Store', ratingAvg: 4.8, ratingCount: 11, installs7d: 9, reviews7d: 1 },
    ],
    notes: ['Dados de exemplo — conectores reais na Fase 2.'],
    configured: true,
  };
}

/**
 * A plausible snapshot for previewing the dashboard before GA4 credentials are
 * wired up (visit /?demo=1). Numbers are deliberately small to match FamilySpot's
 * real early-stage scale — the UI should look right at low volume, not fake-huge.
 */
export function demoSnapshot(): WeeklySnapshot {
  const days = 30;
  const trend = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const base = 6 + Math.round(4 * Math.sin(i / 4)) + (i % 7 === 0 ? 3 : 0);
    return { date: d.toISOString().slice(0, 10), activeUsers: Math.max(1, base) };
  });

  return {
    generatedAt: new Date().toISOString(),
    range: { current: 'Last 7 days', previous: 'Previous 7 days' },
    headline: {
      activeUsers: { current: 41, previous: 38 },
      newUsers: { current: 12, previous: 17 },
      sessions: { current: 63, previous: 55 },
      screenPageViews: { current: 214, previous: 189 },
      engagementRate: { current: 0.58, previous: 0.61 },
      avgSessionDuration: { current: 142, previous: 128 },
    },
    byPlatform: [
      { label: 'web', current: 22, previous: 20 },
      { label: 'Android', current: 12, previous: 11 },
      { label: 'iOS', current: 7, previous: 7 },
    ],
    bySurface: [
      { label: 'Site', current: 18, previous: 17 },
      { label: 'Apps (iOS + Android)', current: 19, previous: 18 },
      { label: 'Blog', current: 6, previous: 4 },
    ],
    keyEvents: [
      { label: 'first_open', current: 12, previous: 15 },
      { label: 'sign_up', current: 3, previous: 5 },
      { label: 'login', current: 18, previous: 16 },
      { label: 'search_location', current: 34, previous: 29 },
      { label: 'add_location', current: 7, previous: 4 },
      { label: 'add_place_success', current: 7, previous: 4 },
      { label: 'review_created', current: 2, previous: 3 },
      { label: 'place_verified', current: 5, previous: 6 },
      { label: 'favorite_button_clicked', current: 21, previous: 19 },
      { label: 'share_place_completed', current: 4, previous: 2 },
      { label: 'premium_interest_submitted', current: 1, previous: 0 },
    ],
    topEvents: [
      { label: 'page_view', current: 214, previous: 189 },
      { label: 'search_location', current: 34, previous: 29 },
      { label: 'favorite_button_clicked', current: 21, previous: 19 },
      { label: 'login', current: 18, previous: 16 },
      { label: 'first_open', current: 12, previous: 15 },
      { label: 'add_location', current: 7, previous: 4 },
    ],
    channels: [
      { label: 'Direct', current: 28, previous: 25 },
      { label: 'Organic Social', current: 15, previous: 10 },
      { label: 'Organic Search', current: 12, previous: 14 },
      { label: 'Referral', current: 8, previous: 6 },
    ],
    campaigns: [
      { label: 'instagram_bio', current: 9, previous: 5 },
      { label: '(not set)', current: 4, previous: 3 },
    ],
    geo: [
      { label: 'Spain', current: 24, previous: 22 },
      { label: 'Brazil', current: 9, previous: 8 },
      { label: 'Portugal', current: 5, previous: 4 },
      { label: 'United Kingdom', current: 3, previous: 4 },
    ],
    trend,
  };
}
