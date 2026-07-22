import type { WeeklySnapshot, NamedCount, Metric } from './metrics';
import type { Phase2Snapshot } from './integrations';
import { fmtNum, fmtDelta, fmtDuration, deltaDirection } from './format';

/** Inline-styled HTML email — inline styles survive email clients better than <style>. */

const UP = '#16a34a';
const DOWN = '#dc2626';
const FLAT = '#64748b';

function deltaSpan(current: number, previous: number): string {
  const dir = deltaDirection(current, previous);
  const color = dir === 'up' ? UP : dir === 'down' ? DOWN : FLAT;
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→';
  return `<span style="color:${color};font-size:12px;">${arrow} ${fmtDelta(current, previous)}</span>`;
}

function kpiCell(label: string, m: Metric, fmt: (n: number) => string = fmtNum): string {
  return `
    <td style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;vertical-align:top;">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
      <div style="font-size:24px;font-weight:700;color:#0f172a;margin:4px 0 2px;">${fmt(m.current)}</div>
      <div>${deltaSpan(m.current, m.previous)}</div>
    </td>`;
}

function listBlock(title: string, items: NamedCount[], max = 6): string {
  if (!items.length) return '';
  const rows = items
    .slice(0, max)
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;">${escapeHtml(i.label)}</td>
        <td style="padding:6px 0;text-align:right;color:#0f172a;font-size:14px;font-weight:600;">${fmtNum(i.current)}</td>
        <td style="padding:6px 0 6px 12px;text-align:right;">${deltaSpan(i.current, i.previous)}</td>
      </tr>`
    )
    .join('');
  return `
    <div style="margin:24px 0 0;">
      <div style="font-size:13px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">${title}</div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function phase2Block(phase2?: Phase2Snapshot): string {
  if (!phase2 || (!phase2.social.length && !phase2.stores.length)) return '';
  const cells = [
    ...phase2.social.map(
      (s) => `${escapeHtml(s.label)}: <b>${s.followers == null ? '—' : fmtNum(s.followers)}</b> seguidores${s.reach7d == null ? '' : ` · alcance 7d ${fmtNum(s.reach7d)}`}`
    ),
    ...phase2.stores.map(
      (s) => `${escapeHtml(s.label)}: <b>${s.ratingAvg == null ? '—' : `★ ${s.ratingAvg.toFixed(1)}`}</b>${s.ratingCount == null ? '' : ` (${fmtNum(s.ratingCount)})`}${s.installs7d == null ? '' : ` · ${fmtNum(s.installs7d)} inst. 7d`}`
    ),
  ];
  const rows = cells
    .map((c) => `<tr><td style="padding:6px 0;font-size:14px;color:#0f172a;">${c}</td></tr>`)
    .join('');
  return `
    <div style="margin:24px 0 0;">
      <div style="font-size:13px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Redes sociais & Lojas</div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>`;
}

export function renderEmail(snapshot: WeeklySnapshot, insights: string, phase2?: Phase2Snapshot): string {
  const h = snapshot.headline;
  const insightsHtml = escapeHtml(insights)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#0f172a;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `
  <div style="background:#f8fafc;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#2563eb;padding:20px 24px;">
        <div style="color:#ffffff;font-size:18px;font-weight:700;">FamilySpot — Resumo semanal</div>
        <div style="color:#dbeafe;font-size:13px;margin-top:2px;">Últimos 7 dias vs 7 dias anteriores · GA4 (site + blog + apps)</div>
      </div>

      <div style="padding:24px;">
        <div style="font-size:13px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">Insights</div>
        ${insightsHtml}

        <div style="font-size:13px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.04em;margin:24px 0 8px;">Métricas-chave</div>
        <table style="width:100%;border-collapse:separate;border-spacing:8px 0;">
          <tr>${kpiCell('Ativos', h.activeUsers)}${kpiCell('Novos', h.newUsers)}</tr>
          <tr>${kpiCell('Sessões', h.sessions)}${kpiCell('Páginas/telas', h.screenPageViews)}</tr>
          <tr>${kpiCell('Engajamento', { current: h.engagementRate.current * 100, previous: h.engagementRate.previous * 100 }, (n) => `${n.toFixed(0)}%`)}${kpiCell('Sessão média', h.avgSessionDuration, fmtDuration)}</tr>
        </table>

        ${listBlock('Por plataforma', snapshot.byPlatform, 4)}
        ${listBlock('Por origem', snapshot.bySurface, 4)}
        ${listBlock('Eventos-chave', snapshot.keyEvents.filter((e) => e.current > 0 || e.previous > 0), 8)}
        ${listBlock('Aquisição (canais)', snapshot.channels, 5)}
        ${listBlock('Campanhas (UTM)', snapshot.campaigns, 5)}
        ${listBlock('Países', snapshot.geo, 5)}
        ${phase2Block(phase2)}

        <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
          Gerado em ${new Date(snapshot.generatedAt).toLocaleString('pt-PT')}. Dashboard completo no teu projeto Vercel.
        </div>
      </div>
    </div>
  </div>`;
}

export function emailSubject(snapshot: WeeklySnapshot): string {
  const au = snapshot.headline.activeUsers;
  return `FamilySpot semanal · ${fmtNum(au.current)} ativos (${fmtDelta(au.current, au.previous)})`;
}
