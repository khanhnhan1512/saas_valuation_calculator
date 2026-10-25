// All visible copy, verbatim from the spec "Content and copy" section.
// Aspen style: no hyphens or long dashes in body text.
import { PRIVATE_DISCOUNT, SEG_PERIOD, SPREAD } from './valuation-config';

const pct = (share: number) => `${Math.round(share * 100)}%`;

export const COPY = {
  brand: 'Aspen Valuations',
  titleBefore: 'What is your ',
  titleHighlight: 'SaaS company',
  titleAfter: ' worth?',
  subtitle: 'Estimate your company’s value using current SaaS market multiples.',
  badge: 'SAAS VALUATION EXPERTS',
  fullscreenEnter: 'Enter full screen',
  fullscreenExit: 'Exit full screen',

  step1Heading: 'Your annual recurring revenue (ARR)',
  arrLabel: 'Annual recurring revenue in dollars',
  arrPlaceholder: '5,000,000',
  sliderLabel: 'ARR slider',
  dropdownLabel: 'Software category or industry',
  dropdownPlaceholder: 'Choose a category',

  step2Heading: 'Tell us about your company',
  step2Hint: 'to generate your ARR multiple',
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  email: 'Email',
  phone: 'Phone number',
  phonePlaceholder: '(555) 555-5555',
  nextMoveLabel: 'What is your next move?',
  nextMoveOtherLabel: 'Your next move',
  nextMoveOtherPlaceholder: 'Tell us briefly',
  button: 'Generate my ARR multiple',
  buttonDone: 'Multiple generated',

  lockedTitle: 'Your value range is ready to generate',
  lockedHint: 'Complete steps 1 and 2 to see it',
  resultKicker: 'YOUR INDICATIVE VALUE RANGE',
  rangeJoiner: 'to',
  basisLine: (low: string, high: string) =>
    `based on your category, size and industry, at ${low} to ${high} ARR`,
  markerLow: 'lower',
  markerMid: 'midpoint',
  markerHigh: 'higher',
  liveResult: (low: string, high: string, lowM: string, highM: string) =>
    `Your indicative value range is ${low} to ${high}, at ${lowM} to ${highM} ARR.`,
  tilesHeading: 'TURN THIS RANGE INTO A NUMBER YOU CAN DEFEND WITH ASPEN',
  tiles: [
    { big: 'CBV', small: 'Chartered Business Valuators on every engagement' },
    { big: '2 weeks', small: 'from engagement to final report' },
    { big: 'SaaS', small: 'specialists who know the metrics that drive value' },
    { big: 'Free', small: 'one pager for buyers and investors with every report' },
  ],
  resetButton: 'Next visitor',

  aspenHeading: 'Want a number you can defend?',
  aspenIntroBold: 'Aspen Valuations',
  aspenIntroRest:
    ' is a Canadian firm of Chartered Business Valuators specializing in SaaS and technology companies.',
  aspenBullets: [
    'Independent reports built to hold up with investors, acquirers and tax authorities',
    'We know the SaaS metrics that drive value, so no time is spent explaining your business',
    'Most engagements completed in 1 to 2 weeks',
  ],
  qrCaption: 'Scan to book a free valuation call',
  qrAlt: 'QR code linking to the Aspen Valuations contact page',

  finePrint:
    `Indicative only, not a formal valuation. Category multiples are ${SEG_PERIOD} public SaaS medians, ` +
    `adjusted for a ${pct(PRIVATE_DISCOUNT)} private company discount, a size discount based on ARR, ` +
    `and an industry adjustment for vertical SaaS, with a range of ${pct(SPREAD)} either side of the ` +
    'midpoint. Actual value depends on growth, ' +
    'retention, margins, customer concentration and more. Aspen Valuations Inc. · Chartered Business Valuators',
  staffLabel: 'Staff:',
  exportLink: 'Export leads to Excel',
  savedCount: (n: number) => `(${n} saved)`,
  queuedCount: (n: number) => `${n} queued`,
  failedCount: (n: number) => `${n} failed, call support`,
} as const;

/** Validation messages, in the order they are checked. */
export const ERRORS = {
  arr: 'Please enter your ARR in step 1.',
  selection: 'Please choose your software category or industry in step 1.',
  required: 'Please fill in your first name, last name, company, email and phone number.',
  email: 'Please check your email address.',
  phone: 'Please enter a 10 digit phone number.',
  nextMove: 'Please choose your next move.',
} as const;
