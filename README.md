# Aspen SaaS Valuation Calculator

One-screen web calculator for the Aspen Valuations booth at SaaS North 2026 (Ottawa, Nov 4 to 5).
A founder enters ARR, a software category or industry, and contact details. Then:
- They get an indicative value range. It stays blurred until the lead form is valid.
- The lead is stored in Postgres, and is kept on the device if the booth Wi-Fi drops.
- The visitor gets their result by email, and the shared company inbox gets every lead.
- Staff export all leads to Excel.

Stack: Next.js 16 (App Router, TypeScript), plain CSS modules, Neon Postgres on Vercel, PGlite (embedded Postgres) for local development and tests, Resend for email, ExcelJS, Vitest, Playwright.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: set STAFF_PASSWORD and AUTH_SECRET to try the staff export
npm run dev                  # http://localhost:3000
```

No database setup is needed locally: without `DATABASE_URL` the app stores leads in `.data/pglite`.
Email is off locally unless the three Resend variables are set.

Useful URLs:
- `/`: public calculator.
- `/?source=saas-north-2026-booth&kiosk=1`: booth mode. It tags leads with the booth source, resets 2 minutes after a result, and shows the queued count and the staff link.
- `/staff`: staff sign in, lead count, Excel export.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (Vitest, real embedded Postgres) |
| `npm run test:e2e` | End-to-end tests (Playwright on the production build). First run: `npx playwright install chromium` |

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel (set by the Neon integration) | Postgres connection. Required on Vercel. |
| `STAFF_PASSWORD` | Vercel | Shared password for `/staff` and the export |
| `AUTH_SECRET` | Vercel | 32+ random characters, signs the staff session cookie |
| `RESEND_API_KEY` | Vercel | Resend API key. Required on Vercel. |
| `EMAIL_FROM` | Vercel | Sender on the domain verified in Resend, e.g. `Aspen Valuations <no-reply@aspenval.com>` |
| `EMAIL_TEAM_TO` | Vercel | Shared company inbox: gets every lead and the visitors' replies |

## Docs

- [Project overview](docs/project-overview-pdr.md)
- [System architecture](docs/system-architecture.md)
- [Codebase summary](docs/codebase-summary.md)
- [Code standards](docs/code-standards.md)
- [Design guidelines](docs/design-guidelines.md)
- [Deployment guide](docs/deployment-guide.md)
- [Booth setup checklist](docs/booth-setup-checklist.md)
- [Roadmap](docs/project-roadmap.md)

## Quarterly update

When SEG publishes new medians, edit `CATEGORY_MULTIPLES` and `SEG_PERIOD` in `src/config/valuation-config.ts`.
That is the only file to change; the fine print updates itself.
The private discount, size factors, industry tiers and 15% spread are Aspen choices; change them only with CBV sign-off.
