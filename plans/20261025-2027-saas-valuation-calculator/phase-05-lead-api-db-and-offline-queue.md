# Phase 05: Lead API + DB schema + offline queue

## Context links
- [plan.md](plan.md) · spec "Data model and storage", "Offline queue", "Security and admin access", "API endpoints"
- `research/researcher-01-backend-stack-report.md` §1 (Neon, insert), §4 (rate limit, NAT caveat)
- `research/researcher-02-frontend-kiosk-report.md` §3 (queue, UUID fallback)
- Skills: `databases`, `backend-development`

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical · Status: Not started · Review: Not reviewed
- Neon DB + `leads` table; `POST /api/leads` (validate, honeypot, recalc, idempotent insert, return range); client write-ahead localStorage queue with sequential flush; security headers; WAF rule documented.

## Key Insights
- **Write-ahead queue**: always enqueue first, then flush. Unlock never waits on network; tab killed mid-request still keeps record. Duplicate-safe via browser uuid + `ON CONFLICT (id) DO NOTHING`.
- Neon HTTP driver returns `bigint`/`numeric` as strings → `Number()` on read.
- `crypto.randomUUID` needs secure context → `getRandomValues` fallback (iPad testing over LAN http).
- Booth NAT: all iPads one IP; 429 must be retryable; flush sequential and stop on 429.
- Region locked at Neon project creation → wait for Q2 answer (deadline Oct 28); default us-east-1.
- DB client must be lazy so `next build`/CI work without DATABASE_URL.

## Requirements
- Functional: valid lead stored once; duplicate id → 200 + range; honeypot → fake 200, no insert; invalid → 400 `{error}`; queue retries every 30s, on load, on `online`, on visible; remove only on 2xx; queued count exposed.
- Non-functional: server recompute (never trust client numbers); body ≤ 4KB; responses `no-store`.

## Architecture
```sql
-- db/schema.sql
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY,
  submitted_at timestamptz NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL,
  phone text NOT NULL, company text NOT NULL, next_move text NOT NULL,
  arr bigint NOT NULL CHECK (arr > 0 AND arr <= 5000000000),
  category text NOT NULL, industry text,
  low_multiple numeric(5,2) NOT NULL, mid_multiple numeric(5,2) NOT NULL, high_multiple numeric(5,2) NOT NULL,
  low_value bigint NOT NULL, mid_value bigint NOT NULL, high_value bigint NOT NULL,
  source text NOT NULL DEFAULT 'website'
);
CREATE INDEX IF NOT EXISTS leads_submitted_at_idx ON leads (submitted_at);
```
```ts
// src/lib/lead-schema.ts (zod v4; verify API names)
export const LeadPayload = z.object({
  id: z.uuid(), submittedAt: z.iso.datetime(), arr: z.number().int().positive().max(ARR_MAX),
  selection: z.string().max(80), firstName: z.string().max(100), lastName: z.string().max(100),
  company: z.string().max(200), email: z.string().max(254), phone: z.string().max(30),
  nextMove: z.string().max(60), nextMoveOther: z.string().max(100).default(''),
  source: z.string().regex(/^[a-z0-9-]{1,64}$/).catch('website'), websiteUrl: z.string().max(500).optional(),
});
// src/app/api/leads/route.ts  (runtime nodejs, dynamic force-dynamic)
POST: text = await req.text(); if (text.length > 4096) 413
  parsed = LeadPayload.safeParse(JSON.parse) → 400 {error:'Invalid request'}
  if (parsed.websiteUrl) return json({ ok: true })                 // honeypot, no insert
  msg = validateLead(parsed); if (msg) 400 {error: msg}
  sel = resolveSelection(...)!; est = estimate(arr, sel.category, sel.industry); n = normalizeLead(parsed)
  inserted = await insertLead({ ...n, id, submittedAt, arr, ...sel, ...est, source })
  return json({ ok: true, duplicate: !inserted, range: pick(est, multiples+values) }, no-store)
  catch DB error → 503 (client keeps queued)
// src/lib/db.ts
let _sql; export function getSql() { if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing'); return (_sql ??= neon(process.env.DATABASE_URL)); }
// src/lib/leads-repository.ts → insertLead (INSERT ... ON CONFLICT (id) DO NOTHING RETURNING id; returns rows.length===1)
```
```ts
// src/lib/lead-queue-storage.ts  key 'aspen.leadQueue.v1' → QueuedLead[] {id, payload, queuedAt, attempts, bad?}
readQueue() / writeQueue() (try/catch; on failure keep in-memory fallback array) / enqueueLead / removeLead / markBad
subscribe(fn) + notify(); also window 'storage' event
// src/lib/lead-queue-sync.ts
let inFlight = false;
export async function flushQueue() {
  if (inFlight) return; inFlight = true;
  try { for (const rec of readQueue().filter(r => !r.bad)) {
      const res = await postLead(rec.payload);           // 'ok' | 'bad' | 'retry'
      if (res === 'ok') removeLead(rec.id); else if (res === 'bad') markBad(rec.id); else break;
  } } finally { inFlight = false; }
}
postLead: AbortController 8s timeout; 2xx→ok; 400/413→bad; 429/5xx/network→retry
export function startQueueSync() { flushQueue(); const t = setInterval(flushQueue, 30_000);
  addEventListener('online', flushQueue); document.addEventListener('visibilitychange', onVisible); return cleanup; }
// src/lib/uuid.ts
createUuid(): crypto.randomUUID?.() ?? v4 from getRandomValues (b[6]=b[6]&0x0f|0x40; b[8]=b[8]&0x3f|0x80)
// src/hooks/use-lead-queue-count.ts → useSyncExternalStore(subscribe, pendingCount, () => 0)
```
Wire: `calculator-app.tsx` `onLeadSubmitted(values, source)` → `enqueueLead({ id: createUuid(), payload: {...values, arr, source, submittedAt: new Date().toISOString(), websiteUrl}, queuedAt, attempts:0 })` then `void flushQueue()`; `useEffect(startQueueSync, [])`.

