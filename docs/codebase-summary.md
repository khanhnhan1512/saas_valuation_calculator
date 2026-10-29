# Codebase summary

```
src/
  config/valuation-config.ts   all numbers and labels (multiples, size bands, tiers, chips, limits)
  config/site-copy.ts          all visible copy and validation messages
  config/email-copy.ts         visitor result email and team lead email copy
  lib/valuation.ts             estimate(), sizeFactor(), resolveSelection(), rangeAxis()
  lib/formatters.ts            money ($9.2M), multiples (2.29x), ARR input parsing
  lib/phone-format.ts          (xxx) xxx-xxxx formatting, 10 digit check
  lib/lead-validation.ts       ordered form validation + normalizeContact()
  lib/arr-slider-scale.ts      log slider $250K to $50M
  lib/caret-format.ts          keeps the caret in place while formatting inputs
  lib/lead-queue-storage.ts    localStorage write-ahead queue
  lib/lead-queue-sync.ts       sequential sending and retry loop
  lib/lead-intake.ts           POST /api/leads logic (zod, honeypot, recalculation, insert, email delivery)
  lib/lead-emails.ts           builds the visitor and team emails (HTML + text, escaped)
  lib/mailer.ts                Resend client, outcome mapping (sent / rejected / retry), env setup
  lib/smtp-mailer.ts           SMTP alternative (nodemailer), e.g. Gmail for a demo
  lib/db.ts                    Neon or PGlite adapter + schema
  lib/leads-repository.ts      insert, export list, count (time-zone aware filters)
  lib/export-workbook.ts       ExcelJS workbook, Toronto wall-clock dates, file name
  lib/staff-session.ts         password check + signed cookie; lib/require-staff.ts guards routes
  lib/rate-limit.ts            per-instance fixed window limiter (backstop to the Vercel Firewall)
  hooks/                       calculator state, kiosk params, idle reset, queue, staff count, SW
  components/calculator/       app shell, step 1 (ARR) card, step 2 (lead form) card
  components/result/           result card (locked/unlocked), range line
  components/aspen/            Aspen card with build-time QR code
  components/layout/           header, fullscreen button, footer, page grid
  app/                         page, layout, manifest, staff page + actions, API routes
public/sw.js                   kiosk-only service worker
tests/unit/                    Vitest (logic, API with real PGlite, export, sessions)
tests/e2e/                     Playwright (flow, layout, offline, staff, idle reset)
```
