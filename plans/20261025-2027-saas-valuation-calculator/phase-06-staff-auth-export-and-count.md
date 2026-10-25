# Phase 06: Staff auth + Excel export + count

> **UPDATE 2026-10-25 (user decision):** Auth.js + Entra dropped. Replace `src/auth.ts`/nextauth route with:
> `src/lib/staff-session.ts` — `createSessionToken()` = `${exp}.${hmacSHA256(AUTH_SECRET, exp)}`, `verifySessionToken()` (timingSafeEqual, exp check), cookie `aspen_staff` httpOnly/secure/sameSite=lax/12h; `requireStaff()` reads cookie.
> `/staff` page: no session → password form (server action, constant-time compare vs `STAFF_PASSWORD`, ~400ms delay on fail); session → count, export form, sign out. Env: `STAFF_PASSWORD`, `AUTH_SECRET`, `DATABASE_URL` only.

## Context links
- [plan.md](plan.md) · spec "Excel export", "Security and admin access", "API endpoints", env vars
- `research/researcher-01-backend-stack-report.md` §2 (Auth.js v5 + Entra + Credentials code), §3 (ExcelJS route)
- Skills: `backend-development`, `docs-seeker` (Auth.js Entra provider docs)

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical (export needed day 1 evening) · Status: Not started · Review: Not reviewed
- Auth.js v5 JWT sessions; Entra ID (single tenant + domain check) and/or Credentials fallback, each enabled only if env present. `/staff` page (sign-in link, filters, export, count, sign out). `GET /api/export` xlsx, `GET /api/leads/count`. Footer staff area with saved + queued counts.

## Key Insights
- Every staff route calls `requireStaff()` itself; no middleware/proxy-only auth (CVE-2025-29927 class).
- Entra issuer must be tenant-scoped (`.../<TENANT>/v2.0`); default `common` would admit any tenant. Email may be missing → fallback `preferred_username`.
- iOS Home Screen web app: OAuth redirects can bounce to Safari (separate cookies) and xlsx download can trap app in Quick Look. ⇒ Export from staff laptop/phone (DB is server-side, any device works). iPad only needs to show **queued** count. Credentials fallback works in-app.
- Excel dates have no TZ → write Toronto wall-clock Date, numFmt `yyyy-mm-dd hh:mm` (en-CA order) (Q9).
- Neon returns numeric/bigint as strings → `Number()`.
- Built-in Auth.js sign-in page lists enabled providers → no custom sign-in UI (KISS).

## Requirements
- Functional: export file `SaaS_North_Leads_YYYY-MM-DD.xlsx` (Toronto date), sheet "SaaS North Leads", oldest first (submitted_at ASC), all leads, optional `from`,`to` (YYYY-MM-DD, Toronto, inclusive) and `source`; never deletes. Count returns `{count}`. Footer: signed in → "Staff: Export leads to Excel (N saved)" + "M queued"; not signed in + kiosk → small "Staff" link + "M queued" if >0; public (no kiosk) → nothing.
- Non-functional: 401 without session, `Cache-Control: no-store`; Node runtime.

## Architecture
```ts
// src/auth.ts — as researcher-01 §2 (providers conditional on env; session jwt maxAge 12h;
// signIn callback: email/preferred_username endsWith '@'+ALLOWED_EMAIL_DOMAIN; deny if domain unset)
// Credentials authorize: timingSafeEqual(sha256(input), sha256(STAFF_PASSWORD)) → {id:'staff', email:`staff@${domain}`}
// src/app/api/auth/[...nextauth]/route.ts → export const { GET, POST } = handlers;
// src/lib/require-staff-session.ts
export async function requireStaff() { const s = await auth();
  return s?.user ? null : new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } }); }
```
```sql
-- leads-repository.ts listLeadsForExport({from,to,source})   (null = no filter)
SELECT submitted_at, first_name, last_name, email, phone, company, next_move, arr, category, industry,
       mid_multiple, low_value, mid_value, high_value
FROM leads
WHERE (${from}::date IS NULL OR submitted_at >= (${from}::date)::timestamp AT TIME ZONE 'America/Toronto')
  AND (${to}::date   IS NULL OR submitted_at <  ((${to}::date + 1)::timestamp AT TIME ZONE 'America/Toronto'))
  AND (${source}::text IS NULL OR source = ${source})
ORDER BY submitted_at ASC, received_at ASC;
-- countLeads(source?) → SELECT count(*)::int AS count FROM leads WHERE (${source}::text IS NULL OR source = ${source})
```
Export columns (spec order; `src/lib/export-workbook.ts`, labels from config):
| Header | Value | numFmt |
|---|---|---|
| Submitted | Toronto wall-clock Date | `yyyy-mm-dd hh:mm` |
| First Name, Last Name, Email, Phone, Company, Next Move | text | — |
| ARR Entered | Number(arr) | `$#,##0` |
| Software Category, Industry | text ('' if null) | — |
| Midpoint Multiple | Number(mid_multiple) | `0.00"x"` |
| Low Value, Midpoint Value, High Value | Number | `$#,##0` |
Bold header row, frozen row 1, autoFilter, column widths. Response: `new Uint8Array(await wb.xlsx.writeBuffer())`, content-type xlsx, `Content-Disposition: attachment; filename="SaaS_North_Leads_${torontoDate}.xlsx"`.
```ts
// toTorontoWallClock(d): parts = Intl.DateTimeFormat('en-CA',{timeZone:EVENT_TIMEZONE, hourCycle:'h23', y/m/d/h/mi/s}).formatToParts(d)
//   → new Date(Date.UTC(y, m-1, d, h, mi, s))   (ExcelJS writes UTC serial → shows wall time)
```
Staff page `/staff` (server, `dynamic='force-dynamic'`): no session → button/link to `/api/auth/signin?callbackUrl=/staff`; session → email, total count, GET form (from, to, source select: all / saas-north-2026-booth / website) action `/api/export`, "Download all" link, sign-out server action, "Back to calculator" link using validated `return` param (`^\?[a-z0-9=&%_-]*$`i, else `/`).

