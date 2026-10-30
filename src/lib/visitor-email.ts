// The visitor's result email, in the layout Aspen approved: logo, result table, SaaS guide link,
// a compact button, office numbers and the fine print.
import { EMAIL_COPY } from '@/config/email-copy';
import { COPY } from '@/config/site-copy';
import { ASPEN_HOME_URL, CONTACT_URL, SAAS_GUIDE_URL } from '@/config/valuation-config';
import { EMAIL_LOGO_PNG_BASE64 } from './email-logo';
import { formatMoney, formatMultiple } from './formatters';
import {
  escapeHtml,
  oneLine,
  p,
  pageHtml,
  resultRows,
  rowsText,
  tableHtml,
  type EmailAttachment,
  type OutgoingEmail,
} from './lead-emails';
import type { LeadRecord } from './leads-repository';

const LOGO_CID = 'aspen-logo';
const LOGO: EmailAttachment = {
  filename: 'aspen-logo.png',
  content: Buffer.from(EMAIL_LOGO_PNG_BASE64, 'base64'),
  contentId: LOGO_CID,
};

// Anyone can type anything in the form. Greet by name only when it looks like a name, so the
// form cannot be used to put links or messages into other people's inboxes.
const SAFE_FIRST_NAME = /^[\p{L}\p{M}][\p{L}\p{M}' ’-]{0,39}$/u;

const LOGO_HEADER =
  `<p style="margin:0 0 20px"><a href="${ASPEN_HOME_URL}">` +
  `<img src="cid:${LOGO_CID}" width="153" height="52" alt="${escapeHtml(EMAIL_COPY.logoAlt)}" ` +
  'style="display:block;border:0;width:153px;height:52px"></a></p>';

/** A one-cell table: Outlook sizes it to the text, where a padded link would stretch or lose its padding. */
function buttonHtml(label: string, href: string): string {
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>' +
    '<td bgcolor="#05B4C9" style="background:#05B4C9;border-radius:8px;padding:12px 20px">' +
    `<a href="${href}" style="color:#062421;font-weight:bold;text-decoration:none">${escapeHtml(label)}</a>` +
    '</td></tr></table>'
  );
}

function officesHtml(): string {
  const rows = EMAIL_COPY.offices
    .map(({ city, phone }) => `<tr><td style="padding:0 16px 0 0">${escapeHtml(city)}:</td><td>${escapeHtml(phone)}</td></tr>`)
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${rows}</table>`;
}

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
      p(EMAIL_COPY.learnMore) +
      `<p style="margin:0 0 16px"><strong>${escapeHtml(EMAIL_COPY.guideLead)}</strong> ` +
      `<a href="${SAAS_GUIDE_URL}" style="color:#C82613">${escapeHtml(EMAIL_COPY.guideLink)}</a>.</p>` +
      buttonHtml(EMAIL_COPY.ctaButton, CONTACT_URL) +
      p(EMAIL_COPY.replyHint) +
      p(EMAIL_COPY.signOff, 'font-weight:bold') +
      officesHtml() +
      p(COPY.finePrint, `margin-top:24px;${small}`) +
      p(EMAIL_COPY.whyReceived, small),
    LOGO_HEADER,
  );

  const text = [
    greeting,
    EMAIL_COPY.visitorIntro,
    `${headline}\n${basis}`,
    rowsText(rows),
    `${EMAIL_COPY.ctaHeading}\n${EMAIL_COPY.ctaText}`,
    `${EMAIL_COPY.learnMore}\n${EMAIL_COPY.guideLead} ${SAAS_GUIDE_URL}`,
    `${EMAIL_COPY.ctaButton}: ${CONTACT_URL}`,
    `${EMAIL_COPY.replyHint}\n${EMAIL_COPY.signOff}`,
    EMAIL_COPY.offices.map(({ city, phone }) => `${city}: ${phone}`).join('\n'),
    COPY.finePrint,
    EMAIL_COPY.whyReceived,
  ].join('\n\n');

  return {
    to: lead.email,
    replyTo: teamAddress,
    subject: oneLine(EMAIL_COPY.visitorSubject(low, high)),
    html,
    text,
    attachments: [LOGO],
  };
}
