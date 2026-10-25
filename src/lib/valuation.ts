// Valuation math, shared by the browser (instant result) and the server (stored values).
// Mirrors the spec reference implementation exactly.
import {
  AXIS_PAD,
  CATEGORY_MULTIPLES,
  INDUSTRY_CATEGORY,
  INDUSTRY_TIERS,
  PRIVATE_DISCOUNT,
  SIZE_BANDS,
  SOFTWARE_CATEGORIES,
  SPREAD,
  TIER_ADJUSTMENT,
  type Category,
  type Industry,
} from '@/config/valuation-config';

export interface Estimate {
  lowMultiple: number;
  midMultiple: number;
  highMultiple: number;
  lowValue: number;
  midValue: number;
  highValue: number;
  /** Unrounded multiples, used to draw the range line. */
  rawLow: number;
  rawMid: number;
  rawHigh: number;
}

export interface Selection {
  category: Category;
  industry: Industry | null;
}

export function sizeFactor(arr: number): number {
  return SIZE_BANDS.find((band) => arr < band.below)!.factor;
}

function isIndustry(label: string): label is Industry {
  return Object.prototype.hasOwnProperty.call(INDUSTRY_TIERS, label);
}

function isSoftwareCategory(label: string): label is (typeof SOFTWARE_CATEGORIES)[number] {
  return (SOFTWARE_CATEGORIES as readonly string[]).includes(label);
}

/** Maps a dropdown label to the stored category/industry pair, or null if unknown. */
export function resolveSelection(label: string): Selection | null {
  if (isIndustry(label)) return { category: INDUSTRY_CATEGORY, industry: label };
  if (isSoftwareCategory(label)) return { category: label, industry: null };
  return null;
}

export function estimate(arr: number, category: Category, industry: Industry | null): Estimate {
  const adjustment =
    category === INDUSTRY_CATEGORY && industry ? TIER_ADJUSTMENT[INDUSTRY_TIERS[industry]] : 0;
  const mid =
    CATEGORY_MULTIPLES[category] * (1 - PRIVATE_DISCOUNT) * sizeFactor(arr) * (1 + adjustment);
  const lo = mid * (1 - SPREAD);
  const hi = mid * (1 + SPREAD);
  return {
    lowMultiple: +lo.toFixed(2),
    midMultiple: +mid.toFixed(2),
    highMultiple: +hi.toFixed(2),
    lowValue: Math.round(lo * arr),
    midValue: Math.round(mid * arr),
    highValue: Math.round(hi * arr),
    rawLow: lo,
    rawMid: mid,
    rawHigh: hi,
  };
}

export interface RangeAxis {
  min: number;
  max: number;
  lowPct: number;
  midPct: number;
  highPct: number;
}

/** Axis zoomed to the range: min = max(0, low - pad), max = high + pad, pad = 0.45 x (high - low). */
export function rangeAxis(low: number, mid: number, high: number): RangeAxis {
  const pad = AXIS_PAD * (high - low);
  const min = Math.max(0, low - pad);
  const max = high + pad;
  const pct = (m: number) => ((m - min) / (max - min)) * 100;
  return { min, max, lowPct: pct(low), midPct: pct(mid), highPct: pct(high) };
}
