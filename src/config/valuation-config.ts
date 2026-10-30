// Single source of truth for every valuation number and label.
// Quarterly update: edit CATEGORY_MULTIPLES + SEG_PERIOD from the new SEG report.
// Aspen-owned choices (private discount, size factors, tiers, spread) change only on CBV sign-off.

export const SEG_PERIOD = 'SEG 2Q26';

export const PRIVATE_DISCOUNT = 0.25;
export const SPREAD = 0.15;

/** Category key used when an industry is picked (Table 1 "Any industry (see Table 3)"). */
export const INDUSTRY_CATEGORY = 'Industry-specific';

export const CATEGORY_MULTIPLES = {
  'DevOps & IT Management': 5.3,
  'ERP & Supply Chain': 4.6,
  Security: 4.4,
  [INDUSTRY_CATEGORY]: 3.7,
  'Financial Applications': 3.4,
  'Human Capital Management': 3.2,
  'Other SaaS': 2.7,
  'Analytics & Data Management': 2.5,
  'Sales & Marketing': 2.4,
  'Communications & Collaboration': 2.0,
} as const;

/** Software categories in dropdown order (Table 1 order, industry row excluded). */
export const SOFTWARE_CATEGORIES = [
  'DevOps & IT Management',
  'ERP & Supply Chain',
  'Security',
  'Financial Applications',
  'Human Capital Management',
  'Analytics & Data Management',
  'Sales & Marketing',
  'Communications & Collaboration',
  'Other SaaS',
] as const;

/** Industries in dropdown order with their vertical tier (Table 3). */
export const INDUSTRY_TIERS = {
  Healthcare: 'premium',
  'Financial Services': 'premium',
  'Real Estate': 'standard',
  Government: 'standard',
  Retail: 'standard',
  Energy: 'standard',
  'Life Sciences': 'standard',
  Education: 'discount',
  Hospitality: 'discount',
  Manufacturing: 'discount',
  'Other industry': 'discount',
} as const;

export const TIER_ADJUSTMENT = { premium: 0.1, standard: 0, discount: -0.1 } as const;

/** Size factor by ARR; bands use "to under" (3,000,000 falls in the 0.75 band). */
export const SIZE_BANDS = [
  { below: 1_000_000, factor: 0.65 },
  { below: 3_000_000, factor: 0.7 },
  { below: 7_000_000, factor: 0.75 },
  { below: 15_000_000, factor: 0.8 },
  { below: Infinity, factor: 0.85 },
] as const;

export type Category = keyof typeof CATEGORY_MULTIPLES;
export type Industry = keyof typeof INDUSTRY_TIERS;

export const INDUSTRIES = Object.keys(INDUSTRY_TIERS) as Industry[];

/** 20 dropdown options: 11 industries first, then 9 software categories. */
export const DROPDOWN_OPTIONS: readonly string[] = [...INDUSTRIES, ...SOFTWARE_CATEGORIES];

// ARR input, slider and quick picks
export const ARR_MAX = 5_000_000_000;
export const SLIDER_MIN = 250_000;
export const SLIDER_MAX = 50_000_000;
export const SLIDER_STEPS = 1000;
export const ARR_CHIPS = [1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000] as const;

/** Range line axis padding either side of the band, as a share of (high - low). */
export const AXIS_PAD = 0.45;

export const NEXT_MOVES = [
  'Raising capital',
  'Selling the business',
  'Shareholder buyout',
  'Succession planning',
  'Tax or estate planning',
  '409A or ESOP',
  'Just exploring',
  'Other',
] as const;
export const NEXT_MOVE_OTHER = 'Other';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_DIGITS = 10;

// Lead sources, kiosk and export
export const SOURCE_BOOTH = 'saas-north-2026-booth';
export const SOURCE_WEBSITE = 'website';
export const SOURCE_PATTERN = /^[a-z0-9-]{1,64}$/;
export const EVENT_TIMEZONE = 'America/Toronto';
export const IDLE_RESET_MS = 120_000;
export const QUEUE_RETRY_MS = 30_000;
/** Per email; two emails plus the insert must finish inside the browser's 10 s request timeout. */
export const EMAIL_TIMEOUT_MS = 4_000;
export const CONTACT_URL = 'https://aspenval.com/ca/contact-us/';
export const ASPEN_HOME_URL = 'https://aspenval.com/';
export const SAAS_GUIDE_URL = 'https://aspenval.com/ca/saas-valuation/';
