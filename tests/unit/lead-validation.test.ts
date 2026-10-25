import { describe, expect, it } from 'vitest';
import { formatPhoneInput, isValidPhone, normalizePhoneDigits } from '@/lib/phone-format';
import { normalizeContact, validateLead, type LeadFormValues } from '@/lib/lead-validation';

const VALID: LeadFormValues = {
  arr: 4_000_000,
  selection: 'Healthcare',
  firstName: 'Jane',
  lastName: 'Doe',
  company: 'Northwind Health',
  email: 'jane@northwind.io',
  phone: '(647) 451-5164',
  nextMove: 'Selling the business',
  nextMoveOther: '',
};

describe('phone formatting', () => {
  it.each([
    ['6474515164', '(647) 451-5164'],
    ['16474515164', '(647) 451-5164'],
    ['+1 (647) 451-5164', '(647) 451-5164'],
    ['647', '(647'],
    ['6474', '(647) 4'],
    ['647451', '(647) 451'],
    ['6474515', '(647) 451-5'],
    ['1', ''],
    ['', ''],
    ['64745151649999', '(647) 451-5164'],
  ])('%j -> %j', (raw, formatted) => expect(formatPhoneInput(raw)).toBe(formatted));

  it('requires exactly 10 digits after stripping a leading 1', () => {
    expect(isValidPhone('(647) 451-5164')).toBe(true);
    expect(isValidPhone('1 647 451 5164')).toBe(true);
    expect(isValidPhone('647 451 516')).toBe(false);
    expect(isValidPhone('2647 451 5164')).toBe(false);
    expect(normalizePhoneDigits('1-800-555-0199')).toBe('8005550199');
  });
});

describe('validateLead order', () => {
  it('accepts a complete form', () => expect(validateLead(VALID)).toBeNull());

  it('reports each message in spec order as fields break from last to first', () => {
    const broken: LeadFormValues = { ...VALID, nextMove: '' };
    expect(validateLead(broken)).toBe('Please choose your next move.');
    broken.phone = '(647) 451';
    expect(validateLead(broken)).toBe('Please enter a 10 digit phone number.');
    broken.email = 'jane@northwind';
    expect(validateLead(broken)).toBe('Please check your email address.');
    broken.company = '   ';
    expect(validateLead(broken)).toBe(
      'Please fill in your first name, last name, company, email and phone number.',
    );
    broken.selection = '';
    expect(validateLead(broken)).toBe('Please choose your software category or industry in step 1.');
    broken.arr = null;
    expect(validateLead(broken)).toBe('Please enter your ARR in step 1.');
  });

  it.each(['firstName', 'lastName', 'company', 'email', 'phone'] as const)(
    'blank %s gives the required message',
    (field) => {
      expect(validateLead({ ...VALID, [field]: ' ' })).toBe(
        'Please fill in your first name, last name, company, email and phone number.',
      );
    },
  );

  it.each(['a@b', 'a b@c.io', '@c.io', 'jane@', 'jane.northwind.io'])('rejects email %j', (email) => {
    expect(validateLead({ ...VALID, email })).toBe('Please check your email address.');
  });

  it('"Other" needs its text box filled', () => {
    expect(validateLead({ ...VALID, nextMove: 'Other', nextMoveOther: '  ' })).toBe(
      'Please choose your next move.',
    );
    expect(validateLead({ ...VALID, nextMove: 'Other', nextMoveOther: 'IPO' })).toBeNull();
  });

  it('rejects unknown next move and zero ARR', () => {
    expect(validateLead({ ...VALID, nextMove: 'Buy a boat' })).toBe('Please choose your next move.');
    expect(validateLead({ ...VALID, arr: 0 })).toBe('Please enter your ARR in step 1.');
  });
});

describe('normalizeContact', () => {
  it('trims, lower-cases email, formats phone and prefixes Other', () => {
    const n = normalizeContact({
      ...VALID,
      firstName: '  Jane ',
      email: ' Jane@NorthWind.IO ',
      phone: '16474515164',
      nextMove: 'Other',
      nextMoveOther: '  IPO prep ',
    });
    expect(n).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      company: 'Northwind Health',
      email: 'jane@northwind.io',
      phone: '(647) 451-5164',
      nextMove: 'Other: IPO prep',
    });
  });
});
