import type { protos } from '@google-analytics/data';
import { getGa4Client, propertyPath, blogPropertyPath } from './ga4';

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

/** Human labels (pt) for the raw GA4 event names, used across the dashboard. */
export const EVENT_LABELS: Record<string, string> = {
  first_open: 'Abriu o app (1ª vez)',
  session_start: 'Iniciou sessão de uso',
  page_view: 'Viu página/ecrã',
  screen_view: 'Viu ecrã',
  sign_up: 'Criou conta',
  login: 'Entrou (login)',
  search_location: 'Pesquisou local',
  add_location: 'Começou a adicionar local',
  add_place_success: 'Adicionou local (concluído)',
  review_created: 'Escreveu review',
  place_verified: 'Local verificado',
  favorite_button_clicked: 'Guardou favorito',
  share_place_initiated: 'Tocou em partilhar',
  share_place_completed: 'Partilhou local',
  premium_interest_submitted: 'Mostrou interesse no premium',
  user_engagement: 'Uso ativo (tempo no ecrã)',
  first_visit: 'Primeira visita (web)',
  view_place: 'Viu um local',
  place_drawer_opened: 'Abriu a ficha de um local',
  view_place_details: 'Viu os detalhes do local',
  static_map_usage: 'Usou o mapa',
  user_acquired_via_share: 'Chegou por um link partilhado',
  app_update: 'Atualizou a app',
  app_remove: 'Desinstalou a app',
  // Erros (ver ErrorBoundary.tsx / AnalyticsService.ts no repo principal)
  app_exception: 'Crash da app (nativo)',
  exception: 'Exceção não tratada (web)',
  app_error: 'Ecrã rebentou (ErrorBoundary)',
  map_error: 'Erro no mapa',
  add_place_form_error: 'Erro ao adicionar local',
  form_validation_error: 'Erro de validação no formulário',
  sign_up_error: 'Falha ao criar conta',
  google_login_error: 'Falha no login Google',
};

export function eventLabel(name: string): string {
  return EVENT_LABELS[name] ?? name;
}

/**
 * The product journey, in the order a person actually walks it. Used for the
 * step-by-step panel: how many people reached each step and where they drop.
 * It is a "reached this step" funnel (users who fired the event in the window),
 * not a strict sequence — the strict per-person sequence is in journeys.ts.
 */
const JOURNEY_STEPS = [
  'first_open',
  'search_location',
  'place_drawer_opened',
  'view_place_details',
  'favorite_button_clicked',
  'sign_up',
  'login',
  'add_location',
  'add_place_success',
  'review_created',
  'share_place_completed',
  'premium_interest_submitted',
] as const;

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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

export interface FunnelStep {
  event: string;
  label: string;
  users: number; // people who reached this step in the last 7 days
  usersPrev: number;
  events: number; // how many times it happened
  ofFirst: number | null; // % of the first step's users
  ofPrevious: number | null; // % of the previous step's users (drop-off)
}

export interface DayUsage {
  date: string; // YYYY-MM-DD
  weekday: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  keyEvents: number;
  firstOpens: number;
}

export interface WeekdayUsage {
  index: number; // 0 = Sunday
  weekday: string;
  activeUsers: number; // summed over the last 30 days
  sessions: number;
  avgUsers: number; // per occurrence of that weekday
}

export interface HourUsage {
  hour: number; // 0..23, property timezone
  activeUsers: number;
}

export interface ErrorItem {
  event: string;
  label: string;
  count: number; // times it happened, last 7 days
  prevCount: number;
  users: number; // people who hit it
}

export interface ErrorsSummary {
  items: ErrorItem[];
  total: Metric;
  usersAffected: number;
  perHundredSessions: number | null; // errors per 100 sessions — comparable week to week
  details: NamedCount[]; // top error messages/types, when GA4 exposes them
  detailDimension: string | null; // which custom dimension produced `details`
}

