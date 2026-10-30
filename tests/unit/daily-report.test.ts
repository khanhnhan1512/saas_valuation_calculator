// Daily lead email against a real Postgres (PGlite): claims, retries and the attached workbook.
import ExcelJS from 'exceljs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCronRequest, sendDailyReport } from '@/lib/daily-report';
import { applySchema, connectPglite, type Db } from '@/lib/db';
import type { OutgoingEmail } from '@/lib/lead-emails';
import { processLead } from '@/lib/lead-intake';
import type { Mailer, SendOutcome } from '@/lib/mailer';

let db: Db;
const getDb = async () => db;

beforeAll(async () => {
  db = await connectPglite('memory://');
  await applySchema(db);
});

beforeEach(async () => {
  await db.query('TRUNCATE leads');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

let leadNumber = 0;
async function addLead(firstName: string) {
  leadNumber += 1;
  const id = `00000000-0000-4000-8000-${String(leadNumber).padStart(12, '0')}`;
  const res = await processLead(
    JSON.stringify({
      id, submittedAt: '2026-11-04T15:30:00.000Z', arr: 4_000_000, selection: 'Healthcare',
      firstName, lastName: 'Doe', company: 'Northwind Health', email: 'jane@northwind.io',
      phone: '6474515164', nextMove: 'Just exploring', nextMoveOther: '', source: 'saas-north-2026-booth',
    }),
    getDb,
  );
  expect(res.status).toBe(200);
}

/** Records each email; outcomes are scripted in order, defaulting to "sent". */
function fakeMailer(outcomes: SendOutcome[] = []) {
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    teamAddress: 'connect@aspen.example',
    async send(email) {
      sent.push(email);
      return outcomes.shift() ?? 'sent';
    },
  };
  return { mailer, sent };
}

async function workbookRows(email: OutgoingEmail): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(email.attachments![0].content) as never);
  return workbook.getWorksheet('SaaS North Leads')!.rowCount - 1; // minus the header row
}

const NOW = new Date('2026-11-04T23:10:00.000Z');
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe('daily lead email', () => {
  it('emails every new lead to the team as one Excel file, then never again', async () => {
    await addLead('Jane');
    await addLead('<b>Sam</b>');
    const { mailer, sent } = fakeMailer();

    expect(await sendDailyReport(db, mailer, { now: NOW, staffUrl: 'https://calc.example/staff' })).toEqual({
      status: 'sent',
      count: 2,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('connect@aspen.example');
    expect(sent[0].subject).toBe('SaaS calculator leads: 2 new (Nov 4, 2026)');
    expect(sent[0].text).toContain('2 new leads since the last email.');
    expect(sent[0].text).toContain('https://calc.example/staff');
    expect(sent[0].html).not.toContain('<b>Sam</b>');
    expect(sent[0].attachments![0].filename).toBe('SaaS_North_Leads_2026-11-04.xlsx');
    expect(await workbookRows(sent[0])).toBe(2);

    // A repeated or later run with nothing new sends nothing.
    expect(await sendDailyReport(db, mailer, { now: later(5) })).toEqual({ status: 'nothing-new', count: 0 });
    expect(sent).toHaveLength(1);
  });

  it('sends only the leads that arrived after the last email', async () => {
    await addLead('Jane');
    const { mailer, sent } = fakeMailer();
    await sendDailyReport(db, mailer, { now: NOW });
    await addLead('Sam');

    expect(await sendDailyReport(db, mailer, { now: later(60 * 24) })).toEqual({ status: 'sent', count: 1 });
    expect(sent[1].text).toContain('1 new lead since the last email.');
    expect(sent[1].text).toContain('Sam Doe');
    expect(sent[1].text).not.toContain('Jane Doe');
  });

  it('gives the leads back when the email fails, so the next run sends them', async () => {
    await addLead('Jane');
    const { mailer, sent } = fakeMailer(['retry']);

    expect(await sendDailyReport(db, mailer, { now: NOW })).toEqual({ status: 'retry', count: 1 });
    expect((await db.query('SELECT daily_report_at FROM leads'))[0].daily_report_at).toBeNull();

    expect(await sendDailyReport(db, mailer, { now: later(60 * 24) })).toEqual({ status: 'sent', count: 1 });
    expect(sent).toHaveLength(2);
  });

  it('does nothing while email is off', async () => {
    await addLead('Jane');
    expect(await sendDailyReport(db, null, { now: NOW })).toEqual({ status: 'email-off', count: 0 });
    expect((await db.query('SELECT daily_report_at FROM leads'))[0].daily_report_at).toBeNull();
  });
});

describe('isCronRequest', () => {
  const SECRET = 'a-long-random-cron-secret';

  it.each([
    ['the right secret', `Bearer ${SECRET}`, SECRET, true],
    ['a wrong secret', 'Bearer something-else-entirely', SECRET, false],
    ['no header', null, SECRET, false],
    ['no CRON_SECRET set', `Bearer ${SECRET}`, undefined, false],
    ['a CRON_SECRET under 16 characters', 'Bearer short', 'short', false],
  ])('%s', (_name, header, secret, allowed) => {
    expect(isCronRequest(header, secret)).toBe(allowed);
  });
});
