# Project roadmap

## Phase 1: SaaS North booth (Nov 4 to 5, 2026)
| Item | Status |
|---|---|
| Valuation logic + config + unit tests (spec acceptance examples) | Done |
| One-screen UI matching the prototype, 1024 x 768 to 2560 x 1440 | Done |
| Ordered validation, formatting, gated result, reset, idle reset, full screen | Done |
| Lead API, Postgres storage, offline write-ahead queue | Done |
| Staff password, Excel export, lead count | Done |
| PWA manifest, icons, QR code, kiosk service worker | Done |
| E2E suite + CI | Done |
| Result email to the visitor, lead email to the shared company inbox (Resend) | Done |
| Vercel project, Neon database, Resend domain, env vars, firewall rule | To do (see deployment guide) |
| Real iPad dry run with the booth checklist (by Nov 3) | To do |

## Phase 2: public website
- Manifest `start_url` → `/`; privacy link in the footer.
- Staff single sign-on (Microsoft Entra ID) instead of the shared password.
- Brand font (DIN Next LT Pro) once the web licence is supplied.

## Maintenance
- Each quarter: update `CATEGORY_MULTIPLES` and `SEG_PERIOD` in `src/config/valuation-config.ts`.
