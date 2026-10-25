// Lead form rules, checked in the spec order. Shared by the browser and POST /api/leads.
import { ERRORS } from '@/config/site-copy';
import { EMAIL_PATTERN, NEXT_MOVES, NEXT_MOVE_OTHER } from '@/config/valuation-config';
import { formatPhoneInput, isValidPhone } from './phone-format';
import { resolveSelection } from './valuation';

export interface LeadFormValues {
  arr: number | null;
  selection: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  nextMove: string;
  nextMoveOther: string;
}

export const EMPTY_LEAD_FORM: LeadFormValues = {
  arr: null,
  selection: '',
  firstName: '',
  lastName: '',
  company: '',
  email: '',
  phone: '',
  nextMove: '',
  nextMoveOther: '',
};

/** Returns the first failing message, or null when the form is valid. */
export function validateLead(v: LeadFormValues): string | null {
  if (v.arr == null || !Number.isFinite(v.arr) || v.arr <= 0) return ERRORS.arr;
  if (!resolveSelection(v.selection)) return ERRORS.selection;
  const required = [v.firstName, v.lastName, v.company, v.email, v.phone];
  if (required.some((field) => field.trim() === '')) return ERRORS.required;
  if (!EMAIL_PATTERN.test(v.email.trim())) return ERRORS.email;
  if (!isValidPhone(v.phone)) return ERRORS.phone;
  if (!(NEXT_MOVES as readonly string[]).includes(v.nextMove)) return ERRORS.nextMove;
  if (v.nextMove === NEXT_MOVE_OTHER && v.nextMoveOther.trim() === '') return ERRORS.nextMove;
  return null;
}

export interface NormalizedContact {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  nextMove: string;
}

/** Storage form: trimmed, email lower-cased, phone formatted, "Other: <text>". */
export function normalizeContact(v: LeadFormValues): NormalizedContact {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    company: v.company.trim(),
    email: v.email.trim().toLowerCase(),
    phone: formatPhoneInput(v.phone),
    nextMove:
      v.nextMove === NEXT_MOVE_OTHER ? `${NEXT_MOVE_OTHER}: ${v.nextMoveOther.trim()}` : v.nextMove,
  };
}
