# Phase 02: Valuation core + config + unit tests

## Context links
- [plan.md](plan.md) · spec "Valuation logic", "Rounding and display", "Form fields and validation", "Content and copy" (`reports/00-spec-extracted.txt`)
- `reports/01-spec-and-video-analysis-report.md` (dropdown order, category key mismatch)
- `research/researcher-02-frontend-kiosk-report.md` §4 (phone, slider math), §5 (constant marker positions)

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical · Status: Not started · Review: Not reviewed
- Pure TS modules (no React, no DOM) for all numbers, copy, estimate, formatting, phone, validation, slider scale, range axis. Shared by client + server. Full Vitest coverage of spec acceptance tests.

## Key Insights
- Follow reference impl exactly: values from **unrounded** multiple, multiples rounded with `+x.toFixed(2)`.
- Hand-verified: Healthcare $4M → mid 2.289375 → 1.95/2.29/2.63x, values 7,783,875 / 9,157,500 / 10,531,125. Sales & Marketing $4M → 1.15/1.35/1.55x, 4,590,000 / 5,400,000 / 6,210,000.
- Table 1 label "Any industry (see Table 3)" ≠ ref key "Industry-specific". Assumed: dropdown never shows it; picking an industry ⇒ `category='Industry-specific'`, `industry=<name>` (constant `INDUSTRY_CATEGORY`, easy to change; question 9).
- Range markers always at 23.68% / 50% / 76.32% (low=0.85m, high=1.15m) → still compute generically.
- Money formatter must pick unit **after** rounding: 999,500 → "$1.0M" not "$1000K".
- Config split: `valuation-config.ts` (all numbers + category/industry labels + "SEG 2Q26" period; quarterly edit = this file only) and `site-copy.ts` (UI copy). Together = config module; each <200 lines.

## Requirements
- Functional: `estimate(arr, category, industry)`; `resolveSelection(label)`; `validateLead(values)` returns first error in spec order; `formatMoney`, `formatMultiple`, `formatArrInput`, `parseArrDigits` (cap 5e9); `formatPhoneInput`, `normalizePhoneDigits`; `arrToSlider/sliderToArr`; `rangeAxis(low, high)`.
- Non-functional: zero deps; deterministic; 100% branch coverage on valuation.