Footer (`site-footer.tsx`, client): `useStaffLeadCount()` fetches `/api/leads/count` on mount + when queued count drops (200 → number, 401 → null); `useLeadQueueCount()`.

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\src\auth.ts | create |
| D:\Downloads\saas_valuation_calculator\src\app\api\auth\[...nextauth]\route.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\require-staff-session.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\leads-repository.ts | modify (listLeadsForExport, countLeads) |
| D:\Downloads\saas_valuation_calculator\src\lib\export-workbook.ts | create (buildLeadsWorkbook(rows) → Buffer, toTorontoWallClock, exportFileName) |
| D:\Downloads\saas_valuation_calculator\src\app\api\export\route.ts | create (`runtime='nodejs'`, `dynamic='force-dynamic'`) |
| D:\Downloads\saas_valuation_calculator\src\app\api\leads\count\route.ts | create |
| D:\Downloads\saas_valuation_calculator\src\app\staff\page.tsx + staff-page.module.css | create |
| D:\Downloads\saas_valuation_calculator\src\hooks\use-staff-lead-count.ts | create |
| D:\Downloads\saas_valuation_calculator\src\components\layout\site-footer.tsx | modify (staff area) |
| D:\Downloads\saas_valuation_calculator\.env.example | modify if names change |
| D:\Downloads\saas_valuation_calculator\tests\unit\export-workbook.test.ts | create |

## Implementation Steps
1. Ask Aspen IT (Q3): Entra app registration, single tenant; redirect URIs `https://<prod>/api/auth/callback/microsoft-entra-id`, `http://localhost:3000/...`, preview domain(s); client secret; `email`, `openid`, `profile` scopes. Until ready: `STAFF_PASSWORD` (≥20 random chars) in Vercel Production + Preview.
2. `npx auth secret` → AUTH_SECRET in Vercel (all envs) + `.env.local`.
3. Implement auth.ts, auth route, requireStaff.
4. Repository queries (param filters) + validate query params: `from/to` regex `^\d{4}-\d{2}-\d{2}$` else 400; `source` slug regex else 400.
5. export-workbook.ts + export route; count route.
6. `/staff` page + footer staff area + hooks.
7. Unit test export-workbook: build from 2 fixture rows (one with null industry), read back with ExcelJS → sheet name, 14 headers in order, numFmt per column, row order, Submitted wall-clock (UTC 2026-11-04T15:30Z → 10:30), file name format.
8. Manual: sign in (Credentials) → `/staff` → export with/without filters opens in Excel; sign out → `/api/export` 401; wrong-domain Entra account rejected (when Entra ready).
9. Commit `feat(staff): add staff auth, excel export and lead count`.

## Todo list
- [ ] Entra registration requested / STAFF_PASSWORD fallback set
- [ ] auth.ts + route + requireStaff
- [ ] Export + count queries with filters
- [ ] export-workbook.ts + /api/export + /api/leads/count
- [ ] /staff page (filters, sign out, back link)
- [ ] Footer staff area (saved + queued counts)
- [ ] Export unit test green; manual Excel check
- [ ] (Phase 2 only) remove staff link/count fetch from non-kiosk public page entirely; add privacy link

## Success Criteria
- Unauthenticated `/api/export` and `/api/leads/count` → 401; authenticated export matches column/format table; filters work; nothing deleted.
- Footer shows "(N saved)" for staff and queued count on kiosk.

## Risk Assessment
- Auth.js v5 beta / security-only maintenance → pinned exact; small surface; Better Auth migration later (phase 2 review).
- Entra not ready by booth → Credentials fallback (password rotate after event).
- Count fetch on every page load from public page → 401 cheap; phase 2 removes it on non-kiosk.

## Security Considerations
- Session JWT httpOnly secure cookie; 12h expiry; domain allowlist + tenant issuer.
- Credentials: constant-time compare; optional WAF rate rule on `/api/auth/callback/credentials` (5/min/IP).
- Export responses `no-store`; no lead data ever in public page bundle.
- Shared booth device: staff signs out after export (checklist).

## Next steps
- Phase 07 kiosk/PWA; phase 08 E2E 401 checks; phase 09 env + Entra redirect URIs in prod.
