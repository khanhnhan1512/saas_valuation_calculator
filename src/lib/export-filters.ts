import { SOURCE_PATTERN } from '@/config/valuation-config';
import type { LeadFilters } from './leads-repository';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Parses ?from=&to=&source= ; returns an error message for malformed values. */
export function parseLeadFilters(params: URLSearchParams): LeadFilters | { error: string } {
  const from = params.get('from')?.trim() || null;
  const to = params.get('to')?.trim() || null;
  const source = params.get('source')?.trim() || null;
  if (from && !validDate(from)) return { error: 'from must be YYYY-MM-DD' };
  if (to && !validDate(to)) return { error: 'to must be YYYY-MM-DD' };
  if (source && !SOURCE_PATTERN.test(source)) return { error: 'invalid source' };
  return { from, to, source };
}
