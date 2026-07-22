import { Resend } from 'resend';

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Send the weekly report via Resend.
 * If RESEND_API_KEY / REPORT_FROM_EMAIL are missing we skip gracefully so the
 * cron job can still render + log the report during setup.
 */
export async function sendWeeklyEmail(subject: string, html: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  const to = process.env.REPORT_TO_EMAIL;

  if (!apiKey || !from || !to) {
    return { ok: false, skipped: true, error: 'Resend env vars not configured' };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: to.split(',').map((s) => s.trim()),
      subject,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
