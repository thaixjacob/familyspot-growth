import type { protos } from '@google-analytics/data';
import { getGa4Client, propertyPath } from './ga4';

type FilterExpression = protos.google.analytics.data.v1beta.IFilterExpression;

/**
 * Domain metrics layer for FamilySpot.
 *
 * One GA4 property holds four data streams (site, blog, iOS, Android), so a
 * handful of runReport calls cover the whole product. Everything the dashboard
 * and the weekly email need comes out of getWeeklySnapshot().
 *
 * "Current" window = last 7 full days (7daysAgo..yesterday).
 * "Previous" window = the 7 days before that (14daysAgo..8daysAgo).
 */

// FamilySpot's meaningful conversion/engagement events (see AnalyticsService.ts
// in the main repo). Order = display order in the report.
const KEY_EVENTS = [
  'first_open',
  'sign_up',
  'login',
  'search_location',
  'add_location',
  'add_place_success',
  'review_created',
  'place_verified',
  'favorite_button_clicked',
  'share_place_completed',
  'premium_interest_submitted',
] as const;

export interface Metric {
  current: number;
  previous: number;
}

export interface NamedCount {
  label: string;
  current: number;
  previous: number;
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  activeUsers: number;
}

export interface WeeklySnapshot {
  generatedAt: string;
  range: { current: string; previous: string };
  headline: {
    activeUsers: Metric;
    newUsers: Metric;
    sessions: Metric;
    screenPageViews: Metric;
    engagementRate: Metric; // 0..1
    avgSessionDuration: Metric; // seconds
  };
  byPlatform: NamedCount[]; // web / iOS / Android — activeUsers
  bySurface: NamedCount[]; // app site vs blog — activeUsers (web only)
  keyEvents: NamedCount[]; // FamilySpot conversion events, count
  topEvents: NamedCount[]; // all events by count (top 12)
  channels: NamedCount[]; // acquisition channel group — sessions
  campaigns: NamedCount[]; // UTM campaign — sessions (partner tracking)
  geo: NamedCount[]; // top country/city — activeUsers
  trend: TrendPoint[]; // active users per day, last 30 days
}

// ── helpers ───────────────────────────────────────────────────────────────

const CURRENT_RANGE = { startDate: '7daysAgo', endDate: 'yesterday', name: 'current' };
const PREVIOUS_RANGE = { startDate: '14daysAgo', endDate: '8daysAgo', name: 'previous' };

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Exclude the founder's own dev traffic (localhost) from every report so it
// doesn't inflate the real numbers. App traffic (hostName "(not set)") is kept.
const DEV_HOSTS = ['localhost', '127.0.0.1'];

function excludeDev(): FilterExpression {
  return {
    notExpression: {
      filter: { fieldName: 'hostName', inListFilter: { values: DEV_HOSTS } },
    },
  };
}

/** AND a report-specific filter together with the dev-traffic exclusion. */
function andDev(expr: FilterExpression): FilterExpression {
  return { andGroup: { expressions: [excludeDev(), expr] } };
}

/**
 * Collapse a two-date-range report into a Map keyed by the first dimension,
 * with { current, previous } values for a single metric (metric index 0).
 * When there are no dimensions, key is '' (totals).
 */
function foldByDateRange(
  rows: Array<{
    dimensionValues?: Array<{ value?: string | null }> | null;
    metricValues?: Array<{ value?: string | null }> | null;
  }> | null | undefined,
  metricIndex = 0,
  keyDimIndex = 0
): Map<string, Metric> {
  const out = new Map<string, Metric>();
  for (const row of rows ?? []) {
    const dims = row.dimensionValues ?? [];
    // The date-range dimension is appended as the LAST dimension by GA4.
    const rangeName = dims[dims.length - 1]?.value ?? 'current';
    const key = dims.length > 1 ? (dims[keyDimIndex]?.value ?? '') : '';
    const value = num(row.metricValues?.[metricIndex]?.value);
    const entry = out.get(key) ?? { current: 0, previous: 0 };
    if (rangeName === 'previous') entry.previous = value;
    else entry.current = value;
    out.set(key, entry);
  }
  return out;
}

function toNamedCounts(map: Map<string, Metric>, relabel?: (k: string) => string): NamedCount[] {
  return [...map.entries()]
    .map(([label, m]) => ({ label: relabel ? relabel(label) : label || '(not set)', ...m }))
    .sort((a, b) => b.current - a.current);
}

// ── report builders ─────────────────────────────────────────────────────────

async function headline() {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensionFilter: excludeDev(),
    metrics: [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
    ],
  });

  const pick = (i: number): Metric => {
    let current = 0;
    let previous = 0;
    for (const row of res.rows ?? []) {
      const range = row.dimensionValues?.[0]?.value ?? 'current';
      const v = num(row.metricValues?.[i]?.value);
      if (range === 'previous') previous = v;
      else current = v;
    }
    return { current, previous };
  };

  return {
    activeUsers: pick(0),
    newUsers: pick(1),
    sessions: pick(2),
    screenPageViews: pick(3),
    engagementRate: pick(4),
    avgSessionDuration: pick(5),
  };
}

