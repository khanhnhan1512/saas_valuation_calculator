# 01 – Spec + walkthrough video analysis

Sources: `SaaS_Valuation_Calculator_Technical_Specification.pdf` (16 pp, text in `00-spec-extracted.txt`), `calculator_walkthrough.mp4` (25.2s, 1366x768, 25fps). Repo is empty (greenfield) – no codebase docs to scout.

## Product in one line
One-screen Next.js page: founder enters ARR + category/industry + contact info → gets indicative valuation range (gated/blurred until lead form valid) → lead saved to Postgres (offline-safe) → staff export .xlsx. Client: Aspen Valuations, booth SaaS North 2026 (Ottawa, Nov 4–5 2026) = **hard deadline ~10 days from today (2026-10-25)**. Phase 2 = public on website.

## Screens (verified from 4 PDF screenshots @1366x768 + video)
- Header: logo "ASPEN VALUATIONS" (white, left), H1 "What is your **SaaS company** worth?" (teal span), subtitle, pill badge "SAAS VALUATION EXPERTS" (teal outline), square fullscreen icon button.
- Left col (1.05fr): Card Step 1 (badge "1"): big ARR input with teal "$" prefix + teal 2px border; log slider $250K–$50M with end labels; chips $1M $2M $5M $10M $25M; label "Software category or industry *" + native `<select>`.
- Card Step 2 (badge "2", hint right-aligned "to generate your ARR multiple"): row First/Last/Company (3 cols), row Email (2/3) + Phone (1/3, placeholder "(555) 555-5555"); "What is your next move? *" chips (2 rows, 8 chips); full-width teal button; single error line (#FF9B8F) centered under button.
- Right col (1fr): Result card (tall) – locked: lock icon in teal circle, "Your value range is ready to generate" / "Complete steps 1 and 2 to see it", over a **blurred live preview** (video shows blurred real numbers updating as ARR/category change). Unlocked: kicker, big "$7.8M to $10.5M" ("to" small/muted), basis line, range line, tiles heading, 4 tiles (big teal word + small muted desc), pill "Next visitor ↻".
- Aspen card: heading, paragraph (bold "Aspen Valuations"), 3 bullets, white-bg QR right with teal caption "Scan to book a free valuation call".
- Footer: fine print left (muted small), right "Staff: Export leads to Excel" (underlined) + "(1 saved)" count after save.
- Submitted state: button text "Multiple generated", darker/disabled teal; selected chip = filled teal, dark text.
- Range line example Healthcare $4M: axis labels 1.6x / 2.9x (formula check: low 1.9459, high 2.6328, pad 0.45×0.6869 → 1.637 / 2.942 ✓).

## Video timeline
0–3s ARR 5,000,000 → typed 4,000,000 (thousands format live). 5–7s native select opened: flat list, first option disabled placeholder "Choose a category", then Healthcare, Financial Services, Real Estate, Government, Retail, Energy, Life Sciences, Education, Hospitality, Manufacturing, Other industry, DevOps & IT Management, ERP & Supply Chain, … (rest cut; assume Table 1 order: Security, Financial Applications, Human Capital Management, Analytics & Data Management, Sales & Marketing, Communications & Collaboration, Other SaaS). No optgroups. 8–18s fill names/company/email/phone (auto-formats). 18s chip "Selling the business". 19s submit → unlock, footer "(1 saved)". 23–25s "Next visitor" → fade back to locked, ARR back to default 5,000,000, select empty.

## Valuation logic (exact)
- mid = CAT × 0.75 × size × (1+adj); low = mid×0.85; high = mid×1.15; value = round(multiple_unrounded × ARR).
- CAT: DevOps & IT Mgmt 5.3, ERP & Supply Chain 4.6, Security 4.4, Industry-specific 3.7, Financial Applications 3.4, HCM 3.2, Other SaaS 2.7, Analytics & Data Mgmt 2.5, Sales & Marketing 2.4, Comms & Collab 2.0.
- size: <1M .65, <3M .70, <7M .75, <15M .80, else .85 (boundary: 3,000,000→.75; 2,999,999→.70).
- adj (industry only): premium +10% (Healthcare, Financial Services); standard 0 (Real Estate, Government, Retail, Energy, Life Sciences); discount −10% (Education, Hospitality, Manufacturing, Other industry). Software categories: 0.
- Display: multiples 2dp ("2.29x"); money $1.24B / $9.2M (1dp) / $750K (0dp). Axis ends 1dp multiples.
- Acceptance: Healthcare $4M → 1.95/2.29/2.63x, $7.8M/$9.2M/$10.5M. Sales&Marketing $4M → mid 1.35x, $4.6M/$5.4M/$6.2M. Both verified by hand.
- All numbers in ONE config file (quarterly SEG update + fine print "SEG 2Q26").
- Ref impl note: category key `'Industry-specific'` ≠ Table 1 label "Any industry (see Table 3)". Data model: `category` = "Table 1 label", `industry` nullable. → when industry picked, store category = "Industry-specific", industry = name.

## Validation (order matters, one message)
1 ARR empty/0 → "Please enter your ARR in step 1." 2 no select → "Please choose your software category or industry in step 1." 3 any of first/last/company/email/phone blank → "Please fill in your first name, last name, company, email and phone number." 4 email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` → "Please check your email address." 5 phone ≠10 digits (strip leading 1) → "Please enter a 10 digit phone number." 6 no next move / Other w/o text → "Please choose your next move."
ARR: digits only, cap $5B (slider range $250K–$50M, but input can exceed). autocomplete="off" everywhere. Next move "Other" → inline text box, stored "Other: <text>".

## Storage / API
- Table `leads` (uuid id from browser, submitted_at, received_at default now(), names, email lower, phone formatted, company, next_move, arr bigint, category, industry null, low/mid/high_multiple numeric(5,2), low/mid/high_value bigint, source).
- POST /api/leads public, rate-limited 10/IP/min, honeypot, server recalculates, `ON CONFLICT (id) DO NOTHING`. GET /api/export (staff, xlsx, filters from/to/source, file `SaaS_North_Leads_YYYY-MM-DD.xlsx`, sheet "SaaS North Leads", oldest first). GET /api/leads/count (staff).
- Offline queue: localStorage single key; on fail still unlock; retry 30s + on load; delete only after server ack; show queued count near export link.
- Source: `?source=saas-north-2026-booth&kiosk=1`; default "website". Kiosk=1 enables 2-min idle reset (spec also says reset applies once result shown – treat as always-on? see questions).
- Auth: Entra ID SSO limited to aspenval.com; env DATABASE_URL, MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, AUTH_SECRET, ALLOWED_EMAIL_DOMAIN.

## Design tokens
bg #12302C + radial #1B4440→#0C2220; grid rgba(5,180,201,.06) 36px; card rgba(255,255,255,.045) border rgba(5,180,201,.38) r16; field rgba(0,0,0,.22) 1.5px r10; teal #05B4C9; teal text #3FD0E0; text #FFF / #C4D6D3 / #93AAA6; on-teal #062421; QR dark #1A322F; error #FF9B8F. Font DIN Next LT Pro → Arial/Helvetica, letter-spacing .012em, word-spacing .04em. Grid 1.05fr/1fr, max 1900px; size scale clamp(base, min(base×100vh/768, base×100vw/1366), base×1.5); <880px stack+scroll; <520px one field per row.

## Gaps / risks spotted
- Assets missing: Aspen white logo, DIN font licence, QR (can generate). → text-logo placeholder + Arial fallback.
- Blurred preview renders real numbers → visible in DevTools; fine for booth, weak gate for phase 2 web.
- Entra ID tenant/app registration needs client IT; may not be ready for booth → need fallback staff auth.
- iPad Safari Fullscreen API partial; PWA standalone + Guided Access is the real kiosk path.
- Workshop is "our company" per user; spec is branded Aspen – confirm branding/copy kept as-is.

## Unresolved questions
1. Keep Aspen branding/copy exactly, or rebrand to user's company?
2. Entra ID available now? Else shared staff password (env) for booth, Entra later?
3. Neon vs Supabase; Vercel/GitHub account + repo name; custom domain?
4. Idle reset: only with kiosk=1 or always?
5. Logo SVG + font files available?