## Architecture
```ts
// src/config/valuation-config.ts (excerpt)
export const PRIVATE_DISCOUNT = 0.25, SPREAD = 0.15;
export const SEG_PERIOD = 'SEG 2Q26';
export const INDUSTRY_CATEGORY = 'Industry-specific';
export const CATEGORY_MULTIPLES = { 'DevOps & IT Management': 5.3, 'ERP & Supply Chain': 4.6, Security: 4.4,
  [INDUSTRY_CATEGORY]: 3.7, 'Financial Applications': 3.4, 'Human Capital Management': 3.2,
  'Analytics & Data Management': 2.5, 'Sales & Marketing': 2.4, 'Communications & Collaboration': 2.0,
  'Other SaaS': 2.7 } as const;
export const SOFTWARE_CATEGORIES = [/* Table 1 order minus industry row */ 'DevOps & IT Management','ERP & Supply Chain',
  'Security','Financial Applications','Human Capital Management','Analytics & Data Management',
  'Sales & Marketing','Communications & Collaboration','Other SaaS'] as const;
export const INDUSTRY_TIERS = { Healthcare:'premium','Financial Services':'premium','Real Estate':'standard',
  Government:'standard',Retail:'standard',Energy:'standard','Life Sciences':'standard',Education:'discount',
  Hospitality:'discount',Manufacturing:'discount','Other industry':'discount' } as const; // key order = dropdown order
export const TIER_ADJUSTMENT = { premium: 0.10, standard: 0, discount: -0.10 } as const;
export const SIZE_BANDS = [{ below: 1e6, factor: 0.65 }, { below: 3e6, factor: 0.70 }, { below: 7e6, factor: 0.75 },
  { below: 15e6, factor: 0.80 }, { below: Infinity, factor: 0.85 }];
export const ARR_MAX = 5e9, SLIDER_MIN = 250_000, SLIDER_MAX = 50_000_000, SLIDER_STEPS = 1000;
export const ARR_CHIPS = [1e6, 2e6, 5e6, 10e6, 25e6], ARR_PLACEHOLDER = '5,000,000';
export const AXIS_PAD = 0.45;
export const NEXT_MOVES = ['Raising capital','Selling the business','Shareholder buyout','Succession planning',
  'Tax or estate planning','409A or ESOP','Just exploring','Other'] as const;
export const SOURCES = { booth: 'saas-north-2026-booth', website: 'website' }, EVENT_TIMEZONE = 'America/Toronto';
export const CONTACT_URL = 'https://aspenval.com/ca/contact-us/';
```
```ts
// src/lib/valuation.ts
export function sizeFactor(arr: number) { return SIZE_BANDS.find(b => arr < b.below)!.factor; }
export function resolveSelection(label: string): { category: string; industry: string | null } | null
  // industry label → { category: INDUSTRY_CATEGORY, industry: label }; software label → { category: label, industry: null }
export function estimate(arr: number, category: Category, industry: Industry | null): Estimate {
  const adj = category === INDUSTRY_CATEGORY && industry ? TIER_ADJUSTMENT[INDUSTRY_TIERS[industry]] : 0;
  const mid = CATEGORY_MULTIPLES[category] * (1 - PRIVATE_DISCOUNT) * sizeFactor(arr) * (1 + adj);
  const lo = mid * (1 - SPREAD), hi = mid * (1 + SPREAD);
  return { lowMultiple: +lo.toFixed(2), midMultiple: +mid.toFixed(2), highMultiple: +hi.toFixed(2),
    lowValue: Math.round(lo * arr), midValue: Math.round(mid * arr), highValue: Math.round(hi * arr),
    rawLow: lo, rawMid: mid, rawHigh: hi };            // raw for the axis
}
export function rangeAxis(lo: number, hi: number) {
  const pad = AXIS_PAD * (hi - lo), min = Math.max(0, lo - pad), max = hi + pad;
  const pct = (m: number) => ((m - min) / (max - min)) * 100;
  return { min, max, lowPct: pct(lo), midPct: pct((lo + hi) / 2 /* = mid */), highPct: pct(hi) };
}
```
Note: midpoint marker uses `rawMid` (equals (lo+hi)/2 since spread symmetric).
```ts
// src/lib/formatters.ts
formatMoney(v): v>=~1e9 → `$${(v/1e9).toFixed(2)}B`; M → 1 dp; K → 0 dp; <1000 → `$${Math.round(v)}`
  // choose unit by rounded result: if round(v/1e3) >= 1000 → M; if (round(v/1e5)/10) >= 1000 → B
formatMultiple(m) = `${m.toFixed(2)}x`; formatAxisMultiple(m) = `${m.toFixed(1)}x`
parseArrDigits(text) = Math.min(Number(text.replace(/\D/g,'') || NaN), ARR_MAX) | null
formatArrInput(n) = new Intl.NumberFormat('en-US').format(n)
// src/lib/phone-format.ts
normalizePhoneDigits(raw): d = raw.replace(/\D/g,''); if (d[0]==='1') d = d.slice(1); return d
formatPhoneInput(raw): d = normalizePhoneDigits(raw).slice(0,10); progressive "(ddd", "(ddd) ddd", "(ddd) ddd-dddd"
  // add ") " / "-" only when a following digit exists (backspace never sticks)
// src/lib/lead-validation.ts
validateLead(v: LeadFormValues): string | null   // order: arr, selection, required5, email, phone, nextMove
normalizeLead(v) → { firstName.trim, lastName.trim, company.trim, email.trim().toLowerCase(), phone: formatted,
  nextMove: v.nextMove === 'Other' ? `Other: ${v.nextMoveOther.trim()}` : v.nextMove }
// src/lib/arr-slider-scale.ts
sliderToArr(t) = snap(exp(lnMin + t/STEPS*(lnMax-lnMin)))  // snap <1M→10K, <10M→50K, else 250K
arrToSlider(v) = round(STEPS*(ln(clamp(v,MIN,MAX))-lnMin)/(lnMax-lnMin))
```
Email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` exported from config. Error strings live in `site-copy.ts` (`ERRORS`).

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\src\config\valuation-config.ts | create |
| D:\Downloads\saas_valuation_calculator\src\config\site-copy.ts | create (all spec copy incl. ERRORS, tiles, Aspen card, fine print template using SEG_PERIOD) |
| D:\Downloads\saas_valuation_calculator\src\lib\valuation.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\formatters.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\phone-format.ts | create |
| D:\Downloads\saas_valuation_calculator\src\lib\lead-validation.ts | create (types `LeadFormValues`) |
| D:\Downloads\saas_valuation_calculator\src\lib\arr-slider-scale.ts | create |
| D:\Downloads\saas_valuation_calculator\vitest.config.ts | create (`environment:'node'`, alias `@`→`src`, include `tests/unit/**`) |
| D:\Downloads\saas_valuation_calculator\tests\unit\valuation-estimate.test.ts | create |
| D:\Downloads\saas_valuation_calculator\tests\unit\formatters.test.ts | create |
| D:\Downloads\saas_valuation_calculator\tests\unit\phone-format.test.ts | create |
| D:\Downloads\saas_valuation_calculator\tests\unit\lead-validation.test.ts | create |
| D:\Downloads\saas_valuation_calculator\tests\unit\arr-slider-scale.test.ts | create |

## Implementation Steps
1. Write `valuation-config.ts` exactly as above; types derived (`type Category = keyof typeof CATEGORY_MULTIPLES`, `type Industry = keyof typeof INDUSTRY_TIERS`). Export `DROPDOWN_OPTIONS = [...Object.keys(INDUSTRY_TIERS), ...SOFTWARE_CATEGORIES]` (20 items, spec order).
2. Write `site-copy.ts` copy verbatim from spec "Content and copy" (no hyphens/long dashes in body text); `finePrint` built from `SEG_PERIOD`.
3. Implement `valuation.ts`, `formatters.ts`, `phone-format.ts`, `arr-slider-scale.ts`, `lead-validation.ts` per Architecture.
4. `vitest.config.ts` with `resolve.alias`.
5. Tests (`it.each` tables):
   - worked examples: exact multiples + exact dollar values (numbers in Key Insights) + formatted "$7.8M", "$9.2M", "$10.5M", "2.29x".
   - boundaries: 999,999→0.65, 1,000,000→0.70, 2,999,999→0.70, **3,000,000→0.75**, 6,999,999→0.75, 7e6→0.80, 15e6→0.85.
   - each of 11 industries: mid = 3.7×0.75×size×(1+tier adj); each of 9 categories: own multiple, adj 0 (even if an industry passed).
   - `DROPDOWN_OPTIONS` length 20, first "Healthcare", 12th "DevOps & IT Management".
   - axis: Healthcare $4M → `formatAxisMultiple(min)`="1.6x", max="2.9x"; pcts ≈ 23.68/50/76.32.
   - formatMoney: 750000→"$750K", 9157500→"$9.2M", 1_240_000_000→"$1.24B", 999_499→"$999K", 999_500→"$1.0M", 999_949_999→"$999.9M", 999_950_000→"$1.00B".
   - phone: "6474515164"→"(647) 451-5164"; "16474515164"→same; "647"→"(647"; "6474"→"(647) 4"; digits=9 → invalid.
   - validation order: build fully valid object, then break fields cumulatively from last to first; assert each message in order 1..6; "Other" with blank text → msg 6; email "a@b" → msg 4.
   - slider: round-trip 1M/5M/25M within snap; >50M → 1000; <250K → 0.
6. `npm test` green; commit `feat(valuation): add config, estimate, formatters, validation with tests`.

## Todo list
- [ ] valuation-config.ts + site-copy.ts
- [ ] valuation.ts (estimate, sizeFactor, resolveSelection, rangeAxis)
- [ ] formatters.ts, phone-format.ts, arr-slider-scale.ts
- [ ] lead-validation.ts (validateLead, normalizeLead, types)
- [ ] vitest config + 5 test files green

## Success Criteria
- All spec acceptance items for logic pass: both worked examples exact, 3,000,000 vs 2,999,999, every industry/category.
- Only `src/config/*` contains numeric constants or copy (grep check in review).

## Risk Assessment
- Float drift (e.g. 2.2893750000000003) → only affects rounding at .xx5 edges; matching ref impl `toFixed` keeps parity with spec. Tests lock behavior.
- Category key decision may change (Q9) → isolated to `INDUSTRY_CATEGORY` constant.

## Security Considerations
- Same functions run on server (phase 05) → stored values never trust client numbers.
- No PII in this layer.

## Next steps
- Phase 03 uses `site-copy.ts`; phase 04 uses validation/formatters; phase 05 reuses estimate + normalizeLead server-side.
