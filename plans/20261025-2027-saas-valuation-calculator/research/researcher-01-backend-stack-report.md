# Researcher 01: Backend Stack Report (2026-10-25)

Scope: DB, staff auth, xlsx export, rate limit, testing for one Next.js App Router app (TS) on Vercel.
Versions: anything not confirmed by a source below is marked "verify". Run `npm view <pkg> version` before pinning.

## TL;DR picks
| Concern | Pick | Why |
|---|---|---|
| DB | Neon (Vercel Marketplace), `aws-us-east-1` or `us-east-2`; Supabase `ca-central-1` only if firm requires Canada | 1 table, serverless HTTP driver, preview-branch DBs |
| Driver/ORM | `@neondatabase/serverless` `neon()` tagged-template, raw SQL + one `db/schema.sql` | 3 queries total; ORM is overkill (Drizzle optional) |
| Auth | `next-auth@5` beta (exact pin, >= beta.32) + Microsoft Entra ID + optional Credentials fallback, JWT sessions, no adapter | No DB tables needed; Entra provider is built in |
| Excel | ExcelJS `4.4.x` on Node runtime | Normal npm install, full numFmt/bold/freeze/autofilter |
| Rate limit | Vercel WAF rate-limit rule (dashboard, no code) + honeypot | No extra infra; see booth NAT caveat |
| Tests | Vitest (node env) for `lib/valuation.ts`; Playwright for viewport no-scroll | Standard, fast |

## 1. Postgres: Neon vs Supabase
- Neon: the default Vercel Marketplace Postgres. Region is fixed when the project is created; moving it later means a new project plus a migration. AWS regions include us-east-1, us-east-2, us-west-2. **No Canadian region** (users have asked for ca-central-1; not shipped). https://neon.com/docs/introduction/regions , https://community.neon.tech/t/hosting-in-other-aws-regions/81?page=2
- Vercel compute has no Canadian region either. Put functions in `iad1` (same area as Neon us-east-1). https://community.vercel.com/t/expanding-vercel-to-canada/21818
- Canada-resident options: Supabase `ca-central-1` (from my own knowledge; I did not check it this session, so verify), or AWS Aurora PostgreSQL through Vercel, which AWS lists in Canada (Central) since 2026-06. https://aws.amazon.com/about-aws/whats-new/2026/06/aws-databases-vercel-aws-regions
- Spec allows "Canadian or US region the firm approves". Recommendation: Neon us-east-1 by default. Switch to Supabase ca-central-1 only if Aspen says Canada only, and decide that BEFORE creating the DB.
- Supabase brings auth, storage and RLS that we don't need. Neon is leaner, and its Vercel integration can create a DB branch per preview deployment, which is useful for PR previews.

Driver: `@neondatabase/serverless` (v1.x, verify), HTTP mode. No pool to manage, works in Node functions.
```ts
// lib/db.ts
import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL!);
```
Idempotent insert. Spec: the browser generates the uuid, and a retry must not store a second row.
```ts
const rows = await sql`
  INSERT INTO leads (id, submitted_at, first_name, last_name, email, phone, company, next_move,
    arr, category, industry, low_multiple, mid_multiple, high_multiple,
    low_value, mid_value, high_value, source)
  VALUES (${id}, ${submittedAt}, ${first}, ${last}, ${email}, ${phone}, ${company}, ${nextMove},
    ${arr}, ${category}, ${industry}, ${r.low}, ${r.mid}, ${r.high},
    ${r.lowV}, ${r.midV}, ${r.highV}, ${source})
  ON CONFLICT (id) DO NOTHING
  RETURNING id`;
const duplicate = rows.length === 0; // still return 200 + recomputed range so the client dequeues
```
- Schema: `id uuid primary key`, `received_at timestamptz not null default now()`, `numeric(5,2)` multiples, `bigint` dollars. Add index `(received_at)` for export ordering and filters.
- Gotcha: the driver returns `bigint` and `numeric` as strings. Wrap them in `Number()` for the export. All values are well below 2^53.
- Validate input with `zod` (v4, verify) before the SQL. The tagged template parameterizes values, so it is injection-safe.
- Drizzle (`drizzle-orm/neon-http` + `drizzle-kit`) is fine if the team wants typed schema and migrations. Not needed for 1 table / 3 queries (YAGNI).
- Least privilege (optional): the public route only INSERTs. A separate DB role for it is overkill. One DATABASE_URL is acceptable.

