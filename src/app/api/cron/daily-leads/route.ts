import { isCronRequest, sendDailyReport } from '@/lib/daily-report';
import { getDb } from '@/lib/db';
import { mailerFromEnv } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Vercel Cron only (schedule in vercel.json): emails the team every lead not yet sent, as Excel. */
export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }
  // Vercel sets the production domain; the email links to the staff page there.
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  try {
    const result = await sendDailyReport(await getDb(), mailerFromEnv(), {
      staffUrl: host ? `https://${host}/staff` : null,
    });
    // One line per run (no personal data), so Cron Jobs > View Logs shows what happened.
    console.log(`daily lead email: ${result.status}, ${result.count} leads`);
    return Response.json(result, { status: result.status === 'retry' ? 503 : 200, headers: NO_STORE });
  } catch (err) {
    console.error('daily lead email failed:', err instanceof Error ? err.name : 'unknown');
    return Response.json({ error: 'Please try again' }, { status: 503, headers: NO_STORE });
  }
}
