// Database access. Production: Neon Postgres (DATABASE_URL, set by the Vercel Marketplace).
// Local dev and tests: PGlite, a real embedded Postgres, so no setup is needed.

export type Row = Record<string, unknown>;

export interface Db {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

/** Applied once per server instance; every statement is idempotent. */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY,
    submitted_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    company text NOT NULL,
    next_move text NOT NULL,
    arr bigint NOT NULL CHECK (arr > 0 AND arr <= 5000000000),
    category text NOT NULL,
    industry text,
    low_multiple numeric(5,2) NOT NULL,
    mid_multiple numeric(5,2) NOT NULL,
    high_multiple numeric(5,2) NOT NULL,
    low_value bigint NOT NULL,
    mid_value bigint NOT NULL,
    high_value bigint NOT NULL,
    source text NOT NULL DEFAULT 'website'
  )`,
  'CREATE INDEX IF NOT EXISTS leads_submitted_at_idx ON leads (submitted_at)',
  // Email delivery per lead: null = not sent yet, 'sent', or 'failed' (Resend refused it for good).
  'ALTER TABLE leads ADD COLUMN IF NOT EXISTS team_email_status text',
  'ALTER TABLE leads ADD COLUMN IF NOT EXISTS visitor_email_status text',
  // When the lead went out in the daily Excel email; null = not sent yet.
  'ALTER TABLE leads ADD COLUMN IF NOT EXISTS daily_report_at timestamptz',
];

let dbPromise: Promise<Db> | null = null;

async function connectNeon(url: string): Promise<Db> {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  return { query: async (text, params = []) => (await sql.query(text, params)) as never };
}

/** Embedded Postgres; "memory://" keeps it in memory (tests). */
export async function connectPglite(dataDir = process.env.PGLITE_DIR ?? '.data/pglite'): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (!dataDir.includes('://')) {
    // PGlite creates its own folder but not missing parents (e.g. ".data/").
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dataDir, { recursive: true });
  }
  const pg = new PGlite(dataDir);
  return { query: async (text, params = []) => (await pg.query(text, params)).rows as never };
}

export async function applySchema(db: Db): Promise<void> {
  for (const statement of SCHEMA) await db.query(statement);
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.VERCEL) throw new Error('DATABASE_URL is not configured');
  const db = url ? await connectNeon(url) : await connectPglite();
  await applySchema(db);
  return db;
}

export function getDb(): Promise<Db> {
  dbPromise ??= createDb().catch((err: unknown) => {
    dbPromise = null; // Let the next request try again.
    throw err;
  });
  return dbPromise;
}
