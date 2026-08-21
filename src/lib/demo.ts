import type { WeeklySnapshot, FunnelStep, DayUsage, WeekdayUsage } from './metrics';
import type { Phase2Snapshot } from './integrations';
import type { JourneysSnapshot, JourneySession } from './journeys';

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


const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function demoFunnel(): FunnelStep[] {
  const raw: Array<[string, string, number, number, number]> = [
    ['first_open', 'Abriu o app (1ª vez)', 12, 15, 12],
    ['sign_up', 'Criou conta', 8, 9, 8],
    ['login', 'Entrou (login)', 7, 8, 18],
    ['search_location', 'Pesquisou local', 6, 7, 34],
    ['favorite_button_clicked', 'Guardou favorito', 5, 4, 21],
    ['add_location', 'Começou a adicionar local', 3, 2, 7],
    ['add_place_success', 'Adicionou local (concluído)', 2, 2, 7],
    ['review_created', 'Escreveu review', 2, 3, 2],
    ['share_place_completed', 'Partilhou local', 1, 1, 4],
    ['premium_interest_submitted', 'Mostrou interesse no premium', 1, 0, 1],
  ];
  const first = raw[0][2];
  let prev = 0;
  return raw.map(([event, label, users, usersPrev, events]) => {
    const ofPrevious = prev > 0 ? (users / prev) * 100 : null;
    prev = users;
    return { event, label, users, usersPrev, events, ofFirst: (users / first) * 100, ofPrevious };
  });
}

function demoDaily(): DayUsage[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (30 - i));
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const activeUsers = Math.max(1, 5 + (weekend ? 6 : 0) + Math.round(3 * Math.sin(i / 3)));
    return {
      date: d.toISOString().slice(0, 10),
      weekday: WEEKDAYS[d.getDay()],
      activeUsers,
      newUsers: Math.max(0, Math.round(activeUsers * 0.3)),
      sessions: Math.round(activeUsers * 1.6),
      keyEvents: Math.round(activeUsers * 2.4),
      firstOpens: Math.max(0, Math.round(activeUsers * 0.25)),
    };
  });
}

function demoWeekday(daily: DayUsage[]): WeekdayUsage[] {
  const acc = new Map<number, { users: number; sessions: number; days: number }>();
  for (const day of daily) {
    const idx = new Date(`${day.date}T12:00:00Z`).getUTCDay();
    const cur = acc.get(idx) ?? { users: 0, sessions: 0, days: 0 };
    cur.users += day.activeUsers;
    cur.sessions += day.sessions;
    cur.days += 1;
    acc.set(idx, cur);
  }
  return [...acc.entries()]
    .map(([index, v]) => ({
      index,
      weekday: WEEKDAYS[index],
      activeUsers: v.users,
      sessions: v.sessions,
      avgUsers: Math.round((v.users / v.days) * 10) / 10,
    }))
    .sort((a, b) => ((a.index + 6) % 7) - ((b.index + 6) % 7));
}

/** Sample journeys so the per-person table can be judged before BigQuery is on. */
export function demoJourneys(): JourneysSnapshot {
  const scripts: Array<{ user: string; platform: string; country: string; steps: string[][] }> = [
    {
      user: 'A31F7C',
      platform: 'ANDROID',
      country: 'Spain',
      steps: [
        ['first_open', 'Abriu o app (1ª vez)'],
        ['sign_up', 'Criou conta'],
        ['search_location', 'Pesquisou local'],
        ['favorite_button_clicked', 'Guardou favorito'],
      ],
    },
    {
      user: '9BE204',
      platform: 'WEB',
      country: 'Portugal',
      steps: [
        ['page_view', 'Viu página/ecrã'],
        ['search_location', 'Pesquisou local'],
        ['page_view', 'Viu página/ecrã'],
      ],
    },
    {
      user: 'C7D110',
      platform: 'IOS',
      country: 'Spain',
      steps: [
        ['login', 'Entrou (login)'],
        ['search_location', 'Pesquisou local'],
        ['add_location', 'Começou a adicionar local'],
        ['add_place_success', 'Adicionou local (concluído)'],
        ['share_place_completed', 'Partilhou local'],
      ],
    },
    {
      user: 'A31F7C',
      platform: 'ANDROID',
      country: 'Spain',
      steps: [
        ['login', 'Entrou (login)'],
        ['search_location', 'Pesquisou local'],
        ['review_created', 'Escreveu review'],
      ],
    },
  ];

  const keyMoments = ['sign_up', 'add_place_success', 'review_created', 'premium_interest_submitted', 'share_place_completed'];

  const sessions: JourneySession[] = scripts.map((script, i) => {
    const start = Date.now() - (i + 1) * 3.5 * 3600 * 1000;
    const steps = script.steps.map(([event, label], j) => ({
      event,
      label,
      at: new Date(start + j * 47_000).toISOString(),
      offsetSec: j * 47,
    }));
    return {
      user: script.user,
      sessionId: `demo-${i}`,
      platform: script.platform,
      device: script.platform === 'WEB' ? 'desktop' : 'mobile',
      country: script.country,
      source: i % 2 ? 'instagram' : 'direct',
      start: new Date(start).toISOString(),
      durationSec: steps[steps.length - 1].offsetSec,
      steps,
      keyMoments: steps.map((s) => s.event).filter((e) => keyMoments.includes(e)),
    };
  });

  return {
    configured: true,
    note: null,
    days: 7,
    sessions,
    commonPaths: [
      { path: ['Entrou (login)', 'Pesquisou local'], sessions: 2 },
      { path: ['Abriu o app (1ª vez)', 'Criou conta', 'Pesquisou local'], sessions: 1 },
    ],
    totalSessions: sessions.length,
    totalPeople: new Set(sessions.map((s) => s.user)).size,
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
  const daily = demoDaily();

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
    funnel: demoFunnel(),
    daily,
    byWeekday: demoWeekday(daily),
    byHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      activeUsers: Math.max(0, Math.round(14 * Math.exp(-(((hour - 20) / 4) ** 2)) + (hour > 8 && hour < 23 ? 3 : 0))),
    })),
    downloads: {
      total: { current: 12, previous: 15 },
      byPlatform: [
        { label: 'Android', current: 7, previous: 9 },
        { label: 'iOS', current: 5, previous: 6 },
      ],
    },
    errors: {
      items: [
        { event: 'form_validation_error', label: 'Erro de validação no formulário', count: 9, prevCount: 4, users: 5 },
        { event: 'map_error', label: 'Erro no mapa', count: 4, prevCount: 6, users: 3 },
        { event: 'app_exception', label: 'Crash da app (nativo)', count: 2, prevCount: 1, users: 2 },
        { event: 'google_login_error', label: 'Falha no login Google', count: 1, prevCount: 0, users: 1 },
      ],
      total: { current: 16, previous: 11 },
      usersAffected: 5,
      perHundredSessions: 25.4,
      details: [
        { label: 'Cannot read properties of undefined (map)', current: 4, previous: 0 },
        { label: 'auth/popup-closed-by-user', current: 1, previous: 0 },
      ],
      detailDimension: 'customEvent:error_message',
    },
  };
}