## 2. Staff auth: Auth.js v5 + Microsoft Entra ID
Status: Auth.js is now part of Better Auth and only gets security patches. v5 is still beta (5.0.0-beta.32 published 2026-07 with security fixes); latest stable v4 is 4.24.x. Better Auth is the recommended path for new projects. https://authjs.dev/getting-started/providers/microsoft-entra-id , https://better-auth.com/blog/security-update-july-2026 , https://blog.logrocket.com/best-auth-library-nextjs-2026/
Decision: still use next-auth v5 here. Stateless JWT means no DB tables, the Entra provider is built in, and the surface is tiny (2 staff routes). Pin an exact version. Alternative: Better Auth with Microsoft social provider, but it normally wants DB tables for users and sessions (verify whether its stateless mode fits). Revisit if v5 stalls.

Provider facts (docs):
- import `next-auth/providers/microsoft-entra-id`
- issuer `https://login.microsoftonline.com/<TENANT_ID>/v2.0` (single tenant; the default is `common`, so do NOT omit it)
- callback `https://<host>/api/auth/callback/microsoft-entra-id`; register prod, localhost and preview URLs in the Entra app.

Env mapping. The spec's names differ from Auth.js defaults, so pass them explicitly:
```ts
// auth.ts
import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Credentials from 'next-auth/providers/credentials';
import { timingSafeEqual, createHash } from 'node:crypto';

const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? '').toLowerCase();
const hasEntra = !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
const h = (s: string) => createHash('sha256').update(s).digest();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,           // AUTH_SECRET is read automatically too
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  providers: [
    ...(hasEntra ? [MicrosoftEntraID({
      clientId: process.env.MS_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0`,
    })] : []),
    ...(process.env.STAFF_PASSWORD ? [Credentials({
      credentials: { password: { label: 'Staff password', type: 'password' } },
      authorize: async (c) =>
        timingSafeEqual(h(String(c?.password ?? '')), h(process.env.STAFF_PASSWORD!))
          ? { id: 'staff', name: 'Staff', email: `staff@${domain}` } : null,
    })] : []),
  ],
  callbacks: {
    signIn: ({ user, profile }) => {
      const email = String(profile?.email ?? (profile as any)?.preferred_username ?? user.email ?? '').toLowerCase();
      return !!domain && email.endsWith(`@${domain}`);
    },
  },
});
// app/api/auth/[...nextauth]/route.ts -> export const { GET, POST } = handlers;
```
- Check in every staff route handler: `const s = await auth(); if (!s) return new Response(null, { status: 401 })`. Don't rely only on middleware/`proxy.ts` (Next 16 renamed middleware to proxy; middleware-only auth was bypassable in CVE-2025-29927).
- Entra may not put `email` in the profile for some accounts; `preferred_username` (UPN) is the fallback. The single-tenant issuer already limits sign-in to Aspen's tenant, and the domain check adds a second layer.
- Fallback flow: if MS_* are unset, only Credentials shows. Set STAFF_PASSWORD in Vercel, at least 20 random characters. Adding a sign-in throttle (via WAF rule on `/api/auth/callback/credentials`) is optional. Remove STAFF_PASSWORD once Entra is live. Built-in `/api/auth/signin` page is fine (or a minimal custom one).
- Add env: STAFF_PASSWORD (optional, new, not in spec) → document in `.env.example`.

## 3. Excel export
- SheetJS: the npm `xlsx` package is stuck at 0.18.5, which has a high-severity ReDoS (CVE-2024-22363, fixed in 0.20.2). The fixed builds exist only as tarballs on cdn.sheetjs.com (`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, verify latest). It shows up in `npm audit` noise, and Community Edition can't do styling such as bold headers (it does support `z` number formats). https://advisories.gitlab.com/pkg/npm/xlsx/ , https://git.sheetjs.com/sheetjs/sheetjs/issues/3111
- ExcelJS `exceljs@4.4.0` (MIT): normal npm install. Its last release is old (2023, verify) but stable. It supports `numFmt`, bold header, frozen row, autoFilter and column widths, and the dataset is tiny. **Pick ExcelJS.**
- Runtime: Node required (Buffer/zip libs). `export const runtime = 'nodejs'` (the default, but state it), `export const dynamic = 'force-dynamic'`.
```ts
// app/api/export/route.ts
import ExcelJS from 'exceljs';
export async function GET(req: Request) {
  if (!(await auth())) return new Response('Unauthorized', { status: 401 });
  const rows = await fetchLeads(new URL(req.url).searchParams); // from,to,source; ORDER BY submitted_at ASC
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('SaaS North Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
  const money = '$#,##0';
  ws.columns = [
    { header: 'Submitted', key: 'sub', width: 20, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'First Name', key: 'fn', width: 14 }, /* ...Last Name, Email, Phone, Company, Next Move */
    { header: 'ARR Entered', key: 'arr', width: 14, style: { numFmt: money } },
    { header: 'Software Category', key: 'cat', width: 24 }, { header: 'Industry', key: 'ind', width: 20 },
    { header: 'Midpoint Multiple', key: 'mid', width: 12, style: { numFmt: '0.00"x"' } },
    { header: 'Low Value', key: 'lv', width: 14, style: { numFmt: money } }, /* Midpoint Value, High Value */
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach(r => ws.addRow({ ...r, arr: Number(r.arr), mid: Number(r.mid_multiple) /* ... */ }));
  const buf = await wb.xlsx.writeBuffer();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date()); // YYYY-MM-DD
  return new Response(new Uint8Array(buf as ArrayBuffer), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="SaaS_North_Leads_${day}.xlsx"`,
    'Cache-Control': 'no-store',
  }});
}
```
- Excel dates have no timezone, and a JS Date is written as UTC. Shift to America/Toronto wall time before writing, or write an en-CA string (`toLocaleString('en-CA',{timeZone:'America/Toronto'})`) as text. The text option is simpler but can't be sorted as a date.
- Wrapping in `new Uint8Array` avoids TS BodyInit type errors with newer @types/node Buffer typings.
- Staff UI link: a plain `<a href="/api/export?...">`, so the browser handles the download with no JS blob code.

## 4. Rate limiting (10 req/IP/min)
| Option | Effort | Notes |
|---|---|---|
| Vercel WAF rate-limit rule | Dashboard only, no code | Fixed window on all plans; Hobby = 1 rate-limit rule/project, Pro = 40; ~$0.50 per 1M allowed requests; action 429/deny. https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting , https://vercel.com/docs/security/vercel-waf/usage-and-pricing |
| Upstash Ratelimit (`@upstash/ratelimit` + `@upstash/redis`, Marketplace) | ~15 lines + 2 env vars | Precise control in code, testable; extra vendor |
| In-DB counter | Needs an ip column (more PII) plus a query per request | Avoid |
| In-memory Map | — | Useless on serverless (each instance has its own memory) |

KISS: a WAF rule with condition path = `/api/leads`, method = POST, key = IP, 10/60s, action 429. Plus a honeypot field (return a fake 200 and skip the insert). Code-based alternative (unverified): `@vercel/firewall` `checkRateLimit(ruleId)`; my search did not confirm it exists.
**Booth caveat:** all booth iPads share one public NAT IP, and the offline queue flushes several records at once. 10 per minute per IP could block real leads. Mitigations: (a) the client treats 429 as retryable, keeps the record queued and flushes sequentially with backoff; (b) ask whether the limit should be raised (e.g. 30/min) or the venue IP exempted during the event.

## 5. Testing
- Vitest (v4.x, verify), `environment: 'node'`. Pure `lib/valuation.ts` shared by client and server. Use `it.each` tables for: both worked examples (exact multiples and values), the size-factor boundary (3,000,000 → 0.75; 2,999,999 → 0.70), each industry at 3.7x with its tier adjustment, each category's own multiple. Also unit-test zod schemas, phone formatting and the email lowercase/trim.
- Playwright (`@playwright/test`, latest 1.x). `webServer: { command: 'npm run build && npm start', port: 3000 }`. Projects: iPad landscape (`devices['iPad Pro 11 landscape']`), 1366x768, 1920x1080. No-scroll assertion:
```ts
const { sh, ih, sw, iw } = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight,
  ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
