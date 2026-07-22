'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WeeklySnapshot, NamedCount, Metric } from '@/lib/metrics';
import type { Phase2Snapshot } from '@/lib/integrations';
import { fmtNum, fmtDelta, fmtDuration, deltaDirection } from '@/lib/format';

const BRAND = '#2563eb';

function Delta({ current, previous }: { current: number; previous: number }) {
  const dir = deltaDirection(current, previous);
  const cls =
    dir === 'up'
      ? 'text-green-600 dark:text-green-400'
      : dir === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-400';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→';
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {arrow} {fmtDelta(current, previous)}
    </span>
  );
}

function Kpi({
  label,
  m,
  fmt = fmtNum,
}: {
  label: string;
  m: Metric;
  fmt?: (n: number) => string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {fmt(m.current)}
      </div>
      <div className="mt-0.5">
        <Delta current={m.current} previous={m.previous} />
      </div>
    </div>
  );
}

function TopList({ title, items, max = 6 }: { title: string; items: NamedCount[]; max?: number }) {
  const rows = items.filter((i) => i.current > 0 || i.previous > 0).slice(0, max);
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <table className="w-full">
        <tbody>
          {rows.map((i) => (
            <tr key={i.label} className="border-t border-slate-100 first:border-0 dark:border-slate-800">
              <td className="py-1.5 text-sm text-slate-700 dark:text-slate-300">{i.label}</td>
              <td className="py-1.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                {fmtNum(i.current)}
              </td>
              <td className="w-20 py-1.5 pl-3 text-right">
                <Delta current={i.current} previous={i.previous} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900 dark:text-slate-100">
        {fmtNum(payload[0].value)} utilizadores ativos
      </div>
    </div>
  );
}

function Phase2Section({ phase2 }: { phase2: Phase2Snapshot }) {
  if (!phase2.configured && !phase2.social.length && !phase2.stores.length) return null;
  const stat = (label: string, value: number | null, fmt: (n: number) => string = fmtNum) =>
    `${label}: ${value == null ? '—' : fmt(value)}`;
  return (
    <section className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Redes sociais & Lojas
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {phase2.social.map((s) => (
          <div
            key={s.source}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {s.followers == null ? '—' : fmtNum(s.followers)}
            </div>
            <div className="text-xs text-slate-500">seguidores</div>
            <div className="mt-2 text-xs text-slate-500">
              {stat('alcance 7d', s.reach7d)} · {stat('interações 7d', s.engagement7d)}
            </div>
          </div>
        ))}
        {phase2.stores.map((s) => (
          <div
            key={s.source}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {s.ratingAvg == null ? '—' : `★ ${s.ratingAvg.toFixed(1)}`}
            </div>
            <div className="text-xs text-slate-500">
              {s.ratingCount == null ? 'avaliações —' : `${fmtNum(s.ratingCount)} avaliações`}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {stat('instalações 7d', s.installs7d)} · {stat('reviews 7d', s.reviews7d)}
            </div>
          </div>
        ))}
      </div>
      {phase2.notes.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">{phase2.notes.join(' · ')}</p>
      )}
    </section>
  );
}

export default function DashboardView({
  snapshot,
  phase2,
  demo,
}: {
  snapshot: WeeklySnapshot;
  phase2?: Phase2Snapshot;
  demo?: boolean;
}) {
  const h = snapshot.headline;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            FamilySpot — Growth
          </h1>
          <p className="text-sm text-slate-500">
            Últimos 7 dias vs 7 anteriores · GA4 (site + blog + iOS + Android)
          </p>
        </div>
        {demo && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            dados de exemplo
          </span>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Ativos" m={h.activeUsers} />
        <Kpi label="Novos" m={h.newUsers} />
        <Kpi label="Sessões" m={h.sessions} />
        <Kpi label="Páginas/telas" m={h.screenPageViews} />
        <Kpi
          label="Engajamento"
          m={{ current: h.engagementRate.current * 100, previous: h.engagementRate.previous * 100 }}
          fmt={(n) => `${n.toFixed(0)}%`}
        />
        <Kpi label="Sessão média" m={h.avgSessionDuration} fmt={fmtDuration} />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Utilizadores ativos — últimos 30 dias
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={snapshot.trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="fs-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.4 }} />
              <Area
                type="monotone"
                dataKey="activeUsers"
                stroke={BRAND}
                strokeWidth={2}
                fill="url(#fs-trend)"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <TopList title="Eventos-chave" items={snapshot.keyEvents} max={11} />
        <div className="grid gap-4">
          <TopList title="Por plataforma (web = site+blog)" items={snapshot.byPlatform} max={4} />
          <TopList title="Por origem" items={snapshot.bySurface} max={4} />
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <TopList title="Aquisição (canais)" items={snapshot.channels} max={6} />
        <TopList title="Campanhas (UTM)" items={snapshot.campaigns} max={6} />
        <TopList title="Países" items={snapshot.geo} max={6} />
      </section>

      {phase2 && <Phase2Section phase2={phase2} />}

      <details className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
          Como ler estes dados
        </summary>
        <ul className="mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
          <li>
            <b>Tráfego de teste excluído:</b> visitas de <code>localhost</code> (o teu ambiente de
            dev) não contam nestes números.
          </li>
          <li>
            <b>Por plataforma:</b> <code>web</code> = todo o navegador junto (site + blog);{' '}
            <code>iOS</code>/<code>Android</code> = apps nativos.
          </li>
          <li>
            <b>Por origem:</b> Site (todos os hosts do site), Blog, e Apps (iOS+Android juntos, que
            no GA aparecem sem hostname).
          </li>
          <li>
            <b>Direct</b> = entrou direto (URL, favorito, app). <b>Organic Search</b> = motor de
            busca na web (não são downloads das lojas). <b>Referral</b> = link noutro site.{' '}
            <b>Unassigned</b> = o GA não conseguiu atribuir a sessão a um canal.
          </li>
          <li>
            <b>(not set)</b> = campo que o GA não determinou (em campanhas = sessão sem UTM
            marcada).
          </li>
          <li>
            <b>Variações %:</b> com poucos utilizadores, saltos como +700% são ruído de base
            pequena — olha tendências de várias semanas, não picos isolados.
          </li>
        </ul>
      </details>

      <footer className="mt-8 text-center text-xs text-slate-400">
        Gerado em {new Date(snapshot.generatedAt).toLocaleString('pt-PT')}
      </footer>
    </main>
  );
}
