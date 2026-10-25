// Runs against a real Postgres (PGlite in memory): inserts, conflicts and casts are the real thing.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applySchema, connectPglite, type Db } from '@/lib/db';
import { processLead } from '@/lib/lead-intake';
import { countLeads, listLeadsForExport } from '@/lib/leads-repository';

let db: Db;
const getDb = async () => db;

beforeAll(async () => {
  db = await connectPglite('memory://');
  await applySchema(db);
});

beforeEach(async () => {
  await db.query('TRUNCATE leads');
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    submittedAt: '2026-11-04T15:30:00.000Z',
    arr: 4_000_000,
    selection: 'Healthcare',
    firstName: '  Jane ',
    lastName: 'Doe',
    company: 'Northwind Health',
    email: 'Jane@Northwind.IO',
    phone: '16474515164',
    nextMove: 'Selling the business',
    nextMoveOther: '',
    source: 'saas-north-2026-booth',
    websiteUrl: '',
    ...overrides,
  };
}

const send = (body: unknown) => processLead(typeof body === 'string' ? body : JSON.stringify(body), getDb);

describe('POST /api/leads logic', () => {
  it('stores a valid lead with server-calculated values and normalized contact', async () => {
    const res = await send(payload());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, duplicate: false, range: { midMultiple: 2.29, lowValue: 7_783_875 } });

    const rows = await db.query('SELECT * FROM leads');
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.first_name).toBe('Jane');
    expect(r.email).toBe('jane@northwind.io');
    expect(r.phone).toBe('(647) 451-5164');
    expect(r.category).toBe('Industry-specific');
    expect(r.industry).toBe('Healthcare');
    expect(Number(r.mid_multiple)).toBe(2.29);
    expect(Number(r.high_value)).toBe(10_531_125);
    expect(r.source).toBe('saas-north-2026-booth');
  });

  it('ignores numbers sent by the browser and recalculates', async () => {
    await send({ ...payload(), midMultiple: 99, lowValue: 1, highValue: 1 });
    const [row] = await db.query('SELECT low_value, mid_multiple FROM leads');
    expect(Number(row.low_value)).toBe(7_783_875);
    expect(Number(row.mid_multiple)).toBe(2.29);
  });

  it('stores a repeated id only once (offline retries are safe)', async () => {
    expect((await send(payload())).body.duplicate).toBe(false);
    const again = await send(payload({ firstName: 'Changed' }));
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);
    expect(await countLeads(db)).toBe(1);
    expect((await db.query('SELECT first_name FROM leads'))[0].first_name).toBe('Jane');
  });

  it('stores software categories with no industry', async () => {
    await send(payload({ selection: 'Sales & Marketing' }));
    const [row] = await db.query('SELECT category, industry, mid_value FROM leads');
    expect(row).toMatchObject({ category: 'Sales & Marketing', industry: null });
    expect(Number(row.mid_value)).toBe(5_400_000);
  });

  it('stores "Other: <text>" for the Other next move', async () => {
    await send(payload({ nextMove: 'Other', nextMoveOther: ' IPO prep ' }));
    expect((await db.query('SELECT next_move FROM leads'))[0].next_move).toBe('Other: IPO prep');
  });

  it('honeypot: answers ok but stores nothing', async () => {
    const res = await send(payload({ websiteUrl: 'http://spam.example' }));
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await countLeads(db)).toBe(0);
  });

  it.each([
    [{ arr: null }, 'Please enter your ARR in step 1.'],
    [{ selection: 'Crypto' }, 'Please choose your software category or industry in step 1.'],
    [{ company: ' ' }, 'Please fill in your first name, last name, company, email and phone number.'],
    [{ email: 'jane@northwind' }, 'Please check your email address.'],
    [{ phone: '647 451' }, 'Please enter a 10 digit phone number.'],
    [{ nextMove: 'Other', nextMoveOther: '' }, 'Please choose your next move.'],
  ])('rejects %j with the spec message', async (override, message) => {
    const res = await send(payload(override));
    expect(res).toEqual({ status: 400, body: { ok: false, error: message } });
    expect(await countLeads(db)).toBe(0);
  });

  it.each([
    ['not json', 'garbage{'],
    ['bad uuid', payload({ id: '123' })],
    ['bad date', payload({ submittedAt: 'yesterday' })],
    ['ARR over cap', payload({ arr: 5_000_000_001 })],
    ['fractional ARR', payload({ arr: 1.5 })],
    ['missing field', { ...payload(), email: undefined }],
  ])('rejects malformed request: %s', async (_name, body) => {
    expect((await send(body)).status).toBe(400);
  });

  it('rejects oversized bodies', async () => {
    expect((await send(payload({ company: 'x'.repeat(5000) }))).status).toBe(413);
  });

  it('falls back to "website" for an invalid source tag', async () => {
    await send(payload({ source: 'DROP TABLE' }));
    expect((await db.query('SELECT source FROM leads'))[0].source).toBe('website');
  });
});

describe('export queries', () => {
  async function seed(id: string, submittedAt: string, source: string) {
    await send(payload({ id, submittedAt, source }));
  }

  it('lists oldest first and filters by Toronto dates and source', async () => {
    await seed('00000000-0000-4000-8000-000000000002', '2026-11-05T14:00:00Z', 'website');
    await seed('00000000-0000-4000-8000-000000000001', '2026-11-04T15:30:00Z', 'saas-north-2026-booth');
    // 2026-11-06 03:30 UTC is still Nov 5 in Toronto (UTC-5).
    await seed('00000000-0000-4000-8000-000000000003', '2026-11-06T03:30:00Z', 'saas-north-2026-booth');

    const all = await listLeadsForExport(db);
    expect(all.map((r) => r.submittedAt.toISOString())).toEqual([
      '2026-11-04T15:30:00.000Z',
      '2026-11-05T14:00:00.000Z',
      '2026-11-06T03:30:00.000Z',
    ]);
    expect(typeof all[0].arr).toBe('number');
    expect(await countLeads(db, { from: '2026-11-05', to: '2026-11-05' })).toBe(2);
    expect(await countLeads(db, { source: 'saas-north-2026-booth' })).toBe(2);
    expect(await countLeads(db, { to: '2026-11-04' })).toBe(1);
  });
});
