import type { Metadata } from 'next';
import Link from 'next/link';
import { SOURCE_BOOTH, SOURCE_WEBSITE } from '@/config/valuation-config';
import { getDb } from '@/lib/db';
import { countLeads } from '@/lib/leads-repository';
import { isStaff } from '@/lib/require-staff';
import { staffAuthConfigured } from '@/lib/staff-session';
import { signIn, signOut } from './actions';
import styles from './staff-page.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Staff | Aspen Valuations', robots: { index: false } };

async function totalLeads(): Promise<number | null> {
  try {
    return await countLeads(await getDb());
  } catch {
    return null;
  }
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  if (!(await isStaff())) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.heading}>Staff sign in</h1>
          {staffAuthConfigured() ? (
            <form action={signIn} className={styles.form}>
              <label className={styles.label} htmlFor="password">
                Staff password
              </label>
              <input id="password" name="password" type="password" className={styles.input} required autoFocus />
              {error && (
                <p className={styles.error}>
                  {error === 'limit' ? 'Too many attempts. Wait a minute and try again.' : 'That password is not correct.'}
                </p>
              )}
              <button type="submit" className={styles.button}>
                Sign in
              </button>
            </form>
          ) : (
            <p className={styles.muted}>
              Staff access is not configured. Set STAFF_PASSWORD (12+ characters) and AUTH_SECRET (16+ characters).
            </p>
          )}
          <Link className={styles.back} href="/">
            Back to calculator
          </Link>
        </section>
      </main>
    );
  }

  const total = await totalLeads();
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.heading}>Export leads to Excel</h1>
        <p className={styles.muted}>
          {total == null ? 'Lead count unavailable (database not reachable).' : `${total} leads saved.`} Exporting
          never deletes data.
        </p>
        <a className={styles.button} href="/api/export">
          Download all leads
        </a>
        <form action="/api/export" method="get" className={styles.filters}>
          <p className={styles.label}>Or filter (dates in Toronto time, inclusive)</p>
          <label className={styles.label}>
            From
            <input type="date" name="from" className={styles.input} />
          </label>
          <label className={styles.label}>
            To
            <input type="date" name="to" className={styles.input} />
          </label>
          <label className={styles.label}>
            Source
            <select name="source" className={styles.input} defaultValue="">
              <option value="">All sources</option>
              <option value={SOURCE_BOOTH}>{SOURCE_BOOTH}</option>
              <option value={SOURCE_WEBSITE}>{SOURCE_WEBSITE}</option>
            </select>
          </label>
          <button type="submit" className={styles.secondary}>
            Download filtered
          </button>
        </form>
        <form action={signOut}>
          <button type="submit" className={styles.link}>
            Sign out
          </button>
        </form>
        <Link className={styles.back} href={`/?source=${SOURCE_BOOTH}&kiosk=1`}>
          Back to calculator (booth)
        </Link>
      </section>
    </main>
  );
}
