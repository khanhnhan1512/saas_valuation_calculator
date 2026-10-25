# Phase 09: Deploy to Vercel + docs + booth checklist

## Context links
- [plan.md](plan.md) · spec "Deployment", "Maintenance", "Privacy and consent", "Kiosk mode"
- `research/researcher-01-backend-stack-report.md` §2 (Entra redirect URIs), §4 (WAF) · `research/researcher-02-frontend-kiosk-report.md` §2, §4 (device settings)
- `C:\Users\User\.claude\workflows\documentation-management.md` · Skills: `devops`, `docs-seeker`

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical · Status: Not started · Review: Not reviewed
- Production deploy on Vercel (env vars, Neon prod, WAF rule, domain, Entra URIs), smoke test, project docs (README + 7 docs), booth setup + daily ops checklist, dry run Nov 3, code freeze.

## Key Insights
- Push to `main` = production deploy; PRs = previews (Neon preview branches optional).
- Spec booth URL: `https://<prod-host>/?source=saas-north-2026-booth&kiosk=1`.
- Device config beats code for autofill/QuickType leakage between visitors.
- Export from laptop/phone, not from iPad Home Screen app (Quick Look trap, separate cookies).
- Hobby plan prohibits commercial use and allows 1 WAF rate rule → Pro recommended (Q4).

## Requirements
- Functional: prod URL live with DB + staff auth; WAF rule active; docs complete; checklist printed for booth staff.
- Non-functional: no secrets in repo/docs; docs concise, accurate to code.

## Architecture
Env matrix (Vercel → Settings → Environment Variables):
| Var | Prod | Preview | Dev (.env.local) |
|---|---|---|---|
| DATABASE_URL | Neon main | Neon preview/dev branch | Neon dev branch |
| AUTH_SECRET | unique | unique | local |
| ALLOWED_EMAIL_DOMAIN | aspenval.com | aspenval.com | aspenval.com |
| MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET | if Entra ready | optional | optional |
| STAFF_PASSWORD | booth fallback (remove after Entra) | yes | yes |

Docs (`docs/`): project-overview-pdr.md (goal, users, scope, success criteria, phase 1/2), code-standards.md (finalize from phase 01), codebase-summary.md (tree + module roles), system-architecture.md (5 parts diagram: browser calc+queue → POST /api/leads → Postgres; staff → /api/export; data flow, offline queue states), design-guidelines.md (tokens, `--u`, base size table, breakpoints, a11y rules), deployment-guide.md (env, Neon schema, WAF, domain, Entra, quarterly SEG update steps), project-roadmap.md (phase 1 done items, phase 2 backlog). README.md: what, quick start, scripts, env, links.

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\README.md | create |
| D:\Downloads\saas_valuation_calculator\docs\project-overview-pdr.md | create |
| D:\Downloads\saas_valuation_calculator\docs\code-standards.md | modify (finalize) |
| D:\Downloads\saas_valuation_calculator\docs\codebase-summary.md | create |
| D:\Downloads\saas_valuation_calculator\docs\system-architecture.md | create |
| D:\Downloads\saas_valuation_calculator\docs\design-guidelines.md | create |
| D:\Downloads\saas_valuation_calculator\docs\deployment-guide.md | create (incl. booth checklist section, or link) |
| D:\Downloads\saas_valuation_calculator\docs\project-roadmap.md | create |
| D:\Downloads\saas_valuation_calculator\docs\booth-setup-checklist.md | create (printable, 1 page) |

