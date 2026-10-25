# Project overview (PDR)

## Goal
Give SaaS founders an indicative value range in under 60 seconds and capture them as leads for Aspen Valuations' marketing follow-up.

## Users
- **Booth visitors (phase 1):** founders at SaaS North 2026 using an Aspen iPad or laptop.
- **Website visitors (phase 2):** the same page, public on aspenval.com.
- **Aspen staff:** export leads to Excel.

## Scope
- In scope:
  - valuation range calculation
  - lead form with a gated (blurred) result
  - lead storage with an offline queue
  - Excel export
  - kiosk mode (full screen, idle reset, home-screen web app)
- Out of scope: formal valuations, visitor accounts, payments.

## Success criteria
- Result visible in under 60 seconds from the first tap.
- Every submitted lead stored exactly once, also when the booth Wi-Fi drops.
- The shown range always matches the formula. The server recalculates before saving.
- The whole flow fits one screen without scrolling, from 1024 x 768 to 2560 x 1440.

## Decisions (2026-10-25)
| Topic | Decision | Why |
|---|---|---|
| Database | Neon Postgres via the Vercel Marketplace; PGlite locally | SQLite cannot persist on Vercel serverless; PGlite keeps local setup at zero |
| Staff access | One shared `STAFF_PASSWORD` and a signed cookie, instead of Microsoft Entra ID | Simple for a workshop; still keeps lead data private |
| Locked preview | Blurs fixed sample numbers | The visitor's result is never readable before the form is submitted |
| Category stored for industries | `Industry-specific` and `industry = <name>` | Matches the spec reference implementation |

## Privacy and consent
- Leads are personal information (PIPEDA).
- Booth leads rely on implied consent from the in-person conversation (CASL).
- Any marketing emails need Aspen marketing sign-off.
- Exported spreadsheets contain personal data: keep them on Aspen-managed storage only.