async function dimensionReport(
  dimension: string,
  metric: string,
  opts: { limit?: number; bothRanges?: boolean } = {}
): Promise<Map<string, Metric>> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: opts.bothRanges ? [CURRENT_RANGE, PREVIOUS_RANGE] : [CURRENT_RANGE],
    dimensions: [{ name: dimension }],
    metrics: [{ name: metric }],
    dimensionFilter: excludeDev(),
    limit: opts.limit ?? 25,
    orderBys: [{ metric: { metricName: metric }, desc: true }],
  });
  return foldByDateRange(res.rows, 0, 0);
}

async function keyEventsReport(): Promise<NamedCount[]> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: andDev({
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: [...KEY_EVENTS] },
      },
    }),
    limit: 50,
  });
  const map = foldByDateRange(res.rows, 0, 0);
  // Preserve KEY_EVENTS order and include zero-count events so trends read well.
  return KEY_EVENTS.map((name) => {
    const m = map.get(name) ?? { current: 0, previous: 0 };
    return { label: name, current: m.current, previous: m.previous };
  });
}

/**
 * Preferred origin split: by GA4 data stream. The blog is its own stream, so
 * this cleanly separates Site / Blog / iOS / Android regardless of whether the
 * blog lives on a subdomain or a subpath. Falls back to host buckets if the
 * property/API doesn't expose the streamName dimension.
 */
async function surfaceByStream(): Promise<NamedCount[]> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensions: [{ name: 'streamName' }],
    metrics: [{ name: 'activeUsers' }],
    dimensionFilter: excludeDev(),
    limit: 20,
  });
  return toNamedCounts(foldByDateRange(res.rows, 0, 0));
}

async function surface(): Promise<NamedCount[]> {
  try {
    const byStream = await surfaceByStream();
    if (byStream.length) return byStream;
  } catch {
    // streamName dimension unavailable — use the host-based buckets instead.
  }
  return surfaceByHost();
}

async function surfaceByHost(): Promise<NamedCount[]> {
  // Split by hostName, then bucket into readable origins:
  //   Blog · Site (all site hosts merged) · Apps (native, hostName "(not set)").
  // Dev/localhost is already excluded upstream.
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensions: [{ name: 'hostName' }],
    metrics: [{ name: 'activeUsers' }],
    dimensionFilter: excludeDev(),
    limit: 50,
  });

  const buckets = new Map<string, Metric>();
  for (const row of res.rows ?? []) {
    const host = (row.dimensionValues?.[0]?.value ?? '').toLowerCase();
    const range = row.dimensionValues?.[1]?.value ?? 'current';
    const value = num(row.metricValues?.[0]?.value);

    let key: string;
    if (host.includes('blog')) key = 'Blog';
    else if (host === '(not set)' || host === '') key = 'Apps (iOS + Android)';
    else key = 'Site';

    const entry = buckets.get(key) ?? { current: 0, previous: 0 };
    if (range === 'previous') entry.previous += value;
    else entry.current += value;
    buckets.set(key, entry);
  }
  return toNamedCounts(buckets);
}

async function trendReport(): Promise<TrendPoint[]> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [{ startDate: '29daysAgo', endDate: 'yesterday' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }],
    dimensionFilter: excludeDev(),
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 60,
  });
  return (res.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? ''; // YYYYMMDD
    const date =
      raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
    return { date, activeUsers: num(row.metricValues?.[0]?.value) };
  });
}

// ── orchestrator ─────────────────────────────────────────────────────────────

export async function getWeeklySnapshot(): Promise<WeeklySnapshot> {
  const [
    head,
    platform,
    surfaceData,
    keyEvents,
    topEvents,
    channels,
    campaigns,
    country,
    trend,
  ] = await Promise.all([
    headline(),
    dimensionReport('platform', 'activeUsers', { bothRanges: true, limit: 10 }),
    surface(),
    keyEventsReport(),
    dimensionReport('eventName', 'eventCount', { bothRanges: true, limit: 12 }),
    dimensionReport('sessionDefaultChannelGroup', 'sessions', { bothRanges: true, limit: 10 }),
    dimensionReport('sessionCampaignName', 'sessions', { bothRanges: true, limit: 8 }),
    dimensionReport('country', 'activeUsers', { bothRanges: true, limit: 8 }),
    trendReport(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    range: { current: 'Last 7 days', previous: 'Previous 7 days' },
    headline: head,
    byPlatform: toNamedCounts(platform),
    bySurface: surfaceData,
    keyEvents,
    topEvents: toNamedCounts(topEvents),
    channels: toNamedCounts(channels),
    campaigns: toNamedCounts(campaigns).filter((c) => c.label !== '(not set)' || c.current > 0),
    geo: toNamedCounts(country),
    trend,
  };
}
