import { describe, expect, it } from 'vitest';
import { CONTACT_URL } from '@/config/valuation-config';
import { teamEmail, visitorEmail } from '@/lib/lead-emails';
import type { LeadRecord } from '@/lib/leads-repository';

const TEAM = 'leads@aspen.example';

// Healthcare, $4M ARR: the first worked example in the spec.
function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    submittedAt: '2026-11-04T15:30:00.000Z',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@northwind.io',
    phone: '(647) 451-5164',
    company: 'Northwind Health',
    nextMove: 'Selling the business',
    arr: 4_000_000,
    category: 'Industry-specific',
    industry: 'Healthcare',
    lowMultiple: 1.95,
    midMultiple: 2.29,
    highMultiple: 2.63,
    lowValue: 7_783_875,
    midValue: 9_157_500,
    highValue: 10_531_125,
    source: 'saas-north-2026-booth',
    ...overrides,
  };
}

describe('visitor email', () => {
  it('sends the result to the visitor, with replies going to the team inbox', () => {
    const email = visitorEmail(lead(), TEAM);
    expect(email.to).toBe('jane@northwind.io');
    expect(email.replyTo).toBe(TEAM);
    expect(email.subject).toBe('Your indicative SaaS value range: $7.8M to $10.5M');
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Hi Jane,');
      expect(part).toContain('$7.8M to $10.5M');
      expect(part).toContain('at 1.95x to 2.63x ARR');
      expect(part).toContain('$4,000,000');
      expect(part).toContain('Healthcare');
      expect(part).toContain('$9.2M (2.29x ARR)');
      expect(part).toContain(CONTACT_URL);
      expect(part).toContain('Indicative only, not a formal valuation.');
      expect(part).not.toContain('Industry-specific');
    }
  });

  it('shows the software category when no industry was picked', () => {
    const email = visitorEmail(lead({ category: 'Sales & Marketing', industry: null }), TEAM);
    expect(email.text).toContain('Software category or industry: Sales & Marketing');
    expect(email.html).toContain('Sales &#38; Marketing');
  });

  it.each(['José', "O'Brien", 'Mary-Jane', 'Nguyễn Văn'])('greets %s by name', (firstName) => {
    expect(visitorEmail(lead({ firstName }), TEAM).text.startsWith(`Hi ${firstName},`)).toBe(true);
  });

  it.each(['Visit evil.example', 'http://x.co', '<b>Jane</b>', 'a'.repeat(41), 'Win $500'])(
    'does not repeat a first name that is not a name: %s',
    (firstName) => {
      const email = visitorEmail(lead({ firstName }), TEAM);
      expect(email.text.startsWith('Hello,')).toBe(true);
      expect(email.text).not.toContain(firstName);
      expect(email.html).not.toContain(firstName);
    },
  );
});

describe('team email', () => {
  it('sends every lead detail to the team inbox, with replies going to the visitor', () => {
    const email = teamEmail(lead(), TEAM);
    expect(email.to).toBe(TEAM);
    expect(email.replyTo).toBe('jane@northwind.io');
    expect(email.subject).toBe('New lead: Jane Doe, Northwind Health ($9.2M midpoint)');
    expect(email.text).toContain('Name: Jane Doe');
    expect(email.text).toContain('Phone: (647) 451-5164');
    expect(email.text).toContain('Next move: Selling the business');
    expect(email.text).toContain('Lower: $7.8M (1.95x ARR)');
    expect(email.text).toContain('Source: saas-north-2026-booth');
    // 15:30 UTC on Nov 4 is 10:30 in Toronto (EST).
    expect(email.text).toMatch(/Submitted \(Toronto time\): .*2026.*10:30/);
    expect(email.html).toContain('href="mailto:jane@northwind.io"');
    expect(email.html).toContain('href="tel:+16474515164"');
  });

  it('escapes what visitors type and keeps the subject on one line', () => {
    const email = teamEmail(lead({ company: '<script>alert(1)</script> & Co', lastName: 'Doe\r\nBcc: x' }), TEAM);
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&#60;script&#62;alert(1)&#60;/script&#62; &#38; Co');
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
