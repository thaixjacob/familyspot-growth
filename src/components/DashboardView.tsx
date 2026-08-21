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
import type { JourneysSnapshot } from '@/lib/journeys';
import { fmtNum, fmtDelta, fmtDuration, deltaDirection } from '@/lib/format';
import { Card, InfoTip } from './ui';
import {
  ConnectionsCard,
  DailyTable,
  DownloadsCard,
  ErrorsCard,
  FunnelCard,
  HourCard,
  WeekdayCard,
} from './UsagePanels';
import JourneyPanel from './JourneyPanel';

const BRAND = '#2563eb';

/** Plain-language explanation for every panel and KPI, shown in the ? bubbles. */
const TIPS = {
  activeUsers:
    'Pessoas distintas que usaram o site ou a app nos últimos 7 dias. A mesma pessoa em 3 dias diferentes conta 1 vez aqui (na tabela dia a dia conta 1 por dia).',
  newUsers:
    'Pessoas que apareceram pela primeira vez nesta janela — primeira visita ao site ou primeira abertura da app.',
  sessions:
    'Visitas. Uma sessão começa quando a pessoa entra e fecha após 30 minutos sem atividade, por isso uma pessoa pode ter várias sessões no mesmo dia.',
  views: 'Páginas do site + ecrãs da app vistos no total. Bom sinal de profundidade de navegação.',
  engagement:
    'Percentagem de sessões «com envolvimento»: duraram mais de 10 segundos, tiveram uma conversão, ou viram 2+ páginas/ecrãs. O oposto disto é uma saída imediata.',
  duration: 'Tempo médio de cada visita, do primeiro ao último evento da sessão.',
  trend:
    'Utilizadores ativos por dia nos últimos 30 dias. Serve para ver a tendência e o efeito de campanhas ou publicações — não somes os pontos, porque a mesma pessoa pode aparecer em vários dias.',
  keyEvents:
    'As ações que interessam ao produto (pesquisar, adicionar local, criar conta, favoritar…). Aqui é o número de VEZES que aconteceram nos últimos 7 dias; no painel de percurso é o número de pessoas.',
  allEvents:
    'Todos os nomes de eventos que o GA4 recebeu nos últimos 7 dias, sem filtro nenhum. É a lista da verdade: se um evento que a app envia não aparece aqui, então não está a chegar ao GA4 (má configuração, stream errada, bloqueador) — e não é apenas «ninguém fez essa ação». Compara com a lista de eventos-chave ao lado.',
  platform:
    'Onde as pessoas estão: «web» = qualquer navegador (site + blog juntos), «iOS» e «Android» = apps nativas.',
  surface:
    'Separa o Site, o Blog e as Apps. No GA4 o tráfego das apps não tem hostname, por isso aparece agrupado como «Apps».',
  channels:
    'Como chegaram: Direct = escreveram o endereço, favorito ou abriram a app; Organic Search = motor de busca; Referral = link noutro site; Organic Social = redes sociais. Unassigned = o GA não conseguiu atribuir.',
  campaigns:
    'Sessões por campanha UTM. Só aparece aqui quem chegou por um link marcado com utm_campaign — útil para medir parcerias e publicações concretas.',
  geo: 'Utilizadores ativos por país nos últimos 7 dias.',
  phase2:
    'Dados que o GA4 não vê: seguidores e alcance das redes sociais (Meta) e avaliações/instalações das lojas. Cada bloco depende da sua própria credencial; sem ela mostra —.',
} as const;

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
    <span className={`whitespace-nowrap text-xs font-medium ${cls}`}>
      {arrow} {fmtDelta(current, previous)}
    </span>
  );
}

function Kpi({
  label,
  m,
  tip,
  fmt = fmtNum,
}: {
  label: string;
  m: Metric;
  tip: string;
  fmt?: (n: number) => string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-1">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 sm:text-xs">{label}</div>
        <InfoTip text={tip} />
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl dark:text-slate-100">
        {fmt(m.current)}
      </div>
      <div className="mt-0.5">
        <Delta current={m.current} previous={m.previous} />
      </div>
    </div>
  );
}

