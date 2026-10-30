// Daily lead email, run by Vercel Cron (vercel.json): every lead not yet sent goes to the team
// inbox as an Excel file. Cron delivery is best effort and can miss or repeat a run, so each run
// claims all outstanding leads at once; a failed send gives them back for the next run.
import type { Db } from './db';
import { buildLeadsWorkbook, exportFileName } from './export-workbook';
import { dailyLeadsEmail } from './lead-emails';
import { claimUnreportedLeads, listClaimedLeads, releaseClaimedLeads } from './leads-repository';
import type { Mailer } from './mailer';
import { safeEqual } from './staff-session';

const MIN_CRON_SECRET_LENGTH = 16;

export interface DailyReportResult {
  status: 'sent' | 'nothing-new' | 'email-off' | 'retry';
  count: number;
}

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Without a CRON_SECRET the route stays closed. */
export function isCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH || !authorization) return false;
  return safeEqual(authorization, `Bearer ${secret}`);
}

export async function sendDailyReport(
  db: Db,
  mailer: Mailer | null,
  { staffUrl = null, now = new Date() }: { staffUrl?: string | null; now?: Date } = {},
): Promise<DailyReportResult> {
  if (!mailer) return { status: 'email-off', count: 0 };

  const runAt = now.toISOString();
  if ((await claimUnreportedLeads(db, runAt)) === 0) return { status: 'nothing-new', count: 0 };
  const leads = await listClaimedLeads(db, runAt);

  try {
    const email = dailyLeadsEmail(leads, mailer.teamAddress, staffUrl, now);
    const file = await buildLeadsWorkbook(leads);
    const outcome = await mailer.send(
      { ...email, attachments: [{ filename: exportFileName(now), content: file }] },
      `daily-leads-${runAt}`,
    );
    if (outcome === 'sent') return { status: 'sent', count: leads.length };
  } catch (err) {
    console.error('daily lead email failed:', err instanceof Error ? err.name : 'unknown');
  }
  await releaseClaimedLeads(db, runAt);
  return { status: 'retry', count: leads.length };
}
