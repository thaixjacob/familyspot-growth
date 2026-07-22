import type { SocialSummary } from './index';

/**
 * Meta (Facebook Page + Instagram Business) via the Graph API.
 *
 * Reads ONLY your own page/account insights — this is not outreach, it's the
 * same numbers you see in Meta Business Suite.
 *
 * Env:
 *   META_ACCESS_TOKEN   long-lived page access token (~60 days — rotate)
 *   META_PAGE_ID        Facebook Page ID (optional)
 *   META_IG_USER_ID     Instagram Business/Creator user ID (optional)
 *
 * The Graph API deprecates page-insight metrics often, so each sub-call is
 * independently guarded — a dead metric yields null, never a thrown request.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

interface MetaResult {
  social: SocialSummary[];
  notes: string[];
}

function last7(): { since: number; until: number } {
  const until = Math.floor(Date.now() / 1000);
  return { since: until - 7 * 24 * 3600, until };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  const body = (await res.json()) as { error?: { message?: string } };
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return body;
}

/** Sum a Graph insights metric's daily values over the window. Null if unavailable. */
async function insightSum(
  objectId: string,
  metric: string,
  token: string
): Promise<number | null> {
  const { since, until } = last7();
  const url = `${GRAPH}/${objectId}/insights?metric=${metric}&period=day&since=${since}&until=${until}&access_token=${token}`;
  try {
    const body = (await getJson(url)) as {
      data?: Array<{ values?: Array<{ value?: number }> }>;
    };
    const values = body.data?.[0]?.values ?? [];
    if (!values.length) return null;
    return values.reduce((acc, v) => acc + (typeof v.value === 'number' ? v.value : 0), 0);
  } catch {
    return null;
  }
}

export async function fetchMeta(): Promise<MetaResult> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return { social: [], notes: ['Meta não configurado (falta META_ACCESS_TOKEN).'] };

  const social: SocialSummary[] = [];
  const notes: string[] = [];

  // Facebook Page
  const pageId = process.env.META_PAGE_ID;
  if (pageId) {
    try {
      const info = (await getJson(
        `${GRAPH}/${pageId}?fields=followers_count,fan_count&access_token=${token}`
      )) as { followers_count?: number; fan_count?: number };
      const [reach, engagement] = await Promise.all([
        insightSum(pageId, 'page_impressions_unique', token),
        insightSum(pageId, 'page_post_engagements', token),
      ]);
      social.push({
        source: 'meta_facebook',
        label: 'Facebook',
        followers: info.followers_count ?? info.fan_count ?? null,
        reach7d: reach,
        engagement7d: engagement,
      });
    } catch (e) {
      notes.push(`Facebook: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  // Instagram Business
  const igId = process.env.META_IG_USER_ID;
  if (igId) {
    try {
      const info = (await getJson(
        `${GRAPH}/${igId}?fields=followers_count&access_token=${token}`
      )) as { followers_count?: number };
      const [reach, engagement] = await Promise.all([
        insightSum(igId, 'reach', token),
        insightSum(igId, 'accounts_engaged', token),
      ]);
      social.push({
        source: 'meta_instagram',
        label: 'Instagram',
        followers: info.followers_count ?? null,
        reach7d: reach,
        engagement7d: engagement,
      });
    } catch (e) {
      notes.push(`Instagram: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  if (!pageId && !igId) {
    notes.push('Meta: define META_PAGE_ID e/ou META_IG_USER_ID.');
  }

  return { social, notes };
}
