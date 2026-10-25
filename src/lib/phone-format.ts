import { PHONE_DIGITS } from '@/config/valuation-config';

/** Digits only, with a leading country code 1 removed. */
export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('1') ? digits.slice(1) : digits;
}

/**
 * Formats as (xxx) xxx-xxxx while typing. Separators are only added once the
 * next digit exists, so Backspace never gets stuck on ") " or "-".
 */
export function formatPhoneInput(raw: string): string {
  const d = normalizePhoneDigits(raw).slice(0, PHONE_DIGITS);
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhoneDigits(raw).length === PHONE_DIGITS;
}