function TopList({
  title,
  tip,
  items,
  max = 6,
  unit,
}: {
  title: string;
  tip: string;
  items: NamedCount[];
  max?: number;
  unit?: string;
}) {
  const rows = items.filter((i) => i.current > 0 || i.previous > 0).slice(0, max);
  if (!rows.length) return null;
  return (
    <Card title={title} tip={tip} subtitle={unit}>
      <table className="w-full">
        <tbody>
          {rows.map((i) => (
            <tr
              key={i.label}
              className="border-t border-slate-100 first:border-0 dark:border-slate-800"
            >
              <td className="py-1.5 pr-2 text-sm text-slate-700 dark:text-slate-300">{i.label}</td>
              <td className="py-1.5 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {fmtNum(i.current)}
              </td>
              <td className="w-16 py-1.5 pl-2 text-right sm:w-20 sm:pl-3">
                <Delta current={i.current} previous={i.previous} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
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
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Redes sociais &amp; Lojas
        </h2>
        <InfoTip text={TIPS.phase2} />
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
      {/* As notas dos conectores vivem no quadro "Estado das ligações". */}
    </section>
  );
}

export default function DashboardView({
  snapshot,
  phase2,
  journeys,
  demo,
}: {
  snapshot: WeeklySnapshot;
  phase2?: Phase2Snapshot;
  journeys?: JourneysSnapshot;
  demo?: boolean;
}) {
  const h = snapshot.headline;
  const connectionNotes = [
    ...(phase2?.notes ?? []),
    ...(journeys?.note ? [`Jornadas: ${journeys.note}`] : []),
  ];
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-100">
            FamilySpot — Growth
          </h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Últimos 7 dias vs 7 anteriores · GA4 (site + blog + iOS + Android)
          </p>
        </div>
        {demo && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            dados de exemplo
          </span>
        )}
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        <Kpi label="Ativos" m={h.activeUsers} tip={TIPS.activeUsers} />
        <Kpi label="Novos" m={h.newUsers} tip={TIPS.newUsers} />
        <Kpi label="Sessões" m={h.sessions} tip={TIPS.sessions} />
        <Kpi label="Páginas/telas" m={h.screenPageViews} tip={TIPS.views} />
        <Kpi
          label="Engajamento"
          m={{ current: h.engagementRate.current * 100, previous: h.engagementRate.previous * 100 }}
          tip={TIPS.engagement}
          fmt={(n) => `${n.toFixed(0)}%`}
        />
        <Kpi label="Sessão média" m={h.avgSessionDuration} tip={TIPS.duration} fmt={fmtDuration} />
      </section>

      <div className="mt-4">
        <Card title="Utilizadores ativos — últimos 30 dias" tip={TIPS.trend}>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={snapshot.trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="fs-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#94a3b8"
                  strokeOpacity={0.18}
                  vertical={false}
                />
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
                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: '#94a3b8', strokeOpacity: 0.4 }}
                />
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
        </Card>
      </div>

      {/* ── Como as pessoas usam ─────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FunnelCard steps={snapshot.funnel} />
        <div className="grid gap-4">
          <WeekdayCard data={snapshot.byWeekday} />
          <DownloadsCard downloads={snapshot.downloads} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <HourCard data={snapshot.byHour} />
        <ErrorsCard errors={snapshot.errors} />
      </div>

      <div className="mt-4">
        <DailyTable days={snapshot.daily} />
      </div>

      {journeys && (
        <div className="mt-4">
          <JourneyPanel journeys={journeys} />
        </div>
      )}

      {/* ── Quem e de onde ───────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TopList
          title="Eventos-chave"
          tip={TIPS.keyEvents}
          items={snapshot.keyEvents}
          max={11}
          unit="nº de vezes, últimos 7 dias"
        />
        <TopList
          title="Todos os eventos que o GA4 recebe"
          tip={TIPS.allEvents}
          items={snapshot.topEvents}
          max={20}
          unit="nº de vezes, últimos 7 dias"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TopList
          title="Por plataforma"
          tip={TIPS.platform}
          items={snapshot.byPlatform}
          max={4}
          unit="utilizadores ativos"
        />
        <TopList
          title="Por origem"
          tip={TIPS.surface}
          items={snapshot.bySurface}
          max={4}
          unit="utilizadores ativos"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <TopList
          title="Aquisição (canais)"
          tip={TIPS.channels}
          items={snapshot.channels}
          max={6}
          unit="sessões"
        />
        <TopList
          title="Campanhas (UTM)"
          tip={TIPS.campaigns}
          items={snapshot.campaigns}
          max={6}
          unit="sessões"
        />
        <TopList title="Países" tip={TIPS.geo} items={snapshot.geo} max={6} unit="utilizadores" />
      </div>

      {phase2 && <Phase2Section phase2={phase2} />}

      {connectionNotes.length > 0 && (
        <div className="mt-4">
          <ConnectionsCard notes={connectionNotes} />
        </div>
      )}

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
            <b>Pessoas vs vezes:</b> «utilizadores/pessoas» conta cada uma só uma vez na janela;
            «eventos/vezes» conta cada ação. Por isso 3 pessoas podem gerar 40 pesquisas.
          </li>
          <li>
            <b>Por plataforma:</b> <code>web</code> = todo o navegador junto (site + blog);{' '}
            <code>iOS</code>/<code>Android</code> = apps nativas.
          </li>
          <li>
            <b>Downloads:</b> medidos por <code>first_open</code> (primeira abertura depois de
            instalar). Quem instala e nunca abre não aparece — esse número só existe nos relatórios
            das lojas.
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
          <li>
            <b>Jornadas por pessoa:</b> vêm do export GA4 → BigQuery e usam um id anónimo por
            dispositivo (sem nome nem email). O GA4 sozinho só dá totais.
          </li>
          <li>
            <b>Erros:</b> só aparecem os que a app comunica ao GA4 (crashes nativos e os
            <code> *_error</code> dos formulários e dos ecrãs). Um erro que a app engole em
            silêncio não chega aqui — para stack traces completos, o sítio é o Crashlytics.
          </li>
        </ul>
      </details>

      <footer className="mt-8 text-center text-xs text-slate-400">
        Gerado em {new Date(snapshot.generatedAt).toLocaleString('pt-PT')}
      </footer>
    </main>
  );
}
