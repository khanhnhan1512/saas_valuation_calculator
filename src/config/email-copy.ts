// Email copy: the visitor's result email and the team's new lead email.
// Aspen style: no hyphens or long dashes in body text.
// The visitor email only answers the visitor's own request; anything promotional needs Aspen marketing sign-off (CASL).
import { COPY } from './site-copy';

export const EMAIL_COPY = {
  brand: 'ASPEN VALUATIONS',

  visitorSubject: (low: string, high: string) => `Your indicative SaaS value range: ${low} to ${high}`,
  visitorGreeting: (firstName: string | null) => (firstName ? `Hi ${firstName},` : 'Hello,'),
  visitorIntro: 'Thank you for using the Aspen Valuations SaaS calculator. Here is your indicative value range.',
  ctaHeading: COPY.aspenHeading,
  ctaText: `${COPY.aspenIntroBold}${COPY.aspenIntroRest}`,
  ctaButton: 'Book a free valuation call',
  replyHint: 'Questions? Reply to this email.',
  signOff: 'The Aspen Valuations team',
  whyReceived: 'You received this email because you asked for this estimate on the Aspen Valuations SaaS calculator.',

  teamSubject: (name: string, company: string, mid: string) => `New lead: ${name}, ${company} (${mid} midpoint)`,
  teamIntro: 'A new lead was submitted on the SaaS valuation calculator. Reply to this email to answer the visitor.',

  labels: {
    submitted: 'Submitted (Toronto time)',
    name: 'Name',
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    nextMove: 'Next move',
    arr: 'ARR entered',
    selection: 'Software category or industry',
    low: 'Lower',
    mid: 'Midpoint',
    high: 'Higher',
    source: 'Source',
  },
  rangeValue: (value: string, multiple: string) => `${value} (${multiple} ARR)`,
} as const;
