import { getGoogleAccessToken } from './googleAuth';
import { eventLabel } from './metrics';

/**
 * Per-person journeys — the exact sequence of steps someone takes.
 *
 * WHY BIGQUERY: the GA4 Data API is aggregate-only. It can say "12 people
 * searched", never "this person opened → searched → added a place". The only
 * source with user-level rows is GA4's free BigQuery export (user_pseudo_id +
 * event_timestamp per event), so this module reads that.
 *
 * NO NEW DEPENDENCY: it calls the BigQuery REST `jobs.query` endpoint with the
 * same service account already used for GA4 (scope `bigquery`).
 *
 * Config (all optional if the defaults hold):
 *   BIGQUERY_PROJECT_ID     defaults to the service account's project
 *   GA4_BIGQUERY_DATASET    defaults to `analytics_<GA4_PROPERTY_ID>`
 *   BIGQUERY_LOCATION       dataset region (EU / US / europe-west1); auto-detected
 *   JOURNEYS_DAYS           lookback window, default 7
 *   BIGQUERY_JOURNEYS=off   disables the panel entirely
 *
 * Fails soft: any misconfiguration returns `configured: false` plus a note the
 * dashboard shows as a short setup checklist, instead of breaking the page.
 */

const SCOPE = 'https://www.googleapis.com/auth/bigquery';
const QUERY_TIMEOUT_MS = 25_000;
// Cap the damage if the dataset ever gets big: ~2 GB scanned per load.
const MAX_BYTES_BILLED = '2000000000';

export interface JourneyStep {
  event: string;
  label: string;
  at: string; // ISO timestamp
  offsetSec: number; // seconds since the session started
}

export interface JourneySession {
  user: string; // shortened user_pseudo_id — GA4's anonymous device id
  sessionId: string;
  platform: string;
  device: string;
  country: string;
  source: string;
  start: string; // ISO
  durationSec: number;
  steps: JourneyStep[];
  keyMoments: string[]; // key events reached in this session
}

export interface CommonPath {
  path: string[]; // event labels, in order
  sessions: number;
}

export interface JourneysSnapshot {
  configured: boolean;
  note: string | null;
  days: number;
  sessions: JourneySession[];
  commonPaths: CommonPath[];
  totalSessions: number;
  totalPeople: number;
}

/** Events that add noise to a journey without telling you anything. */
const NOISE_EVENTS = ['user_engagement', 'scroll', 'session_start'];

/** Reaching one of these in a session is worth flagging in the table. */
const KEY_MOMENTS = [
  'sign_up',
  'add_place_success',
  'review_created',
  'premium_interest_submitted',
  'share_place_completed',
];

const empty = (note: string | null, days: number): JourneysSnapshot => ({
  configured: false,
  note,
  days,
  sessions: [],
  commonPaths: [],
  totalSessions: 0,
  totalPeople: 0,
});

export async function getJourneys(limit = 150): Promise<JourneysSnapshot> {
  const days = Number(process.env.JOURNEYS_DAYS ?? 7) || 7;

  if (process.env.BIGQUERY_JOURNEYS === 'off') {
    return empty(null, days);
  }

  let dataset: string;
  let project: string;
  try {
    ({ dataset, project } = resolveTarget());
  } catch (e) {
    return empty(msg(e), days);
  }

  try {
    const rows = await runQuery(buildQuery({ project, dataset, days, limit }));
    const sessions = rows.map(toSession).filter((s) => s.steps.length > 0);
    return {
      configured: true,
      note: sessions.length ? null : 'Sem eventos no período (o export só traz dados a partir do dia em que foi ligado).',
      days,
      sessions,
      commonPaths: commonPaths(sessions),
      totalSessions: sessions.length,
      totalPeople: new Set(sessions.map((s) => s.user)).size,
    };
  } catch (e) {
    return empty(friendlyError(msg(e), project, dataset), days);
  }
}

// ── config ──────────────────────────────────────────────────────────────────

