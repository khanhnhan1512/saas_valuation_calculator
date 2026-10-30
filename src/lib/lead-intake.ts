// POST /api/leads logic: validate, recalculate on the server, store once, then email the result.
import { z } from 'zod';
import { ARR_MAX, SOURCE_PATTERN, SOURCE_WEBSITE } from '@/config/valuation-config';
import type { Db } from './db';
import { teamEmail } from './lead-emails';
import { normalizeContact, validateLead } from './lead-validation';
import { getEmailStatus, insertLead, setEmailStatus, type LeadRecord } from './leads-repository';
import type { Mailer } from './mailer';
import { estimate, resolveSelection } from './valuation';
import { visitorEmail } from './visitor-email';

export const MAX_BODY_BYTES = 4096;

const LeadPayloadSchema = z.object({
  id: z.uuid(),
  submittedAt: z.iso.datetime({ offset: true }),
  arr: z.number().int().positive().max(ARR_MAX).nullable(),
  selection: z.string().max(80),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  company: z.string().max(200),
  email: z.string().max(254),
  phone: z.string().max(30),
  nextMove: z.string().max(60),
  nextMoveOther: z.string().max(100).default(''),
  source: z.string().max(64).catch(SOURCE_WEBSITE),
  websiteUrl: z.string().max(500).optional(),
});

export interface IntakeResult {
  status: number;
  body: Record<string, unknown>;
}

const bad = (error: string): IntakeResult => ({ status: 400, body: { ok: false, error } });

// Team first: the company inbox matters most if only one email can go out.
const LEAD_EMAILS = [
  { kind: 'team', build: teamEmail },
  { kind: 'visitor', build: visitorEmail },
] as const;

/**
 * Sends the emails still missing for this lead. Returns false when one must be retried later.
 * Each email goes out at most once: its status is stored, and Resend drops a repeated idempotency key.
 */
async function deliverLeadEmails(db: Db, lead: LeadRecord, mailer: Mailer | null): Promise<boolean> {
  if (!mailer) return true; // Email is off (local development, tests).
  const status = await getEmailStatus(db, lead.id);
  for (const { kind, build } of LEAD_EMAILS) {
    if (status[kind]) continue;
    const outcome = await mailer.send(build(lead, mailer.teamAddress), `lead-${lead.id}-${kind}`);
    if (outcome === 'retry') return false;
    await setEmailStatus(db, lead.id, kind, outcome === 'sent' ? 'sent' : 'failed');
  }
  return true;
}

export async function processLead(
  rawBody: string,
  getDb: () => Promise<Db>,
  mailer: Mailer | null = null,
): Promise<IntakeResult> {
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return { status: 413, body: { ok: false, error: 'Request too large' } };
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return bad('Invalid request');
  }
  const parsed = LeadPayloadSchema.safeParse(json);
  if (!parsed.success) return bad('Invalid request');
  const p = parsed.data;

  // Honeypot: bots fill the hidden field. Answer like a success so they move on; store nothing.
  if (p.websiteUrl && p.websiteUrl.trim() !== '') return { status: 200, body: { ok: true } };

  const message = validateLead(p);
  if (message) return bad(message);

  // Never trust numbers from the browser: recalculate from ARR and the selection.
  const selection = resolveSelection(p.selection)!;
  const range = estimate(p.arr!, selection.category, selection.industry);
  const contact = normalizeContact(p);
  const lead: LeadRecord = {
    id: p.id,
    submittedAt: new Date(p.submittedAt).toISOString(),
    ...contact,
    arr: p.arr!,
    category: selection.category,
    industry: selection.industry,
    lowMultiple: range.lowMultiple,
    midMultiple: range.midMultiple,
    highMultiple: range.highMultiple,
    lowValue: range.lowValue,
    midValue: range.midValue,
    highValue: range.highValue,
    source: SOURCE_PATTERN.test(p.source) ? p.source : SOURCE_WEBSITE,
  };
  const db = await getDb();
  const inserted = await insertLead(db, lead);

  // The lead is stored before any email, so it is safe even if email fails. A 503 keeps it queued
  // in the browser; the retry finds the stored id and sends only the emails still missing.
  if (!(await deliverLeadEmails(db, lead, mailer))) {
    return { status: 503, body: { ok: false, error: 'Please try again' } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      duplicate: !inserted,
      range: {
        lowMultiple: range.lowMultiple,
        midMultiple: range.midMultiple,
        highMultiple: range.highMultiple,
        lowValue: range.lowValue,
        midValue: range.midValue,
        highValue: range.highValue,
      },
    },
  };
}
