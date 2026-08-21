import DashboardView from '@/components/DashboardView';
import { getWeeklySnapshot } from '@/lib/metrics';
import { getPhase2Snapshot } from '@/lib/integrations';
import { getJourneys } from '@/lib/journeys';
import { demoSnapshot, demoPhase2, demoJourneys } from '@/lib/demo';

// GA4 client is Node-only; keep this page on the Node runtime and always fresh.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function SetupNeeded({ error }: { error: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        FamilySpot Growth — configuração pendente
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        O dashboard ainda não consegue ler o GA4. Falta configurar as variáveis de ambiente
        (<code>GA4_PROPERTY_ID</code> e <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>). Segue o
        passo-a-passo no <code>README.md</code>.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {error}
      </pre>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Para veres o aspeto da UI com dados de exemplo,{' '}
        <a className="font-medium text-brand underline" href="/?demo=1">
          abre a pré-visualização →
        </a>
      </p>
    </main>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  if (demo === '1') {
    return (
      <DashboardView
        snapshot={demoSnapshot()}
        phase2={demoPhase2()}
        journeys={demoJourneys()}
        demo
      />
    );
  }

  try {
    // getPhase2Snapshot / getJourneys never throw; getWeeklySnapshot does if GA4
    // isn't set up, which is the one failure worth showing the setup page for.
    const [snapshot, phase2, journeys] = await Promise.all([
      getWeeklySnapshot(),
      getPhase2Snapshot(),
      getJourneys(),
    ]);
    return <DashboardView snapshot={snapshot} phase2={phase2} journeys={journeys} />;
  } catch (err) {
    return <SetupNeeded error={err instanceof Error ? err.message : 'Unknown error'} />;
  }
}
