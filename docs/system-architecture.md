# System architecture

One Next.js app on Vercel: the page, three API routes, a staff page and a Postgres database.

```
Visitor browser ── calculates range instantly, write-ahead queue in localStorage
      │  POST /api/leads (public, create only, rate limited, honeypot)
      ▼
Route handler ── validate (zod + spec rules) → recalculate → INSERT ... ON CONFLICT (id) DO NOTHING
      │                                                     → email team inbox, then visitor (Resend)
      ▼
Postgres `leads` table (Neon in production, PGlite locally)  ◄── source of truth
      ▲
Staff browser ── /staff (password) → GET /api/export (.xlsx), GET /api/leads/count
```

## Lead submit and the offline queue
1. The browser validates the form in spec order, computes the estimate and unlocks the result at once.
2. The lead is written to localStorage (`aspen.leadQueue.v1`) with a browser-made UUID, then sent.
3. The queue sends one record at a time.
   - `2xx`: the record is removed.
   - `400/413`: the record is marked bad and kept.
   - `429`, `5xx` or a network error: sending stops and is retried later.
4. Retries happen on page load, every 30 s, on the `online` event and when the page becomes visible.
5. The server ignores an id it already has, so a retried submit is never stored twice.

## Lead emails (Resend)
1. After the insert, the server sends the emails still missing for that lead: the team inbox (`EMAIL_TEAM_TO`) first, then the visitor.
2. Each email's status is stored (`team_email_status`, `visitor_email_status`: null, `sent` or `failed`), and each send uses the idempotency key `lead-<id>-<kind>`, so no email goes out twice.
3. A temporary failure (network, 401/403 setup, 429 quota, 5xx) answers 503: the browser keeps the lead queued and the retry sends only what is missing.
4. Resend refusing an email for good (400/422) marks it `failed`; it is not retried.
5. Email is off when the variables are missing locally. On Vercel, missing variables count as a temporary failure.
6. The visitor email greets by first name only when it looks like a name, so the form cannot carry links to other inboxes. Everything a visitor types is HTML-escaped.
   Its layout follows Aspen's approved version. The logo travels inside the email as an inline `cid:` image (Outlook blocks images loaded from the web), and the button is a one-cell table so Outlook sizes it to its text.
7. SMTP (`src/lib/smtp-mailer.ts`, nodemailer) replaces Resend when `SMTP_HOST` is set, e.g. Gmail for a demo. SMTP has no idempotency key; a fixed Message-ID per lead and email stands in. Only a bad address (SMTP 5.1.x) counts as refused for good.

## Daily Excel email (Vercel Cron)
1. `vercel.json` runs `GET /api/cron/daily-leads` once a day (`0 23 * * *` UTC). The route accepts only `Authorization: Bearer <CRON_SECRET>`.
2. One `UPDATE ... SET daily_report_at = <run time> WHERE daily_report_at IS NULL` claims every lead not yet sent, so a duplicate run claims nothing.
3. The claimed leads go to `EMAIL_TEAM_TO` as `SaaS_North_Leads_YYYY-MM-DD.xlsx` (same workbook as `/api/export`).
4. If the email fails, the claim is released and the next run sends those leads; a missed run is caught up the same way.

## Staff access
- `/staff` checks `STAFF_PASSWORD` in constant time, with a delay after a failed attempt.
- After sign-in it sets the `aspen_staff` cookie: httpOnly, `<expiry>.<HMAC-SHA256>` signed with `AUTH_SECRET`, valid 12 h.
- `/api/export` and `/api/leads/count` each verify the cookie themselves and return 401 otherwise.

## Kiosk mode (`?kiosk=1`)
- Idle reset 2 minutes after a result.
- Queued count in the footer. The export link is shown only to signed-in staff.
- A service worker caches only the page shell and static files (never `/api/*`), so the installed iPad app reopens offline.
- The manifest `start_url` is the booth URL.

## Database
The schema is created automatically on first use (`src/lib/db.ts`, idempotent). Table `leads`:
- id (uuid primary key)
- submitted_at (browser time), received_at (server time)
- names, email (lower-cased), phone (formatted), company, next_move
- arr
- category, industry (nullable)
- low/mid/high multiples (numeric 5,2) and values (bigint), all server-calculated
- source
- team_email_status, visitor_email_status (added with `ADD COLUMN IF NOT EXISTS`)