Security headers (`next.config.ts headers()` for `/(.*)`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\db\schema.sql | create |
| D:\Downloads\saas_valuation_calculator\src\lib\db.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\leads-repository.ts | create (insertLead now; count/list in phase 06) |
| D:\Downloads\saas_valuation_calculator\src\lib\lead-schema.ts | create |
| D:\Downloads\saas_valuation_calculator\src\app\api\leads\route.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\uuid.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\lead-queue-storage.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\lead-queue-sync.ts | create |
| D:\Downloads\saas_valuation_calculator\src\hooks\use-lead-queue-count.ts | create |
| D:\Downloads\saas_valuation_calculator\src\components\calculator\calculator-app.tsx | modify (wire queue, honeypot value) |
| D:\Downloads\saas_valuation_calculator\next.config.ts | modify (headers) |
| D:\Downloads\saas_valuation_calculator\tests\unit\lead-api-route.test.ts | create (vi.mock repository) |
| D:\Downloads\saas_valuation_calculator\tests\unit\lead-queue-sync.test.ts | create (stub localStorage + fetch) |
| D:\Downloads\saas_valuation_calculator\tests\unit\uuid.test.ts | create |

## Implementation Steps
1. Get Q2 answer; Vercel dashboard → Storage → Create → Neon (region us-east-1 unless Canada required → Supabase ca-central-1, same raw SQL via `postgres` driver instead). Connect to project for Production + Preview + Development.
2. `npx vercel env pull .env.local`; apply schema: Neon console SQL editor paste `db/schema.sql` (or `psql "$DATABASE_URL" -f db/schema.sql`). Use a separate Neon branch `dev` for local.
3. Implement db.ts, repository insert, lead-schema, route handler as above.
4. Unit tests (route): valid → insert called with server-computed values (send tampered extra numbers → ignored); duplicate (insert returns false) → 200 `duplicate:true`; honeypot → 200, insert not called; each validation failure → 400 with spec message; oversize → 413; DB throw → 503.
5. Queue modules + tests: enqueue→flush ok removes; 429 stops loop and keeps rest; network error keeps; 400 marks bad; concurrent flush calls send each record once (inFlight).
6. Wire calculator-app; queued count displayed by footer in phase 06 (expose hook now).
7. Manual: DevTools offline → submit → unlocked, localStorage has 1 → online → row in DB once; resubmit same payload via curl → `duplicate:true`.
8. Add headers to next.config.ts.
9. Document WAF rule for phase 09: Firewall → Custom rule → If path equals `/api/leads` AND method POST → Rate limit fixed window 60s, 10 req, key IP, action 429 (raise to 30 during event if Q4 says so).
10. Commit `feat(leads): add leads table, lead API and offline queue`.

## Todo list
- [ ] Region decided, Neon created + connected, schema applied (prod + dev branch)
- [ ] db.ts lazy, repository insert, zod schema
- [ ] POST /api/leads with honeypot, recalc, idempotent insert
- [ ] uuid fallback, queue storage, flush loop, sync start, count hook
- [ ] Wired into calculator submit
- [ ] Security headers
- [ ] Unit tests green; manual offline test OK

## Success Criteria
- Offline submit unlocks; after reconnect exactly one row; repeated id never duplicates.
- Stored multiples/values equal `estimate()` regardless of client payload.
- `npm run build` passes without DATABASE_URL.

## Risk Assessment
- localStorage unavailable/quota (private mode) → in-memory fallback; lead lost only if page also closes → acceptable, documented.
- Safari ITP 7-day storage wipe → staff confirm queue 0 end of each day (checklist).
- Clock skew in `submitted_at` (browser time) → also have `received_at`; export uses submitted_at per spec.
- WAF throttles booth flush → sequential + stop on 429 + 30s retry; raise limit (Q4).

## Security Considerations
- Public route insert-only; no GET of leads. Parameterized SQL via tagged template.
- Honeypot + WAF rate limit; size cap; zod string caps; email lowercased.
- DATABASE_URL only in Vercel env / `.env.local` (gitignored). No PII in logs (log only id + error class).
- PIPEDA: region per Aspen approval (Q2).

## Next steps
- Phase 06 adds count/export queries + staff footer showing queued count. Phase 08 E2E offline flow.