export interface Downloads {
  total: Metric; // first_open events, 7d vs previous 7d
  byPlatform: NamedCount[];
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
  funnel: FunnelStep[]; // product journey, users reaching each step
  daily: DayUsage[]; // per-day table, last 30 days
  byWeekday: WeekdayUsage[]; // which days of the week get used, last 30 days
  byHour: HourUsage[]; // which hours get used, last 30 days
  downloads: Downloads; // first_open = installs/first launches
  errors: ErrorsSummary; // crashes + failed flows the app reports to GA4
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

/**
 * The blog is a separate GA4 property, so it can't be split by stream in the
 * main report. Pull its active users directly and surface it as its own origin.
 * Returns null when unconfigured or the service account lacks access (yet).
 */
async function blogOrigin(): Promise<NamedCount | null> {
  const prop = blogPropertyPath();
  if (!prop) return null;
  try {
    const [res] = await getGa4Client().runReport({
      property: prop,
      dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
      metrics: [{ name: 'activeUsers' }],
    });
    let current = 0;
    let previous = 0;
    for (const row of res.rows ?? []) {
      const range = row.dimensionValues?.[0]?.value ?? 'current';
      const value = num(row.metricValues?.[0]?.value);
      if (range === 'previous') previous = value;
      else current = value;
    }
    if (current === 0 && previous === 0) return null;
    return { label: 'Blog', current, previous };
  } catch {
    return null;
  }
}

// ── journey / usage-pattern builders ────────────────────────────────────────

const THIRTY_DAYS = { startDate: '29daysAgo', endDate: 'yesterday' };

/**
 * How many *people* reached each step of the journey (not how many times it
 * happened): activeUsers broken down by eventName. GA4 counts a user once per
 * event name, so `users` answers "quantas pessoas chegaram aqui".
 */
async function journeyFunnel(): Promise<FunnelStep[]> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }],
    dimensionFilter: andDev({
      filter: { fieldName: 'eventName', inListFilter: { values: [...JOURNEY_STEPS] } },
    }),
    limit: 50,
  });

  const byEvent = new Map<string, { users: number; usersPrev: number; events: number }>();
  for (const row of res.rows ?? []) {
    const event = row.dimensionValues?.[0]?.value ?? '';
    const range = row.dimensionValues?.[1]?.value ?? 'current';
    const entry = byEvent.get(event) ?? { users: 0, usersPrev: 0, events: 0 };
    if (range === 'previous') {
      entry.usersPrev = num(row.metricValues?.[0]?.value);
    } else {
      entry.users = num(row.metricValues?.[0]?.value);
      entry.events = num(row.metricValues?.[1]?.value);
    }
    byEvent.set(event, entry);
  }

  const steps = JOURNEY_STEPS.map((event) => {
    const e = byEvent.get(event) ?? { users: 0, usersPrev: 0, events: 0 };
    return { event, label: eventLabel(event), ...e };
  });

  const first = steps.find((step) => step.users > 0)?.users ?? 0;
  let prev = 0;
  return steps.map((step) => {
    const ofFirst = first > 0 ? (step.users / first) * 100 : null;
    const ofPrevious = prev > 0 ? (step.users / prev) * 100 : null;
    if (step.users > 0) prev = step.users;
    return { ...step, ofFirst, ofPrevious };
  });
}

/** Per-day table for the last 30 days: users, new users, sessions, key events. */
async function dailyUsage(): Promise<DayUsage[]> {
  const client = getGa4Client();
  const [[base], [keyEvents], [opens]] = await Promise.all([
    client.runReport({
      property: propertyPath(),
      dateRanges: [THIRTY_DAYS],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' }],
      dimensionFilter: excludeDev(),
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 60,
    }),
    client.runReport({
      property: propertyPath(),
      dateRanges: [THIRTY_DAYS],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: andDev({
        filter: { fieldName: 'eventName', inListFilter: { values: [...KEY_EVENTS] } },
      }),
      limit: 60,
    }),
    client.runReport({
      property: propertyPath(),
      dateRanges: [THIRTY_DAYS],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: andDev({
        filter: { fieldName: 'eventName', stringFilter: { value: 'first_open' } },
      }),
      limit: 60,
    }),
  ]);

  const byDate = (rows: typeof base.rows) => {
    const m = new Map<string, number>();
    for (const row of rows ?? []) {
      m.set(row.dimensionValues?.[0]?.value ?? '', num(row.metricValues?.[0]?.value));
    }
    return m;
  };
  const keyByDate = byDate(keyEvents.rows);
  const opensByDate = byDate(opens.rows);

  const usersByDate = new Map<string, [number, number, number]>();
  for (const row of base.rows ?? []) {
    usersByDate.set(row.dimensionValues?.[0]?.value ?? '', [
      num(row.metricValues?.[0]?.value),
      num(row.metricValues?.[1]?.value),
      num(row.metricValues?.[2]?.value),
    ]);
  }

  // GA4 omits days with no traffic. Fill them in as zeros, otherwise "which day
  // gets used most" silently skips the quiet days and the table lies by omission.
  // Anchor on the newest day GA4 returned so we match the property's timezone.
  const keys = [...usersByDate.keys()].filter((k) => k.length === 8).sort();
  const anchor = keys.length ? keys[keys.length - 1] : yesterdayKey();
  const end = new Date(
    `${anchor.slice(0, 4)}-${anchor.slice(4, 6)}-${anchor.slice(6, 8)}T12:00:00Z`
  );

  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (29 - i));
    const date = d.toISOString().slice(0, 10);
    const raw = date.replace(/-/g, '');
    const [activeUsers = 0, newUsers = 0, sessions = 0] = usersByDate.get(raw) ?? [];
    return {
      date,
      weekday: WEEKDAY_LABELS[d.getUTCDay()],
      activeUsers,
      newUsers,
      sessions,
      keyEvents: keyByDate.get(raw) ?? 0,
      firstOpens: opensByDate.get(raw) ?? 0,
    };
  });
}

