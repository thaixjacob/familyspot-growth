import Anthropic from '@anthropic-ai/sdk';
import type { WeeklySnapshot, NamedCount } from './metrics';
import { fmtDelta } from './format';

/**
 * Turn the raw weekly snapshot into a short narrative of insights.
 *
 * If ANTHROPIC_API_KEY is set, Claude writes it (direct, risk-naming, no
 * cheerleading — matching how the founder wants to be advised). Otherwise we
 * fall back to a rule-based summary so the weekly email still works.
 */

function topLine(items: NamedCount[], n = 3): string {
  return (
    items
      .slice(0, n)
      .map((i) => `${i.label} (${i.current}${i.previous ? `, ${fmtDelta(i.current, i.previous)}` : ''})`)
      .join('; ') || '—'
  );
}

function snapshotToText(s: WeeklySnapshot): string {
  const h = s.headline;
  const line = (label: string, m: { current: number; previous: number }) =>
    `${label}: ${m.current} (prev ${m.previous}, ${fmtDelta(m.current, m.previous)})`;
  return [
    `Period: last 7 days vs previous 7 days.`,
    line('Active users', h.activeUsers),
    line('New users', h.newUsers),
    line('Sessions', h.sessions),
    line('Screen/page views', h.screenPageViews),
    `Engagement rate: ${(h.engagementRate.current * 100).toFixed(1)}% (prev ${(h.engagementRate.previous * 100).toFixed(1)}%)`,
    `Avg session: ${h.avgSessionDuration.current.toFixed(0)}s (prev ${h.avgSessionDuration.previous.toFixed(0)}s)`,
    `By platform: ${topLine(s.byPlatform, 4)}`,
    `Site vs blog: ${topLine(s.bySurface, 4)}`,
    `Key events: ${s.keyEvents.map((e) => `${e.label}=${e.current}(${fmtDelta(e.current, e.previous)})`).join(', ')}`,
    `Top events: ${topLine(s.topEvents, 6)}`,
    `Acquisition channels: ${topLine(s.channels, 5)}`,
    `Campaigns (UTM): ${topLine(s.campaigns, 5)}`,
    `Top countries: ${topLine(s.geo, 5)}`,
  ].join('\n');
}

const SYSTEM_PROMPT = `You are the growth + data analyst for FamilySpot, a bootstrapped app (React + Firebase) that helps families discover family-friendly places. It ships to web (familyspot.app), a blog (blog.familyspot.app), and iOS + Android. It is very early: under ~50 users, 300+ places, pre-revenue, run by a solo founder.

You write a weekly analytics digest from GA4 data. Rules:
- Be direct and useful. Name what actually changed and what it likely means. Do NOT cheerlead, pad, or celebrate noise.
- At this tiny scale, most week-over-week swings are noise. Say so when the numbers are too small to trust. Never present a jump from 2 to 4 as "100% growth" without flagging the tiny base.
- Prioritise the founder's real levers: add_place / add_location (network effect), search_location (intent), sign_up (activation), returning vs new users (retention). Store installs and social reach are not in this data yet.
- Surface at most 3 things worth acting on, and be concrete ("X dropped, check Y").
- No emojis. No motivational filler. Portuguese (pt) output.
- Output format: 2-4 short paragraphs OR a tight bulleted list. Keep it under ~180 words. Lead with the single most important takeaway.`;

export async function generateInsights(snapshot: WeeklySnapshot): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return ruleBasedInsights(snapshot);

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is this week's GA4 data for FamilySpot. Write the weekly digest.\n\n${snapshotToText(snapshot)}`,
        },
      ],
    });
    const text = msg.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();
    return text || ruleBasedInsights(snapshot);
  } catch {
    // Never let the digest fail because the AI call failed.
    return ruleBasedInsights(snapshot);
  }
}

/** Deterministic fallback: no AI, just the headline movements. */
function ruleBasedInsights(s: WeeklySnapshot): string {
  const h = s.headline;
  const lines: string[] = [];
  lines.push(
    `Utilizadores ativos: ${h.activeUsers.current} (${fmtDelta(h.activeUsers.current, h.activeUsers.previous)} vs semana anterior). Novos: ${h.newUsers.current}.`
  );
  const topEvent = s.keyEvents.filter((e) => e.current > 0).sort((a, b) => b.current - a.current)[0];
  if (topEvent) {
    lines.push(
      `Evento-chave com mais atividade: ${topEvent.label} (${topEvent.current}, ${fmtDelta(topEvent.current, topEvent.previous)}).`
    );
  }
  const adds = s.keyEvents.find((e) => e.label === 'add_location' || e.label === 'add_place_success');
  if (adds) {
    lines.push(`Lugares adicionados (network effect): ${adds.current} (${fmtDelta(adds.current, adds.previous)}).`);
  }
  if (h.activeUsers.current < 30) {
    lines.push(
      'Nota: com este volume, variações semanais são maioritariamente ruído estatístico. Trata tendências de várias semanas, não picos isolados.'
    );
  }
  return lines.join('\n\n');
}
