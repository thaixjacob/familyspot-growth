'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type {
  DayUsage,
  Downloads,
  ErrorsSummary,
  FunnelStep,
  HourUsage,
  WeekdayUsage,
} from '@/lib/metrics';
import { fmtNum, fmtDelta, deltaDirection } from '@/lib/format';
import { Card, Scroller } from './ui';

const BRAND = '#2563eb';
const MUTED = '#93c5fd';

/** `invert` for metrics where growing is bad (errors): flips the colours only. */
function Delta({
  current,
  previous,
  invert = false,
}: {
  current: number;
  previous: number;
  invert?: boolean;
}) {
  const dir = deltaDirection(current, previous);
  const good = invert ? 'down' : 'up';
  const cls =
    dir === 'flat'
      ? 'text-slate-400'
      : dir === good
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→';
  return (
    <span className={`whitespace-nowrap text-xs font-medium ${cls}`}>
      {arrow} {fmtDelta(current, previous)}
    </span>
  );
}

/**
 * The product journey as a funnel: how many *people* reached each step in the
 * last 7 days, and how much of the previous step that represents.
 */
export function FunnelCard({ steps }: { steps: FunnelStep[] }) {
  // Every step is shown, including the empty ones: "0 pessoas criaram conta" and
  // "este evento ainda não chega ao GA4" look the same if the row disappears.
  const top = Math.max(0, ...steps.map((s) => s.users));
  const missing = steps.filter((s) => s.users === 0 && s.usersPrev === 0 && s.events === 0);
  const rows = steps;

  return (
    <Card
      title="Percurso no produto — passo a passo"
      subtitle="Pessoas que chegaram a cada passo (últimos 7 dias)"
      tip="Cada linha é um passo do produto, na ordem em que as pessoas costumam percorrê-lo. «Pessoas» = utilizadores distintos que dispararam esse evento nos últimos 7 dias (não é quantas vezes aconteceu — isso é a coluna «vezes»). A percentagem é sempre sobre o primeiro passo, quem abriu a app: é aí que se vê onde a maioria fica pelo caminho. Atenção: é «chegou a este passo», não uma sequência estrita — as pessoas saltam passos (abrem um local direto do mapa sem pesquisar). A sequência real de cada pessoa está na tabela de jornadas."
    >
      {top === 0 ? (
        <Empty>Ainda sem eventos-chave registados nesta janela.</Empty>
      ) : (
        <ol className="space-y-2">
          {rows.map((step) => {
            const width = top > 0 ? Math.max(2, (step.users / top) * 100) : 2;
            const dropped = step.ofPrevious != null && step.ofPrevious < 60;
            const silent = step.users === 0 && step.usersPrev === 0 && step.events === 0;
            return (
              <li key={step.event} className={silent ? 'opacity-40' : undefined}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-slate-700 dark:text-slate-300" title={step.event}>
                    {step.label}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {fmtNum(step.users)}
                    </span>
                    <Delta current={step.users} previous={step.usersPrev} />
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, background: BRAND }} />
                  </div>
                  {/* Always measured against the first step: people skip steps
                      (open a place straight from the map without searching), so
                      "% do passo anterior" produces nonsense like 1300%. */}
                  <span
                    className={`w-32 shrink-0 text-right text-[11px] ${
                      dropped ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {step.ofFirst != null ? `${step.ofFirst.toFixed(0)}% de quem abriu` : '—'}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] text-slate-400">
                    {fmtNum(step.events)}×
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {missing.length > 0 && top > 0 && (
        <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800">
          Sem qualquer registo nas duas semanas:{' '}
          <span className="font-mono">{missing.map((s) => s.event).join(', ')}</span>. Para saber se
          é «ninguém fez» ou «não está a chegar ao GA4», vê o quadro{' '}
          <b>Todos os eventos que o GA4 recebe</b> mais abaixo: se o nome não estiver lá, o evento
          nunca chegou.
        </p>
      )}
    </Card>
  );
}

/** Which weekdays get used. Averaged per occurrence so a 30-day window is fair. */
export function WeekdayCard({ data }: { data: WeekdayUsage[] }) {
  const best = data.reduce<WeekdayUsage | null>((a, b) => (!a || b.avgUsers > a.avgUsers ? b : a), null);

  return (
    <Card
      title="Dias com mais uso"
      subtitle="Média de utilizadores ativos por dia da semana (30 dias)"
      tip="Junta os últimos 30 dias e divide pelo número de vezes que cada dia da semana ocorreu — por isso é uma média justa, não um total. Serve para escolher o dia de publicar, enviar newsletter ou lançar novidades."
      right={
        best && best.avgUsers > 0 ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            pico: {best.weekday}
          </span>
        ) : null
      }
    >
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
            <XAxis
              dataKey="weekday"
              tickFormatter={(d: string) => d.slice(0, 3)}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as WeekdayUsage;
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{d.weekday}</div>
                    <div className="text-slate-500">{d.avgUsers} utilizadores/dia em média</div>
                    <div className="text-slate-500">{fmtNum(d.sessions)} sessões no total (30d)</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="avgUsers" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.index} fill={best && d.index === best.index ? BRAND : MUTED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Which hours of the day get used (GA4 property timezone). */
export function HourCard({ data }: { data: HourUsage[] }) {
  const best = data.reduce<HourUsage | null>((a, b) => (!a || b.activeUsers > a.activeUsers ? b : a), null);

  return (
    <Card
      title="Horas com mais uso"
      subtitle="Utilizadores ativos por hora do dia (30 dias)"
      tip="Soma dos últimos 30 dias por hora do dia, no fuso horário configurado na propriedade GA4. Útil para decidir a que horas publicar ou enviar notificações."
      right={
        best && best.activeUsers > 0 ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            pico: {String(best.hour).padStart(2, '0')}h
          </span>
        ) : null
      }
    >
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={(h: number) => `${String(h).padStart(2, '0')}h`}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as HourUsage;
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {String(d.hour).padStart(2, '0')}h — {String((d.hour + 1) % 24).padStart(2, '0')}h
                    </div>
                    <div className="text-slate-500">{fmtNum(d.activeUsers)} utilizadores</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="activeUsers" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.hour} fill={best && d.hour === best.hour ? BRAND : MUTED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Downloads / first launches, split by platform. */
export function DownloadsCard({ downloads }: { downloads: Downloads }) {
  return (
    <Card
      title="Downloads (primeiras aberturas)"
      subtitle="Últimos 7 dias vs 7 anteriores"
      tip="Conta o evento first_open do GA4: a primeira vez que alguém abre a app depois de instalar. É o mais próximo de «downloads» que a analítica vê — quem instala e nunca abre não aparece aqui, e reinstalações contam de novo. O número oficial de instalações vem do relatório da Play Console / App Store Connect (por ligar)."
    >
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {fmtNum(downloads.total.current)}
        </span>
        <Delta current={downloads.total.current} previous={downloads.total.previous} />
      </div>
      {downloads.byPlatform.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {downloads.byPlatform.map((p) => (
            <li key={p.label} className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">{p.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtNum(p.current)}</span>
                <Delta current={p.current} previous={p.previous} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Sem primeiras aberturas nesta janela.</Empty>
      )}
    </Card>
  );
}

/** Day-by-day table: the raw "quantos entraram em cada dia" answer. */
export function DailyTable({ days }: { days: DayUsage[] }) {
  const rows = [...days].reverse(); // most recent first
  const peak = Math.max(1, ...rows.map((d) => d.activeUsers));

  return (
    <Card
      title="Dia a dia — últimos 30 dias"
      subtitle="Mais recente primeiro"
      tip="Uma linha por dia. «Ativos» = pessoas distintas que usaram nesse dia (o mesmo utilizador em dois dias conta uma vez por dia). «Novos» = primeira visita/instalação. «Sessões» = visitas, uma pessoa pode ter várias. «Eventos-chave» = soma das ações que interessam (pesquisar, adicionar local, criar conta…). «Downloads» = primeiras aberturas da app."
    >
      <Scroller className="max-h-96 overflow-y-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-400 dark:bg-slate-900">
            <tr>
              <th className="py-2 text-left font-medium">Dia</th>
              <th className="py-2 text-right font-medium">Ativos</th>
              <th className="py-2 text-right font-medium">Novos</th>
              <th className="py-2 text-right font-medium">Sessões</th>
              <th className="py-2 text-right font-medium">Eventos-chave</th>
              <th className="py-2 text-right font-medium">Downloads</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.date} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-300">
                  <span className="tabular-nums">{d.date.slice(5)}</span>{' '}
                  <span className="text-xs text-slate-400">{d.weekday.slice(0, 3)}</span>
                </td>
                <td className="py-1.5 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="hidden h-1.5 rounded-full sm:block"
                      style={{ width: `${(d.activeUsers / peak) * 56}px`, background: MUTED, minWidth: 2 }}
                    />
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtNum(d.activeUsers)}
                    </span>
                  </span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {fmtNum(d.newUsers)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {fmtNum(d.sessions)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {fmtNum(d.keyEvents)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                  {fmtNum(d.firstOpens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroller>
    </Card>
  );
}

/**
 * Errors: crashes and failed flows the app itself reports to GA4. Everything
 * whose event name looks like an error, so a new one appears here on its own.
 */
export function ErrorsCard({ errors }: { errors: ErrorsSummary }) {
  const worst = errors.items[0];

  return (
    <Card
      title="Erros e falhas"
      subtitle="Últimos 7 dias vs 7 anteriores"
      tip="Tudo o que a app reporta como falha: app_exception (crash nativo, registado automaticamente pelo Firebase), app_error e map_error (um ecrã rebentou), e as falhas de fluxo (sign_up_error, google_login_error, add_place_form_error, form_validation_error). «Por 100 sessões» é a forma justa de comparar semanas com tráfego diferente — o número absoluto sobe só por haver mais gente. Isto não substitui o Crashlytics para ver o stack trace; serve para saber SE e ONDE está a rebentar."
      right={
        errors.total.current > 0 ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            {fmtNum(errors.usersAffected)} afetados
          </span>
        ) : null
      }
    >
      {errors.total.current === 0 && errors.total.previous === 0 ? (
        <Empty>Nenhum erro registado nas últimas duas semanas.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {fmtNum(errors.total.current)}
            </span>
            {/* Fewer errors is good, so the colours are flipped here. */}
            <Delta current={errors.total.current} previous={errors.total.previous} invert />
            {errors.perHundredSessions != null && (
              <span className="text-xs text-slate-500">
                {errors.perHundredSessions.toFixed(1)} por 100 sessões
              </span>
            )}
          </div>

          <ul className="mt-3 space-y-1.5">
            {errors.items.map((item) => (
              <li key={item.event} className="border-t border-slate-100 pt-1.5 first:border-0 dark:border-slate-800">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-300" title={item.event}>
                    {item.label}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtNum(item.count)}
                    </span>
                    <Delta current={item.count} previous={item.prevCount} invert />
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  <span className="font-mono">{item.event}</span> · {fmtNum(item.users)}{' '}
                  {item.users === 1 ? 'pessoa' : 'pessoas'}
                </div>
              </li>
            ))}
          </ul>

          {errors.details.length > 0 ? (
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Mensagens mais frequentes
              </div>
              <ul className="space-y-1">
                {errors.details.map((d) => (
                  <li key={d.label} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-400" title={d.label}>
                      {d.label}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-500">{fmtNum(d.current)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            worst && (
              <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800">
                A app envia a mensagem do erro em <span className="font-mono">error_message</span>,
                mas o GA4 só a mostra depois de a registares em{' '}
                <b>Admin → Definições personalizadas → Criar dimensão personalizada</b> (âmbito
                «evento», parâmetro <span className="font-mono">error_message</span>). Feito isso,
                as mensagens aparecem aqui — a partir dessa data.
              </p>
            )
          )}
        </>
      )}
    </Card>
  );
}

/**
 * Health of the dashboard's own data sources. Connector failures used to be a
 * grey line of text at the bottom; they belong next to the app's errors.
 */
export function ConnectionsCard({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <Card
      title="Estado das ligações"
      subtitle="Fontes de dados deste painel"
      tip="Avisos das ligações que alimentam o painel (Meta, Google Play, App Store, export BigQuery). Não são erros da app FamilySpot: aqui aparece quando uma credencial expirou, uma API não está ativa ou um conector ainda não foi configurado — que é o motivo habitual para um quadro aparecer vazio."
    >
      <ul className="space-y-1.5">
        {notes.map((note) => (
          <li key={note} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-amber-500">•</span>
            <span className="min-w-0">{note}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-slate-400">{children}</p>;
}
