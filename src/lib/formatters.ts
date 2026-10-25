import { ARR_MAX } from '@/config/valuation-config';

/**
 * Money format: $1.24B (2 decimals), $9.2M (1 decimal), $750K (no decimal).
 * The unit is picked after rounding so 999,500 shows as $1.0M, never $1000K.
 */
export function formatMoney(value: number): string {
  const v = Math.max(0, value);
  if (v >= 1e9 || Math.round(v / 1e5) / 10 >= 1000) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6 || Math.round(v / 1e3) >= 1000) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

/** Labels for round amounts (chips, slider ends): $1M, $25M, $250K. */
export function formatShortMoney(value: number): string {
  return formatMoney(value).replace(/\.0+(?=[MB])/, '');
}

/** Multiples to 2 decimals, e.g. 2.29x. */
export function formatMultiple(multiple: number): string {
  return `${multiple.toFixed(2)}x`;
}

/** Range line axis ends, 1 decimal, e.g. 1.6x. */
export function formatAxisMultiple(multiple: number): string {
  return `${multiple.toFixed(1)}x`;
}

/** Whole dollars only, capped at $5B. Cents are dropped ("4.5" is 4). Empty or zero returns null. */
export function parseArrDigits(text: string): number | null {
  const digits = text.split('.')[0].replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  // Compare as a string first so very long input cannot lose precision.
  if (digits.length > String(ARR_MAX).length) return ARR_MAX;
  return Math.min(Number(digits), ARR_MAX);
}

/** Live thousands formatting: 5000000 -> 5,000,000. */
export function formatArrInput(value: number | null): string {
  return value == null ? '' : new Intl.NumberFormat('en-US').format(value);
}
