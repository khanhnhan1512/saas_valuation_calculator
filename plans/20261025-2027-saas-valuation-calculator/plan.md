# Plan: SaaS Valuation Calculator (Aspen, SaaS North 2026 booth)

Created 2026-10-25. Hard deadline: booth Nov 4–5 2026 (Ottawa). Phase 1 = booth; phase 2 = public on aspenval.com.

## Goal
One-screen Next.js page: founder enters ARR + category/industry + contact → gated indicative value range unlocks → lead stored once in Postgres (offline-safe) → staff export .xlsx. Fits 1024x768 to 2560x1440 with no scroll. Deploy on Vercel via GitHub.

## Stack (decided)
- Next.js App Router + TS (latest stable, verify), one app on Vercel; plain CSS (tokens + CSS modules, `--u` viewport unit). No Tailwind/UI kit/chart lib.
- `src/config/` = single source for numbers (`valuation-config.ts`) + copy (`site-copy.ts`); pure `src/lib/valuation.ts` shared client/server.
- Neon Postgres (Vercel Marketplace) + `@neondatabase/serverless` raw SQL + `db/schema.sql`; zod; `ON CONFLICT (id) DO NOTHING`.
- Auth.js v5 (exact pin) Entra ID (tenant issuer + domain check) + optional Credentials (`STAFF_PASSWORD`); each route calls `auth()`.
- ExcelJS export (Node runtime); `/api/leads/count`.
- Vercel WAF rate limit + honeypot; localStorage write-ahead queue, sequential flush, 30s/load/online retry.
- PWA manifest, build-time SVG QR (`qrcode`), fullscreen button, idle reset (kiosk=1), kiosk-only tiny SW.
- Vitest (logic/API/export) + Playwright (no-scroll, flow, offline, idle).

## Phases
| # | Phase | Target | Status | Progress |
|---|---|---|---|---|
| 01 | [Project setup & repo](phase-01-project-setup-and-repo.md) | Oct 25 | Not started | 0% |
| 02 | [Valuation core + config + unit tests](phase-02-valuation-core-config-and-unit-tests.md) | Oct 25–26 | Not started | 0% |
| 03 | [Layout & design system (static UI)](phase-03-layout-and-design-system.md) | Oct 26–27 | Not started | 0% |
| 04 | [Calculator interactions, validation, result, reset/idle/fullscreen](phase-04-calculator-interactions-and-result.md) | Oct 27–28 | Not started | 0% |
| 05 | [Lead API + DB schema + offline queue](phase-05-lead-api-db-and-offline-queue.md) | Oct 29 | Not started | 0% |
| 06 | [Staff auth + Excel export + count](phase-06-staff-auth-export-and-count.md) | Oct 30 | Not started | 0% |
| 07 | [PWA/kiosk + QR](phase-07-pwa-kiosk-and-qr.md) | Oct 31 | Not started | 0% |
| 08 | [E2E tests + code review](phase-08-e2e-tests-and-review.md) | Nov 1 | Not started | 0% |
| 09 | [Deploy + docs + booth checklist](phase-09-deploy-docs-and-booth-checklist.md) | Nov 2–3 | Not started | 0% |

Overall: 0/9 phases. Critical path: 01→02→03→04→05→08→09 (06, 07 can overlap 05 if two devs).

## Timeline vs Nov 4
- Oct 25–28: setup, logic, UI, interactions (UI no-scroll test at 1024x768 runs from phase 03, not deferred).
- Oct 29–31: persistence, staff, kiosk. Oct 28 = DB region decision deadline.
- Nov 1: E2E + review. Nov 2: prod deploy + docs. Nov 3: iPad/laptop dry run, code freeze 18:00.
- Nov 4–5: event (hotfix only via PR + preview). After event: phase-2 items.

## Key dependencies (external)
- Aspen: region approval (US vs Canada) before DB creation; Entra app registration (else STAFF_PASSWORD fallback); white logo SVG, DIN font licence; domain DNS (calculator.aspenval.com).
- Accounts: GitHub (private repo), Vercel (Pro recommended: commercial use + WAF), Neon via Vercel Marketplace.
- Booth hardware: iPad(s) landscape, laptop, LTE hotspot backup.

## Phase-2-only (deferred, tracked in phases 04/06/07/09)
Privacy link in footer; export/staff link fully off public page; manifest start_url `/`; Better Auth migration review; real logo/font swap if late.

## Unresolved questions
1. Branding: keep Aspen brand/copy exactly (assumed) or rebrand to user's company?
2. Data residency: Neon us-east-1 OK (assumed) or Canada-only (Supabase ca-central-1)? Must decide before DB creation (Oct 28).
3. Entra ID tenant + app registration ready by Oct 30? Else STAFF_PASSWORD fallback OK for booth (assumed yes)?
4. Booth NAT: all iPads share one IP; raise WAF limit to ~30/min during event or exempt venue IP? Vercel plan Hobby vs Pro?
5. Short viewports (laptop browser ~1366x650, iPad web app 1024x748): may `--u` drop below base, or must fit at base?
6. Idle reset only with kiosk=1 (assumed) or always? Also reset idle mid-form (PII left on screen)?
7. Booth runtime: Home Screen web app (assumed; separate storage) vs Safari + fullscreen; kiosk-only service worker OK?
8. Locked preview: blur fixed sample (assumed; no DevTools leak) vs live visitor numbers like prototype video?
9. Stored `category` when industry picked: "Industry-specific" (ref impl, assumed) vs "Any industry (see Table 3)"; xlsx Submitted as real Excel date Toronto time (assumed) vs text?
10. QR: plain contact URL (assumed) or UTM-tagged; who owns DNS for production subdomain?
