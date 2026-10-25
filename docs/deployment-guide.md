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

Redeploy after adding variables (Deployments → ⋯ → Redeploy).

## 4. Rate limit (Vercel Firewall)
The spec asks for 10 submits per IP per minute. The app already enforces this per server instance; add the global rule:
1. Firewall → **Configure** → **New Rule**.
2. If **Request Path** equals `/api/leads` and **Method** equals `POST`.
3. Then **Rate Limit**: fixed window 60 s, 10 requests, key IP, action 429.

At the booth all devices may share one public IP. The queue retries after a 429, so no lead is lost, but you can raise the limit to 30 for the event days.

## 5. Smoke test after each production deploy
1. Open `https://<your-domain>/?source=saas-north-2026-booth&kiosk=1` and submit a test lead named `TEST`.
2. Open `/staff`, sign in, check the count, and download the export: the test row is there.
3. Delete test rows in the Neon console SQL editor: `DELETE FROM leads WHERE first_name = 'TEST';`

## 6. Custom domain (optional)
Settings → Domains → add e.g. `calculator.aspenval.com` and create the CNAME shown. If DNS is late, the `*.vercel.app` URL works for the booth.

## Rollback
Deployments → pick the previous production deployment → **Promote / Instant Rollback**.

## Phase 2 (public website) changes
- Change the manifest `start_url` to `/` (`src/app/manifest.ts`).
- Add a privacy link in the footer.
- Consider Microsoft Entra ID single sign-on for staff instead of the shared password.