function resolveTarget(): { project: string; dataset: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let saProject: string | undefined;
  if (raw) {
    try {
      saProject = (JSON.parse(raw) as { project_id?: string }).project_id;
    } catch {
      /* handled by the GA4 client with a clearer message */
    }
  }

  const project = process.env.BIGQUERY_PROJECT_ID || saProject;
  if (!project) throw new Error('Define BIGQUERY_PROJECT_ID (projeto Google Cloud do export).');

  const propertyId = (process.env.GA4_PROPERTY_ID ?? '').replace(/^properties\//, '');
  const dataset = process.env.GA4_BIGQUERY_DATASET || (propertyId ? `analytics_${propertyId}` : '');
  if (!dataset) throw new Error('Define GA4_BIGQUERY_DATASET (ex.: analytics_123456789).');

  const safe = /^[A-Za-z0-9_\-.:]+$/;
  if (!safe.test(project) || !safe.test(dataset)) {
    throw new Error('BIGQUERY_PROJECT_ID / GA4_BIGQUERY_DATASET têm caracteres inválidos.');
  }
  return { project, dataset };
}

// ── query ───────────────────────────────────────────────────────────────────

function yyyymmdd(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * One row per (person, session), with the ordered step list packed into a
 * single string (`event@epochMillis|event@epochMillis|…`) so the REST response
 * stays flat and trivial to parse.
 *
 * `events_*` also matches `events_intraday_YYYYMMDD`, so today's partial data
 * is included when streaming export is on — the regex grabs the date either way.
 */
function buildQuery({
  project,
  dataset,
  days,
  limit,
}: {
  project: string;
  dataset: string;
  days: number;
  limit: number;
}): string {
  const start = yyyymmdd(days);
  const end = yyyymmdd(0);
  const noise = NOISE_EVENTS.map((e) => `'${e}'`).join(', ');

  return `
    WITH ev AS (
      SELECT
        user_pseudo_id AS uid,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
        event_name,
        TIMESTAMP_MICROS(event_timestamp) AS ts,
        IFNULL(platform, '') AS platform,
        IFNULL(device.category, '') AS device,
        IFNULL(geo.country, '') AS country,
        IFNULL(traffic_source.source, '') AS source,
        IFNULL(device.web_info.hostname, '') AS hostname
      FROM \`${project}.${dataset}.events_*\`
      WHERE REGEXP_EXTRACT(_TABLE_SUFFIX, r'[0-9]{8}$') BETWEEN '${start}' AND '${end}'
        AND event_name NOT IN (${noise})
    )
    SELECT
      uid,
      CAST(session_id AS STRING) AS session_id,
      ANY_VALUE(platform) AS platform,
      ANY_VALUE(device) AS device,
      ANY_VALUE(country) AS country,
      ANY_VALUE(source) AS source,
      UNIX_MILLIS(MIN(ts)) AS started_ms,
      UNIX_MILLIS(MAX(ts)) AS ended_ms,
      STRING_AGG(CONCAT(event_name, '@', CAST(UNIX_MILLIS(ts) AS STRING)), '|' ORDER BY ts) AS steps
    FROM ev
    WHERE session_id IS NOT NULL
      AND hostname NOT IN ('localhost', '127.0.0.1')
    GROUP BY uid, session_id
    ORDER BY started_ms DESC
    LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}
  `;
}

interface QueryRow {
  f?: Array<{ v?: string | null }>;
}

/**
 * Runs the query, dealing with BigQuery's region rule: a job only sees datasets
 * in its own location, and the API defaults to US. A GA4 export created with
 * "European Union" therefore fails with "not found in location US" unless the
 * location is passed. Rather than making that a manual setting, we try the
 * default, then retry with the region the error itself names (and EU as the
 * common case). BIGQUERY_LOCATION skips the guessing when set.
 */
async function runQuery(query: string): Promise<string[][]> {
  const configured = process.env.BIGQUERY_LOCATION?.trim();
  if (configured) return runQueryIn(query, configured);

  try {
    return await runQueryIn(query, undefined);
  } catch (e) {
    const message = msg(e);
    // "Dataset … was not found in location US" — the dataset lives elsewhere.
    if (!/not found in location|was not found/i.test(message)) throw e;
    const named = /in location ([A-Za-z0-9-]+)/i.exec(message)?.[1];
    for (const location of [...(named && named.toUpperCase() !== 'US' ? [named] : []), 'EU']) {
      try {
        return await runQueryIn(query, location);
      } catch {
        // Fall through to the original error, which is the more useful one.
      }
    }
    throw e;
  }
}

async function runQueryIn(query: string, location: string | undefined): Promise<string[][]> {
  const { project } = resolveTarget();
  const token = await getGoogleAccessToken(SCOPE);
  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(project)}/queries`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        useLegacySql: false,
        timeoutMs: QUERY_TIMEOUT_MS,
        maximumBytesBilled: MAX_BYTES_BILLED,
        ...(location ? { location } : {}),
      }),
    }
  );

  const body = (await res.json()) as {
    rows?: QueryRow[];
    jobComplete?: boolean;
    error?: { message?: string };
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok) throw new Error(body?.error?.message || body?.errors?.[0]?.message || `HTTP ${res.status}`);
  if (body.jobComplete === false) throw new Error('A consulta ao BigQuery demorou demasiado.');

  return (body.rows ?? []).map((row) => (row.f ?? []).map((cell) => cell.v ?? ''));
}

// ── shaping ─────────────────────────────────────────────────────────────────

function toSession(cols: string[]): JourneySession {
  const [uid, sessionId, platform, device, country, source, startedMs, , stepsRaw] = cols;
  const start = Number(startedMs) || 0;

  const steps: JourneyStep[] = (stepsRaw || '')
    .split('|')
    .filter(Boolean)
    .map((chunk) => {
      const at = chunk.lastIndexOf('@');
      const event = at === -1 ? chunk : chunk.slice(0, at);
      const ms = at === -1 ? start : Number(chunk.slice(at + 1)) || start;
      return {
        event,
        label: eventLabel(event),
        at: new Date(ms).toISOString(),
        offsetSec: Math.max(0, Math.round((ms - start) / 1000)),
      };
    });

  const last = steps.length ? steps[steps.length - 1].offsetSec : 0;

  return {
    user: (uid || '').slice(-6).toUpperCase() || '??????',
    sessionId: sessionId || '',
    platform: platform || '—',
    device: device || '—',
    country: country || '—',
    source: source || 'direct',
    start: new Date(start).toISOString(),
    durationSec: last,
    steps,
    keyMoments: [...new Set(steps.map((s) => s.event).filter((e) => KEY_MOMENTS.includes(e)))],
  };
}

/** The step sequences people repeat most (first 4 distinct steps of a session). */
function commonPaths(sessions: JourneySession[], top = 6): CommonPath[] {
  const counts = new Map<string, { path: string[]; sessions: number }>();
  for (const session of sessions) {
    const distinct: string[] = [];
    for (const step of session.steps) {
      if (distinct[distinct.length - 1] !== step.label) distinct.push(step.label);
      if (distinct.length === 4) break;
    }
    if (distinct.length < 2) continue;
    const key = distinct.join(' › ');
    const entry = counts.get(key) ?? { path: distinct, sessions: 0 };
    entry.sessions += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.sessions - a.sessions).slice(0, top);
}

// ── errors ──────────────────────────────────────────────────────────────────

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'erro desconhecido';
}

/** Turn BigQuery's raw errors into the actual next step to take. */
function friendlyError(raw: string, project: string, dataset: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('not found: dataset') || lower.includes('was not found')) {
    return `Dataset ${project}.${dataset} não existe ainda — liga o export GA4 → BigQuery (GA4 → Admin → BigQuery links). Os dados começam no dia seguinte ao link.`;
  }
  if (lower.includes('has not been used') || lower.includes('api') && lower.includes('disabled')) {
    return `Ativa a "BigQuery API" no projeto ${project} (Google Cloud → APIs & Services → Library).`;
  }
  if (lower.includes('permission') || lower.includes('access denied')) {
    return `A service account precisa dos papéis "BigQuery Data Viewer" e "BigQuery Job User" no projeto ${project}.`;
  }
  if (lower.includes('billing')) {
    return `O projeto ${project} precisa de faturação ativa para correr queries no BigQuery (o volume aqui fica no tier grátis).`;
  }
  return raw;
}
