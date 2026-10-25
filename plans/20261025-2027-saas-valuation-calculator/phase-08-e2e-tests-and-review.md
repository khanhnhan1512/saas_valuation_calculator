# Phase 08: E2E tests + code review

## Context links
- [plan.md](plan.md) · spec "Acceptance tests", "Success criteria"
- `research/researcher-01-backend-stack-report.md` §5 (Playwright no-scroll, CI) · `research/researcher-02-frontend-kiosk-report.md` §1 (test matrix)
- Skills: `code-review`, `debugging`, `chrome-devtools`

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical (go/no-go gate) · Status: Not started · Review: Not reviewed
- Complete Playwright suite mapped 1:1 to spec acceptance tests; GitHub Actions CI; code-reviewer agent pass; real-device manual QA on iPad + laptop.

## Key Insights
- E2E runs without DB: intercept `/api/leads` with `page.route` (count unique ids, simulate offline/429). DB idempotency covered by route unit test + one manual check on Neon dev branch.
- `page.clock` (Playwright ≥1.45) fast-forwards idle timer and the 30s queue interval deterministically.
- Webkit project approximates iPad Safari; still do real-device pass (caret, keyboard, autofill, fullscreen).
- Env for `next start` in CI: `AUTH_SECRET=test`, `AUTH_TRUST_HOST=true`, `ALLOWED_EMAIL_DOMAIN=aspenval.com`; no DATABASE_URL.

## Requirements
Spec acceptance → test file:
| Acceptance | Test |
|---|---|
| Worked examples, 3,000,000 vs 2,999,999, every industry/category | `tests/unit/valuation-estimate.test.ts` (phase 02) |
| Error messages in order; phone format | `tests/e2e/calculator-flow.spec.ts` + unit |
| Offline submit unlocks; saved once on reconnect | `tests/e2e/offline-queue.spec.ts` |
| Export columns + formats | `tests/unit/export-workbook.test.ts` (phase 06) |
| No scroll at 4 sizes; reset 2 min after result | `tests/e2e/no-scroll-viewports.spec.ts`, `tests/e2e/idle-reset.spec.ts` |
| Staff-only endpoints | `tests/e2e/staff-access.spec.ts` |

## Architecture
```ts
// playwright.config.ts
webServer: { command: 'npm run build && npm run start', port: 3000, reuseExistingServer: !process.env.CI,
  env: { AUTH_SECRET: 'test-secret', AUTH_TRUST_HOST: 'true', ALLOWED_EMAIL_DOMAIN: 'aspenval.com' } },
projects: [ { name: 'chromium-1366', use: { viewport: { width: 1366, height: 768 } } },
            { name: 'webkit-ipad', use: { ...devices['iPad Pro 11 landscape'] } } ]
// no-scroll spec iterates sizes itself: [1024,768],[1366,768],[1920,1080],[2560,1440] (+[1366,650] informational, test.fail-soft)
async function assertNoScroll(page) {
  const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight,
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    clipped: [...document.querySelectorAll('[data-card]')].filter(c => c.scrollHeight > c.clientHeight + 1).length }));
  expect(m.sh).toBeLessThanOrEqual(m.ih); expect(m.sw).toBeLessThanOrEqual(m.iw); expect(m.clipped).toBe(0);
}
// states: locked, error shown, Other text open, unlocked (after submit)
```
```ts
// offline-queue.spec.ts
const ids = new Set<string>(); let online = false;
await page.route('/api/leads', r => online ? (ids.add(JSON.parse(r.request().postData()!).id), r.fulfill({ status: 200, json: { ok: true } }))
                                          : r.abort('internetdisconnected'));
await page.clock.install(); fill+submit → expect result unlocked; expect footer queued "1 queued" (kiosk=1)
online = true; await page.clock.fastForward('00:31') → expect ids.size === 1; queued 0
reload page → no extra POST (queue empty); also case: 429 first then 200 → still exactly 1 id
```
CI `.github/workflows/ci.yml`: on PR + push main → `npm ci` → `lint` → `typecheck` → `test` → `npx playwright install --with-deps chromium webkit` → `test:e2e`; upload report on failure.

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\playwright.config.ts | modify (env, projects) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\no-scroll-viewports.spec.ts | modify (all states) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\calculator-flow.spec.ts | modify (complete) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\offline-queue.spec.ts | create |
| D:\Downloads\saas_valuation_calculator\tests\e2e\idle-reset.spec.ts | create (move idle cases from flow spec) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\staff-access.spec.ts | create (`/api/export`, `/api/leads/count` → 401; `/staff` shows sign-in) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\test-helpers.ts | create (fillValidLead, assertNoScroll) |
| D:\Downloads\saas_valuation_calculator\.github\workflows\ci.yml | create |

## Implementation Steps
1. Helpers + finalize each spec per table; add `data-card` attributes to cards (phase 03 components).
2. Run locally both projects; fix failures at root (layout compaction, not `overflow:hidden` band-aids).
3. CI workflow; enable branch protection on `main` requiring CI.
4. Code review: run `code-reviewer` agent on full diff; checklist: numbers/copy only in config; files <200 lines; no `location.reload`; every staff route `requireStaff()`; no PII in logs; zod caps; no secrets; a11y (labels, aria-pressed, aria-live, contrast, 44px hit areas); Lighthouse perf (LCP <2s on Fast 3G-ish throttle) and CLS 0 on unlock.
5. Manual device QA (preview URL): iPad Safari + Home Screen app (caret in ARR/phone, keyboard types, autofill suggestions with device settings off, select popover, chips taps, Other box, offline relaunch, idle reset), laptop Chrome fullscreen at 1366x768, phone stacked layout.
6. Fix findings; re-run; commit `test: add e2e acceptance suite and ci` + `fix: ...` as needed.

## Todo list
- [ ] Test helpers + data-card hooks
- [ ] no-scroll (4 sizes × 4 states) green
- [ ] calculator-flow green (errors order, formatting, unlock, reset)
- [ ] offline-queue green (offline, 429, single save)
- [ ] idle-reset green (kiosk vs non-kiosk)
- [ ] staff-access 401 green
- [ ] CI workflow + branch protection
- [ ] code-reviewer pass, findings fixed
- [ ] Real iPad + laptop QA done

## Success Criteria
- All unit + E2E green in CI on main; every spec acceptance item has a passing test.
- Review has no open critical/high findings. Go/no-go for prod on Nov 2.

## Risk Assessment
- Webkit headless ≠ real iPad → mandatory manual pass.
- Flaky timing in queue tests → use `page.clock`, no real sleeps.
- 1024x768 failure found late → phase 03 smoke should have caught; escape hatch needs Q5 sign-off.

## Security Considerations
- Review OWASP basics: injection (parameterized), access control (401s tested), secrets (git grep for `postgres://`, `secret`), headers present, honeypot works, rate limit documented.
- CI has no secrets (no DB in E2E).

## Next steps
- Phase 09 production deploy after green CI.
