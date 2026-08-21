'use client';

import { useMemo, useState } from 'react';
import type { JourneysSnapshot, JourneySession } from '@/lib/journeys';
import { Card } from './ui';

/**
 * The per-person step table: every session, in order, step by step.
 *
 * Data comes from the GA4 → BigQuery export (the Data API is aggregate-only and
 * literally cannot answer "what did this person do next"). When the export
 * isn't linked yet, the panel shows the setup checklist instead of an error.
 */

const TIP =
  'Cada linha é uma sessão de uma pessoa: os passos que deu, pela ordem em que os deu, com o tempo desde o início da sessão. A «pessoa» é o identificador anónimo do GA4 (um por dispositivo/navegador) — não há nome nem email. Toca numa linha para abrir a sequência completa; toca no código da pessoa para ver só as sessões dela.';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtOffset(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}m ${sec % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function JourneyPanel({ journeys }: { journeys: JourneysSnapshot }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const sessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return journeys.sessions.filter((s) => {
      if (userFilter && s.user !== userFilter) return false;
      if (!q) return true;
      return (
        s.user.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.steps.some((step) => step.label.toLowerCase().includes(q) || step.event.toLowerCase().includes(q))
      );
    });
  }, [journeys.sessions, userFilter, query]);

  if (!journeys.configured) {
    return (
      <Card title="Jornada de cada pessoa" tip={TIP}>
        <SetupChecklist note={journeys.note} />
      </Card>
    );
  }

  return (
    <Card
      title="Jornada de cada pessoa"
      subtitle={`${journeys.totalPeople} pessoas · ${journeys.totalSessions} sessões · últimos ${journeys.days} dias`}
      tip={TIP}
    >
      {journeys.commonPaths.length > 0 && (
        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Percursos mais repetidos
          </div>
          <ul className="space-y-1.5">
            {journeys.commonPaths.map((p) => (
              <li key={p.path.join('>')} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 text-slate-700 dark:text-slate-300">
                  {p.path.map((label, i) => (
                    <span key={`${label}-${i}`}>
                      {i > 0 && <span className="mx-1 text-slate-400">›</span>}
                      {label}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{p.sessions}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por passo, país, plataforma…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        {userFilter && (
          <button
            type="button"
            onClick={() => setUserFilter(null)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
          >
            pessoa {userFilter} ✕
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {journeys.note ?? 'Nenhuma sessão corresponde a este filtro.'}
        </p>
      ) : (
        <ul className="max-h-[520px] space-y-1.5 overflow-y-auto">
          {sessions.map((s) => (
            <SessionRow
              key={`${s.user}-${s.sessionId}`}
              session={s}
              open={openId === `${s.user}-${s.sessionId}`}
              onToggle={() =>
                setOpenId((cur) => (cur === `${s.user}-${s.sessionId}` ? null : `${s.user}-${s.sessionId}`))
              }
              onPickUser={() => setUserFilter(s.user)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function SessionRow({
  session,
  open,
  onToggle,
  onPickUser,
}: {
  session: JourneySession;
  open: boolean;
  onToggle: () => void;
  onPickUser: () => void;
}) {
  return (
    <li className="rounded-lg border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onPickUser}
          title="Ver só esta pessoa"
          className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          {session.user}
        </button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-700 dark:text-slate-300">
              {session.steps
                .map((s) => s.label)
                .slice(0, 3)
                .join(' › ')}
              {session.steps.length > 3 && ` › +${session.steps.length - 3}`}
            </span>
            <span className="block text-[11px] text-slate-400">
              {fmtWhen(session.start)} · {session.platform} · {session.country} ·{' '}
              {session.steps.length} passos · {fmtOffset(session.durationSec)}
            </span>
          </span>
          {session.keyMoments.length > 0 && (
            <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
              ★ {session.keyMoments.length}
            </span>
          )}
          <span className="shrink-0 text-slate-400">{open ? '−' : '+'}</span>
        </button>
      </div>

      {open && (
        <ol className="space-y-1 border-t border-slate-100 p-3 dark:border-slate-800">
          {session.steps.map((step, i) => (
            <li key={`${step.event}-${step.at}-${i}`} className="flex items-baseline gap-2 text-sm">
              <span className="w-5 shrink-0 text-right text-[11px] text-slate-400">{i + 1}</span>
              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-slate-400">
                +{fmtOffset(step.offsetSec)}
              </span>
              <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">
                {step.label}
                {step.label !== step.event && (
                  <span className="ml-2 font-mono text-[10px] text-slate-400">{step.event}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function SetupChecklist({ note }: { note: string | null }) {
  return (
    <div className="text-sm text-slate-600 dark:text-slate-400">
      <p>
        O GA4 só devolve <b>totais</b> — para ver o percurso <b>de cada pessoa</b> é preciso ligar o
        export gratuito GA4 → BigQuery (é ele que guarda um registo por evento, com um id anónimo de
        utilizador). Depois de ligado, esta tabela enche-se sozinha.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">
        <li>GA4 → <b>Admin → Product links → BigQuery links → Link</b>, escolhe o projeto Google Cloud e ativa o export diário (e o «streaming», se quiseres ver o próprio dia).</li>
        <li>No Google Cloud, ativa a <b>BigQuery API</b> nesse projeto.</li>
        <li>Dá à service account do dashboard os papéis <b>BigQuery Data Viewer</b> e <b>BigQuery Job User</b>.</li>
        <li>Se o projeto ou dataset não forem os predefinidos, define <code>BIGQUERY_PROJECT_ID</code> e <code>GA4_BIGQUERY_DATASET</code> (ex.: <code>analytics_123456789</code>).</li>
      </ol>
      <p className="mt-3 text-xs text-slate-400">
        Os dados começam a acumular no dia em que ligas o export — não há histórico retroativo.
      </p>
      {note && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {note}
        </p>
      )}
    </div>
  );
}