function yesterdayKey(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Which weekdays get used, over 30 days (so it isn't one week of noise). */
async function weekdayUsage(daily: DayUsage[]): Promise<WeekdayUsage[]> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [THIRTY_DAYS],
    dimensions: [{ name: 'dayOfWeek' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    dimensionFilter: excludeDev(),
    limit: 10,
  });

  // How many times each weekday occurred in the window, to average fairly.
  const occurrences = new Map<number, number>();
  for (const day of daily) {
    const idx = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    occurrences.set(idx, (occurrences.get(idx) ?? 0) + 1);
  }

  const out: WeekdayUsage[] = [];
  for (const row of res.rows ?? []) {
    const idx = Number(row.dimensionValues?.[0]?.value ?? 0); // "0".."6", 0 = Sunday
    const activeUsers = num(row.metricValues?.[0]?.value);
    const times = occurrences.get(idx) || 1;
    out.push({
      index: idx,
      weekday: WEEKDAY_LABELS[idx] ?? String(idx),
      activeUsers,
      sessions: num(row.metricValues?.[1]?.value),
      avgUsers: Math.round((activeUsers / times) * 10) / 10,
    });
  }
  // Monday-first reading order.
  return out.sort((a, b) => ((a.index + 6) % 7) - ((b.index + 6) % 7));
}

/** Which hours of the day get used (property timezone), over 30 days. */
async function hourUsage(): Promise<HourUsage[]> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [THIRTY_DAYS],
    dimensions: [{ name: 'hour' }],
    metrics: [{ name: 'activeUsers' }],
    dimensionFilter: excludeDev(),
    limit: 30,
  });
  const byHour = new Map<number, number>();
  for (const row of res.rows ?? []) {
    byHour.set(Number(row.dimensionValues?.[0]?.value ?? 0), num(row.metricValues?.[0]?.value));
  }
  return Array.from({ length: 24 }, (_, hour) => ({ hour, activeUsers: byHour.get(hour) ?? 0 }));
}

/**
 * Downloads. GA4 measures `first_open` — the first launch after an install —
 * which is the closest proxy analytics has. True store installs (including
 * people who install and never open) need the Play/App Store reports.
 */
async function downloadsReport(): Promise<Downloads> {
  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensions: [{ name: 'platform' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: andDev({
      filter: { fieldName: 'eventName', stringFilter: { value: 'first_open' } },
    }),
    limit: 10,
  });

  const byPlatform = toNamedCounts(foldByDateRange(res.rows, 0, 0));
  const total = byPlatform.reduce(
    (acc, p) => ({ current: acc.current + p.current, previous: acc.previous + p.previous }),
    { current: 0, previous: 0 }
  );
  return { total, byPlatform };
}

/**
 * Errors. Anything the app reports as a failure ends up in GA4 as an event
 * whose name contains error/exception/fail/crash: `app_exception` (Firebase's
 * automatic native crash event), `app_error` / `map_error` (React error
 * boundaries) and the flow-specific ones (`sign_up_error`, …).
 *
 * Matching by pattern instead of a fixed list means a new error event added to
 * the app shows up here on its own, without touching this file.
 */
const ERROR_PATTERN = '.*(error|exception|fail|crash|denied|timeout).*';

/** Event params GA4 can only break down once registered as custom dimensions. */
const ERROR_DETAIL_DIMENSIONS = [
  'customEvent:error_message',
  'customEvent:error_name',
  'customEvent:error_type',
  'customEvent:error_code',
];