expect(sh).toBeLessThanOrEqual(ih); expect(sw).toBeLessThanOrEqual(iw);
```
  Also check the state before and after unlock (the spec says no layout shift), and that a 401 is returned from `/api/export` without a session.
- API idempotency test: POST the same uuid twice → one row. Run it against a Neon preview branch or local Postgres, never prod.
- CI: GitHub Actions runs `vitest run` and `playwright test` on each PR; Vercel creates the preview deploy.

## Package list (verify exact versions)
next@16, react@19, next-auth@5.0.0-beta.3x (exact pin), @neondatabase/serverless@1, zod@4, exceljs@4.4.0, vitest, @playwright/test. Optional: drizzle-orm + drizzle-kit, @upstash/ratelimit + @upstash/redis.

## Unresolved questions
1. Does Aspen require Canadian residency (→ Supabase ca-central-1 / Aurora ca-central-1), or is US (Neon us-east-1) approved?
2. Does the client have an Entra tenant and can it register an app now? If not, is a shared STAFF_PASSWORD fallback acceptable (a new env var not in the spec)?
3. Vercel plan Hobby vs Pro? Hobby allows 1 WAF rate-limit rule and has commercial-use limits. A client project likely needs Pro.
4. Booth NAT: raise or exempt the 10/min/IP limit during the event?
5. Should "Submitted" in the xlsx be a real Excel date (Toronto wall time) or en-CA text?
6. Is a Better Auth migration desired long-term, given Auth.js is in security-only maintenance?
7. Unverified items: `@vercel/firewall` checkRateLimit API, current exceljs maintenance status, Supabase ca-central-1 availability via the Vercel Marketplace.
