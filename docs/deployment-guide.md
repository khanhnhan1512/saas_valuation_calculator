# Deployment guide (Vercel + Neon)

## 1. Import the repo
Vercel dashboard → **Add New → Project** → import `khanhnhan1512/saas_valuation_calculator` → framework Next.js → keep the default build settings → **Deploy**.
- Every push to `main` deploys production.
- Pull requests get preview URLs.

## 2. Database (Neon)
1. In the project: **Storage → Create Database → Neon** (free plan).
2. Choose region **US East (iad1 / us-east-1)**, and connect it to Production, Preview and Development.
3. This adds `DATABASE_URL` to the project automatically.
4. Nothing else to run: the `leads` table is created automatically on the first request.
5. Region note: leads are personal information (PIPEDA). Confirm Aspen accepts US storage before creating the database; the region cannot be changed later.

## 3. Environment variables
Settings → Environment Variables (Production and Preview):

| Name | Value |
|---|---|
| `STAFF_PASSWORD` | a long passphrase for staff (share it only with booth staff) |
| `AUTH_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `RESEND_API_KEY` | API key from Resend (see step 4) |
| `EMAIL_FROM` | sender on the verified domain, e.g. `Aspen Valuations <no-reply@aspenval.com>` |
| `EMAIL_TEAM_TO` | the shared company inbox that gets every lead (and the visitors' replies) |
| `CRON_SECRET` | 16+ random characters (same command as `AUTH_SECRET`); unlocks the daily Excel email, see step 4 |

Redeploy after adding variables (Deployments → ⋯ → Redeploy).

## 4. Email (Resend)
Each lead sends two emails: the result to the visitor, and the lead details to `EMAIL_TEAM_TO`.
1. Create an account at resend.com → **Domains → Add Domain** (e.g. `aspenval.com`, or a subdomain such as `mail.aspenval.com`).
2. Add the DNS records Resend shows (SPF and DKIM) at the domain's DNS host, then press **Verify**. Without this, Resend only sends to your own address and other emails are refused.
3. **API Keys → Create** (sending access) → put it in `RESEND_API_KEY`. `EMAIL_FROM` must use the verified domain.
4. Quota: the free plan allows 100 emails a day, which is about 50 leads (2 emails each). For the event days use the Pro plan (no daily limit).

How failures behave:
- The lead is always stored first, so email problems never lose a lead.
- If Resend is down, over quota or not set up, the API answers 503 and the device keeps the lead queued; the retry sends only the missing email. The footer then shows "queued" at the booth: check the Vercel logs (`email not sent: <status>`).
- An email Resend refuses for good (e.g. a malformed address) is marked `failed` in the `leads` table and not retried.
- On Vercel all three email variables are required. Without them every lead stays queued until they are set.

### Daily Excel email (Vercel Cron)
Every evening the team inbox (`EMAIL_TEAM_TO`) gets one email with an Excel file of every lead not sent before, so staff rarely need `/staff`.
- Schedule: `vercel.json`, `0 23 * * *` in UTC, which is 18:00 in Toronto in winter (19:00 in summer). On the Hobby plan Vercel may run it any time within that hour.
- Needs `CRON_SECRET`: Vercel sends it with each run, and the route refuses every other caller. Without it the route stays closed and no daily email goes out.
- No new leads: no email. A failed send keeps the leads for the next evening; a missed run is caught up the next day.
- Test it: Settings → **Cron Jobs** → **Run** next to `/api/cron/daily-leads`. Logs: **View Logs** on the same page.

### Demo with Gmail (before the domain is verified)
SMTP can stand in for Resend; when `SMTP_HOST` is set, SMTP is used.
1. In the Gmail account: turn on 2-Step Verification, then create an app password at myaccount.google.com/apppasswords.
2. Vercel variables: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<the Gmail address>`, `SMTP_PASS=<the app password>`, and `EMAIL_FROM=Aspen Valuations <the same Gmail address>` (Gmail replaces any other sender). Redeploy.
3. Gmail keeps a copy of every email in Sent, which holds visitors' personal information: delete them after the demo.
4. To move to Resend: delete `SMTP_HOST`, set `EMAIL_FROM` to the verified domain address, Redeploy.

## 5. Rate limit (Vercel Firewall)
The spec asks for 10 submits per IP per minute. The app already enforces this per server instance; add the global rule:
1. Firewall → **Configure** → **New Rule**.
2. If **Request Path** equals `/api/leads` and **Method** equals `POST`.
3. Then **Rate Limit**: fixed window 60 s, 10 requests, key IP, action 429.

At the booth all devices may share one public IP. The queue retries after a 429, so no lead is lost, but you can raise the limit to 30 for the event days.

## 6. Smoke test after each production deploy
1. Open `https://<your-domain>/?source=saas-north-2026-booth&kiosk=1` and submit a test lead named `TEST`, using an email address you can read.
2. Within a minute: the result email reaches that address, and the lead email reaches `EMAIL_TEAM_TO`. The footer shows no "queued" count.
3. Open `/staff`, sign in, check the count, and download the export: the test row is there.
4. Delete test rows in the Neon console SQL editor: `DELETE FROM leads WHERE first_name = 'TEST';`

## 7. Custom domain (optional)
Settings → Domains → add e.g. `calculator.aspenval.com` and create the CNAME shown. If DNS is late, the `*.vercel.app` URL works for the booth.

## Rollback
Deployments → pick the previous production deployment → **Promote / Instant Rollback**.

## Phase 2 (public website) changes
- Change the manifest `start_url` to `/` (`src/app/manifest.ts`).
- Add a privacy link in the footer.
- Consider Microsoft Entra ID single sign-on for staff instead of the shared password.