## Implementation Steps
1. Vercel plan confirmed (Pro). Env vars per matrix. Functions region `iad1`.
2. Neon prod: schema applied; verify `SELECT count(*) FROM leads` = 0; delete test rows from earlier manual tests only on dev branch.
3. WAF: Firewall → Rules → New: path `/api/leads` + method POST → rate limit 10/60s per IP → 429 (event days: per Q4, e.g. 30). Optional rule `/api/auth/callback/credentials` 5/60s.
4. Domain: add `calculator.aspenval.com` in Vercel → Aspen IT adds CNAME `cname.vercel-dns.com`; wait for TLS. Fallback: use `*.vercel.app` URL for booth if DNS late.
5. Entra: add prod redirect URI; test sign-in with aspenval.com account and rejection of other tenant/domain.
6. Merge to main → prod deploy. Smoke: load booth URL; submit test lead (name "TEST"); staff count +1; export shows it; offline test on iPad; then mark/delete test lead (`DELETE FROM leads WHERE first_name='TEST'` via Neon console, documented).
7. Write docs + README (use `docs-manager` agent or `/docs:init`, then human-check accuracy).
8. Booth checklist (`docs/booth-setup-checklist.md`):
   - **iPad settings:** Safari → AutoFill: Contact Info OFF, Credit Cards OFF, Passwords autofill OFF; no "My Card"; Keyboard: Predictive OFF, Auto-Correction OFF, Reset Keyboard Dictionary (General → Transfer or Reset → Reset); Display: Auto-Lock Never; rotation lock landscape; Focus/Do Not Disturb ON; Low Power OFF; brightness high; latest iPadOS.
   - **Install app:** Safari → `https://<prod>/?source=saas-north-2026-booth&kiosk=1` → Share → Add to Home Screen → open from icon (no Safari UI). Never delete icon while "queued" > 0.
   - **Guided Access:** Settings → Accessibility → Guided Access ON, set passcode (staff only), triple-click top button inside app → disable hardware buttons except volume → Start.
   - **Verify:** submit test lead online (staff confirms count on laptop); Airplane mode → submit → "1 queued" → Airplane off → queue 0 within 30s; idle reset after 2 min; QR scans.
   - **Laptop:** Chrome guest/new profile, Settings → Autofill → Addresses/Payments OFF; open booth URL; fullscreen button or `chrome --kiosk "<booth URL>"`; screen sleep off.
   - **Network:** venue Wi-Fi + LTE hotspot backup; chargers/stand.
   - **Daily ops:** start of day: open app, queued 0; end of day: ensure queued 0 on every device (wait on hotspot if not), export from laptop `/staff` → save xlsx to Aspen drive, sign out; never clear browser data.
   - **Incident:** blank page offline → reconnect hotspot, relaunch; stuck queue → keep device on, contact dev; dev contact phone.
9. Dry run Nov 3 on real booth devices with full checklist; code freeze 18:00 Nov 3 (hotfix only via PR + preview + CI).
10. Commit `docs: add project docs, deployment guide and booth checklist`.

## Todo list
- [ ] Vercel Pro + env vars (prod/preview/dev)
- [ ] Neon prod schema verified
- [ ] WAF rule(s)
- [ ] Domain + TLS (or vercel.app fallback)
- [ ] Entra prod redirect + sign-in test (or STAFF_PASSWORD)
- [ ] Prod smoke incl. export + offline on iPad; test lead removed
- [ ] README + 7 docs + booth checklist
- [ ] Nov 3 dry run, code freeze
- [ ] (Phase 2 only) privacy link in footer, remove staff UI from public page, manifest start_url `/`, remove STAFF_PASSWORD, Better Auth review, real logo/font

## Success Criteria
- Booth URL works on iPad Home Screen app and laptop; leads tagged `saas-north-2026-booth`; staff export from laptop works.
- Docs exist and match code; checklist used in dry run without gaps.

## Risk Assessment
- DNS/Entra late → vercel.app URL + STAFF_PASSWORD fallback.
- Venue Wi-Fi blocks/captive portal → hotspot; queue covers outages.
- Last-minute deploy breaks booth → freeze; Vercel Instant Rollback to previous prod deployment documented.

## Security Considerations
- Secrets only in Vercel env; rotate STAFF_PASSWORD and AUTH_SECRET after event if shared widely.
- PIPEDA: region per Aspen approval; leads used only for business follow-up; CASL: marketing emails need Aspen sign-off (note in overview doc).
- Exported xlsx contains PII → store only on Aspen-managed drive; delete local copies.

## Next steps
- Event Nov 4–5: monitor Vercel logs + count. Post-event: phase-2 backlog; quarterly SEG update (`valuation-config.ts` + SEG_PERIOD).
