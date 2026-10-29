import { EVENT_TIMEZONE } from '@/config/valuation-config';
import type { Db } from './db';

export interface LeadRecord {
  id: string;
  submittedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  nextMove: string;
  arr: number;
  category: string;
  industry: string | null;
  lowMultiple: number;
  midMultiple: number;
  highMultiple: number;
  lowValue: number;
  midValue: number;
  highValue: number;
  source: string;
}

/** Inserts once per id. Returns false when the id was already stored (a retried submit). */
export async function insertLead(db: Db, lead: LeadRecord): Promise<boolean> {
  const rows = await db.query(
    `INSERT INTO leads (id, submitted_at, first_name, last_name, email, phone, company, next_move,
       arr, category, industry, low_multiple, mid_multiple, high_multiple, low_value, mid_value, high_value, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      lead.id, lead.submittedAt, lead.firstName, lead.lastName, lead.email, lead.phone, lead.company,
      lead.nextMove, lead.arr, lead.category, lead.industry, lead.lowMultiple, lead.midMultiple,
      lead.highMultiple, lead.lowValue, lead.midValue, lead.highValue, lead.source,
    ],
  );
  return rows.length === 1;
}

export type EmailKind = 'team' | 'visitor';
export type EmailStatus = 'sent' | 'failed';

// Fixed column names, never built from input.
const EMAIL_STATUS_COLUMN: Record<EmailKind, string> = {
  team: 'team_email_status',
  visitor: 'visitor_email_status',
};

/** Delivery status of each email for a lead; null means not sent yet. */
export async function getEmailStatus(db: Db, id: string): Promise<Record<EmailKind, string | null>> {
  const [row] = await db.query('SELECT team_email_status, visitor_email_status FROM leads WHERE id = $1', [id]);
  return {
    team: (row?.team_email_status as string | null | undefined) ?? null,
    visitor: (row?.visitor_email_status as string | null | undefined) ?? null,
  };
}

export async function setEmailStatus(db: Db, id: string, kind: EmailKind, status: EmailStatus): Promise<void> {
  await db.query(`UPDATE leads SET ${EMAIL_STATUS_COLUMN[kind]} = $2 WHERE id = $1`, [id, status]);
}

export interface LeadFilters {
  /** Inclusive dates (YYYY-MM-DD) in the event time zone. */
  from?: string | null;
  to?: string | null;
  source?: string | null;
}

export interface ExportRow {
  submittedAt: Date;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  nextMove: string;
  arr: number;
  category: string;
  industry: string | null;
  midMultiple: number;
  lowValue: number;
  midValue: number;
  highValue: number;
}

const FILTER_SQL = `
  ($1::date IS NULL OR submitted_at >= ($1::date)::timestamp AT TIME ZONE '${EVENT_TIMEZONE}')
  AND ($2::date IS NULL OR submitted_at < ($2::date + 1)::timestamp AT TIME ZONE '${EVENT_TIMEZONE}')
  AND ($3::text IS NULL OR source = $3)`;

const filterParams = (f: LeadFilters) => [f.from ?? null, f.to ?? null, f.source ?? null];

/** Every matching lead, oldest first. Read only: exporting never deletes data. */
export async function listLeadsForExport(db: Db, filters: LeadFilters = {}): Promise<ExportRow[]> {
  const rows = await db.query(
    `SELECT submitted_at, first_name, last_name, email, phone, company, next_move, arr, category,
            industry, mid_multiple, low_value, mid_value, high_value
     FROM leads WHERE ${FILTER_SQL}
     ORDER BY submitted_at ASC, received_at ASC`,
    filterParams(filters),
  );
  // Postgres drivers return bigint/numeric as strings; convert once here.
  return rows.map((r) => ({
    submittedAt: new Date(r.submitted_at as string | Date),
    firstName: String(r.first_name),
    lastName: String(r.last_name),
    email: String(r.email),
    phone: String(r.phone),
    company: String(r.company),
    nextMove: String(r.next_move),
    arr: Number(r.arr),
    category: String(r.category),
    industry: r.industry == null ? null : String(r.industry),
    midMultiple: Number(r.mid_multiple),
    lowValue: Number(r.low_value),
    midValue: Number(r.mid_value),
    highValue: Number(r.high_value),
  }));
}

export async function countLeads(db: Db, filters: LeadFilters = {}): Promise<number> {
  const rows = await db.query(`SELECT count(*)::int AS count FROM leads WHERE ${FILTER_SQL}`, filterParams(filters));
  return Number(rows[0]?.count ?? 0);
}
