import { NextRequest, NextResponse } from 'next/server';
import { getWeeklySnapshot } from '@/lib/metrics';
import { getPhase2Snapshot } from '@/lib/integrations';
import { generateInsights } from '@/lib/insights';
import { renderEmail, emailSubject } from '@/lib/emailTemplate';
import { sendWeeklyEmail } from '@/lib/email';

// GA4 client is Node-only; force the Node runtime (not edge).
export const runtime = 'nodejs';
// Never cache — this pulls fresh data and sends an email.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly report endpoint. Hit by Vercel Cron (see vercel.json) once a week.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. A manual run can
 * also pass `?key=$CRON_SECRET`. If CRON_SECRET is unset we allow it (dev only).
 * `?dry=1` renders + returns the report without sending the email.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const key = req.nextUrl.searchParams.get('key');
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const dry = req.nextUrl.searchParams.get('dry') === '1';

  try {
    const [snapshot, phase2] = await Promise.all([getWeeklySnapshot(), getPhase2Snapshot()]);
    const insights = await generateInsights(snapshot);
    const html = renderEmail(snapshot, insights, phase2);
    const subject = emailSubject(snapshot);

    if (dry) {
      return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const result = await sendWeeklyEmail(subject, html);
    return NextResponse.json({
      ok: result.ok,
      emailId: result.id,
      skipped: result.skipped ?? false,
      error: result.error,
      subject,
      activeUsers: snapshot.headline.activeUsers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
