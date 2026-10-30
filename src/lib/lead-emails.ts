// Email building blocks, plus the team emails: per lead, the lead details for the team inbox;
// once a day, the summary that carries the Excel file. The visitor's email is in visitor-email.ts.
import { DAILY_EMAIL_LIST_MAX, EMAIL_COPY } from '@/config/email-copy';
import { EVENT_TIMEZONE } from '@/config/valuation-config';
import { formatArrInput, formatMoney, formatMultiple } from './formatters';
import type { ExportRow, LeadRecord } from './leads-repository';

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  /** Set for an inline image, referenced in the HTML as src="cid:<contentId>". */
  contentId?: string;
}

export interface OutgoingEmail {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export type Row = { label: string; value: string; href?: string };

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Subjects: one line, no control characters, bounded length. */
export const oneLine = (s: string) => s.replace(/\p{Cc}+/gu, ' ').trim().slice(0, 160);

const submittedFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: EVENT_TIMEZONE, dateStyle: 'medium' });

export function resultRows(lead: LeadRecord): Row[] {
  const { labels, rangeValue } = EMAIL_COPY;
  return [
    { label: labels.arr, value: `$${formatArrInput(lead.arr)}` },
    // The dropdown label the visitor picked, never the internal "Industry-specific" key.
    { label: labels.selection, value: lead.industry ?? lead.category },
    { label: labels.low, value: rangeValue(formatMoney(lead.lowValue), formatMultiple(lead.lowMultiple)) },
    { label: labels.mid, value: rangeValue(formatMoney(lead.midValue), formatMultiple(lead.midMultiple)) },
    { label: labels.high, value: rangeValue(formatMoney(lead.highValue), formatMultiple(lead.highMultiple)) },
  ];
}

export const p = (text: string, style = '') => `<p style="margin:0 0 12px;${style}">${escapeHtml(text)}</p>`;

export function tableHtml(rows: Row[]): string {
  const cell = 'padding:8px 0;border-bottom:1px solid #E1EAE8;vertical-align:top;';
  const body = rows
    .map(({ label, value, href }) => {
      const shown = href ? `<a href="${escapeHtml(href)}" style="color:#0B7C8A">${escapeHtml(value)}</a>` : escapeHtml(value);
      return `<tr><td style="${cell}padding-right:16px;color:#5B706C;white-space:nowrap">${escapeHtml(label)}</td><td style="${cell}font-weight:bold">${shown}</td></tr>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 20px">${body}</table>`;
}

const BRAND_TEXT = `<p style="margin:0 0 20px;color:#1A322F;font-size:12px;font-weight:bold;letter-spacing:0.2em">${EMAIL_COPY.brand}</p>`;

/** The white card every email sits in; `header` replaces the text brand line (e.g. with the logo). */
export function pageHtml(body: string, header = BRAND_TEXT): string {
  return (
    '<!doctype html><html><body style="margin:0;padding:24px 12px;background:#F3F7F6;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;padding:24px;background:#FFFFFF;border-top:4px solid #05B4C9;border-radius:8px;color:#12302C;font-size:15px;line-height:1.5">' +
    `${header}${body}</div></body></html>`
  );
}

export const rowsText = (rows: Row[]) => rows.map((r) => `${r.label}: ${r.value}`).join('\n');

export function teamEmail(lead: LeadRecord, teamAddress: string): OutgoingEmail {
  const { labels } = EMAIL_COPY;
  const name = `${lead.firstName} ${lead.lastName}`;
  const rows: Row[] = [
    { label: labels.submitted, value: submittedFormat.format(new Date(lead.submittedAt)) },
    { label: labels.name, value: name },
    { label: labels.company, value: lead.company },
    { label: labels.email, value: lead.email, href: `mailto:${lead.email}` },
    { label: labels.phone, value: lead.phone, href: `tel:+1${lead.phone.replace(/\D/g, '')}` },
    { label: labels.nextMove, value: lead.nextMove },
    ...resultRows(lead),
    { label: labels.source, value: lead.source },
  ];

  return {
    to: teamAddress,
    // Staff answer the visitor by replying to this email.
    replyTo: lead.email,
    subject: oneLine(EMAIL_COPY.teamSubject(name, lead.company, formatMoney(lead.midValue))),
    html: pageHtml(p(EMAIL_COPY.teamIntro) + tableHtml(rows)),
    text: `${EMAIL_COPY.teamIntro}\n\n${rowsText(rows)}`,
  };
}

/** The daily summary to the team inbox; the caller attaches the Excel file. */
export function dailyLeadsEmail(leads: ExportRow[], teamAddress: string, staffUrl: string | null, now: Date): OutgoingEmail {
  const shown = leads.slice(0, DAILY_EMAIL_LIST_MAX);
  const rows: Row[] = shown.map((l) => ({
    label: `${l.firstName} ${l.lastName}`,
    value: `${l.company}, ${formatMoney(l.midValue)} midpoint`,
  }));
  const more = leads.length - shown.length;
  const outro = [more > 0 ? EMAIL_COPY.dailyMore(more) : '', staffUrl ? `${EMAIL_COPY.dailyStaffHint} ${staffUrl}` : '']
    .filter(Boolean);

  return {
    to: teamAddress,
    replyTo: teamAddress,
    subject: oneLine(EMAIL_COPY.dailySubject(leads.length, dayFormat.format(now))),
    html: pageHtml(p(EMAIL_COPY.dailyIntro(leads.length)) + tableHtml(rows) + outro.map((line) => p(line)).join('')),
    text: [EMAIL_COPY.dailyIntro(leads.length), rowsText(rows), ...outro].join('\n\n'),
  };
}