async function errorsReport(): Promise<Omit<ErrorsSummary, 'perHundredSessions'>> {
  const errorFilter: FilterExpression = {
    filter: {
      fieldName: 'eventName',
      stringFilter: { matchType: 'FULL_REGEXP', value: ERROR_PATTERN, caseSensitive: false },
    },
  };

  const [res] = await getGa4Client().runReport({
    property: propertyPath(),
    dateRanges: [CURRENT_RANGE, PREVIOUS_RANGE],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
    dimensionFilter: andDev(errorFilter),
    limit: 50,
  });

  const byEvent = new Map<string, ErrorItem>();
  for (const row of res.rows ?? []) {
    const event = row.dimensionValues?.[0]?.value ?? '';
    const range = row.dimensionValues?.[1]?.value ?? 'current';
    const entry = byEvent.get(event) ?? {
      event,
      label: eventLabel(event),
      count: 0,
      prevCount: 0,
      users: 0,
    };
    if (range === 'previous') {
      entry.prevCount = num(row.metricValues?.[0]?.value);
    } else {
      entry.count = num(row.metricValues?.[0]?.value);
      entry.users = num(row.metricValues?.[1]?.value);
    }
    byEvent.set(event, entry);
  }

  const items = [...byEvent.values()].sort((a, b) => b.count - a.count);
  const total = items.reduce(
    (acc, i) => ({ current: acc.current + i.count, previous: acc.previous + i.prevCount }),
    { current: 0, previous: 0 }
  );
  // Users can hit several error types; the max is the honest lower bound for
  // "how many people saw something break" without double counting.
  const usersAffected = items.reduce((max, i) => Math.max(max, i.users), 0);

  const { details, detailDimension } = total.current
    ? await errorDetails(errorFilter)
    : { details: [], detailDimension: null };

  return { items, total, usersAffected, details, detailDimension };
}

/**
 * Try to break the errors down by the actual message. Only works if the param
 * was registered as a custom dimension in GA4 (Admin → Custom definitions); if
 * not, the API rejects the dimension and we simply skip the breakdown.
 */
async function errorDetails(
  errorFilter: FilterExpression
): Promise<{ details: NamedCount[]; detailDimension: string | null }> {
  for (const dimension of ERROR_DETAIL_DIMENSIONS) {
    try {
      const [res] = await getGa4Client().runReport({
        property: propertyPath(),
        dateRanges: [CURRENT_RANGE],
        dimensions: [{ name: dimension }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: andDev(errorFilter),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 8,
      });
      const details = (res.rows ?? [])
        .map((row) => ({
          label: row.dimensionValues?.[0]?.value ?? '(sem detalhe)',
          current: num(row.metricValues?.[0]?.value),
          previous: 0,
        }))
        .filter((d) => d.label && d.label !== '(not set)' && d.current > 0);
      if (details.length) return { details, detailDimension: dimension };
    } catch {
      // Dimension not registered in this property — try the next one.
    }
  }
  return { details: [], detailDimension: null };
}

// ── orchestrator ─────────────────────────────────────────────────────────────

export async function getWeeklySnapshot(): Promise<WeeklySnapshot> {
  const [
    head,
    platform,
    surfaceData,
    blog,
    keyEvents,
    topEvents,
    channels,
    campaigns,
    country,
    trend,
    funnel,
    daily,
    hours,
    downloads,
    errorStats,
  ] = await Promise.all([
    headline(),
    dimensionReport('platform', 'activeUsers', { bothRanges: true, limit: 10 }),
    surface(),
    blogOrigin(),
    keyEventsReport(),
    dimensionReport('eventName', 'eventCount', { bothRanges: true, limit: 30 }),
    dimensionReport('sessionDefaultChannelGroup', 'sessions', { bothRanges: true, limit: 10 }),
    dimensionReport('sessionCampaignName', 'sessions', { bothRanges: true, limit: 8 }),
    dimensionReport('country', 'activeUsers', { bothRanges: true, limit: 8 }),
    trendReport(),
    journeyFunnel(),
    dailyUsage(),
    hourUsage(),
    downloadsReport(),
    errorsReport(),
  ]);

  // Needs `daily` to know how many Mondays/Tuesdays/... the window held.
  const byWeekday = await weekdayUsage(daily);

  return {
    generatedAt: new Date().toISOString(),
    range: { current: 'Last 7 days', previous: 'Previous 7 days' },
    headline: head,
    byPlatform: toNamedCounts(platform),
    bySurface: blog ? [...surfaceData, blog] : surfaceData,
    keyEvents,
    topEvents: toNamedCounts(topEvents),
    channels: toNamedCounts(channels),
    campaigns: toNamedCounts(campaigns).filter((c) => c.label !== '(not set)' || c.current > 0),
    geo: toNamedCounts(country),
    trend,
    funnel,
    daily,
    byWeekday,
    byHour: hours,
    downloads,
    errors: {
      ...errorStats,
      perHundredSessions: head.sessions.current
        ? (errorStats.total.current / head.sessions.current) * 100
        : null,
    },
  };
}
