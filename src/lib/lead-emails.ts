// Builds the emails: per lead, the visitor's result and the lead details for the team inbox;
// once a day, the summary that carries the Excel file.
import { DAILY_EMAIL_LIST_MAX, EMAIL_COPY } from '@/config/email-copy';
import { COPY } from '@/config/site-copy';
import { CONTACT_URL, EVENT_TIMEZONE } from '@/config/valuation-config';
import { formatArrInput, formatMoney, formatMultiple } from './formatters';
import type { ExportRow, LeadRecord } from './leads-repository';

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
}

export interface OutgoingEmail {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

type Row = { label: string; value: string; href?: string };

// Anyone can type anything in the form. Greet by name only when it looks like a name, so the
// form cannot be used to put links or messages into other people's inboxes.
const SAFE_FIRST_NAME = /^[\p{L}\p{M}][\p{L}\p{M}' ’-]{0,39}$/u;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Subjects: one line, no control characters, bounded length. */
const oneLine = (s: string) => s.replace(/\p{Cc}+/gu, ' ').trim().slice(0, 160);

const submittedFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: EVENT_TIMEZONE, dateStyle: 'medium' });

function resultRows(lead: LeadRecord): Row[] {
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

const p = (text: string, style = '') => `<p style="margin:0 0 12px;${style}">${escapeHtml(text)}</p>`;

function tableHtml(rows: Row[]): string {
  const cell = 'padding:8px 0;border-bottom:1px solid #E1EAE8;vertical-align:top;';
  const body = rows
    .map(({ label, value, href }) => {
      const shown = href ? `<a href="${escapeHtml(href)}" style="color:#0B7C8A">${escapeHtml(value)}</a>` : escapeHtml(value);
      return `<tr><td style="${cell}padding-right:16px;color:#5B706C;white-space:nowrap">${escapeHtml(label)}</td><td style="${cell}font-weight:bold">${shown}</td></tr>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 20px">${body}</table>`;
}

function pageHtml(body: string): string {
  return (
    '<!doctype html><html><body style="margin:0;padding:24px 12px;background:#F3F7F6;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;padding:24px;background:#FFFFFF;border-top:4px solid #05B4C9;border-radius:8px;color:#12302C;font-size:15px;line-height:1.5">' +
    `<p style="margin:0 0 20px;color:#1A322F;font-size:12px;font-weight:bold;letter-spacing:0.2em">${EMAIL_COPY.brand}</p>` +
    `${body}</div></body></html>`
  );
}

const rowsText = (rows: Row[]) => rows.map((r) => `${r.label}: ${r.value}`).join('\n');

export function visitorEmail(lead: LeadRecord, teamAddress: string): OutgoingEmail {
  const low = formatMoney(lead.lowValue);
  const high = formatMoney(lead.highValue);
  const headline = `${low} ${COPY.rangeJoiner} ${high}`;
  const basis = COPY.basisLine(formatMultiple(lead.lowMultiple), formatMultiple(lead.highMultiple));
  const greeting = EMAIL_COPY.visitorGreeting(SAFE_FIRST_NAME.test(lead.firstName) ? lead.firstName : null);
  const rows = resultRows(lead);
  const small = 'color:#5B706C;font-size:12px;';

  const html = pageHtml(
    p(greeting) +
      p(EMAIL_COPY.visitorIntro) +
      p(headline, 'margin:20px 0 4px;font-size:28px;font-weight:bold') +
      p(basis, 'color:#5B706C') +
      tableHtml(rows) +
      p(EMAIL_COPY.ctaHeading, 'font-size:17px;font-weight:bold') +
      p(EMAIL_COPY.ctaText) +
      `<p style="margin:0 0 20px"><a href="${CONTACT_URL}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#05B4C9;color:#062421;font-weight:bold;text-decoration:none">${escapeHtml(EMAIL_COPY.ctaButton)}</a></p>` +
      p(EMAIL_COPY.replyHint) +
      p(EMAIL_COPY.signOff) +
      p(COPY.finePrint, `margin-top:24px;${small}`) +
      p(EMAIL_COPY.whyReceived, small),
  );

  const text = [
    greeting,
    EMAIL_COPY.visitorIntro,
    `${headline}\n${basis}`,
    rowsText(rows),
    `${EMAIL_COPY.ctaHeading}\n${EMAIL_COPY.ctaText}\n${EMAIL_COPY.ctaButton}: ${CONTACT_URL}`,
    `${EMAIL_COPY.replyHint}\n${EMAIL_COPY.signOff}`,
    COPY.finePrint,
    EMAIL_COPY.whyReceived,
  ].join('\n\n');

  return { to: lead.email, replyTo: teamAddress, subject: oneLine(EMAIL_COPY.visitorSubject(low, high)), html, text };
}

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
