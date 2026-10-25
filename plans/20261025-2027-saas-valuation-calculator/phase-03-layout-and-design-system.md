# Phase 03: Layout & design system (static UI)

## Context links
- [plan.md](plan.md) · spec "Design system", "Layout", "Content and copy", "Accessibility"
- Screens: `reports/screens/01-locked.jpg`, `03-unlocked.jpg`, `04-validation.jpg` (1366x768 @2x)
- `research/researcher-02-frontend-kiosk-report.md` §1 (`--u`, no-scroll grid), §5 (blur lock, range line)
- Skills: `frontend-design`, `aesthetic`, `chrome-devtools` (screenshot compare)

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical · Status: Not started · Review: Not reviewed
- Build all visual components as presentational (props in, no state logic) matching screenshots pixel-close at 1366x768; tokens + `--u` scale; responsive stack <880px. Locked + unlocked states render from props. Includes early no-scroll Playwright smoke at 1024x768.

## Key Insights
- `--u` floor = 1px ⇒ at 1024x768 sizes equal 1366x768 but columns ~25% narrower → chips/text wrap more → main overflow risk. Need compaction rules for 880–1279px width (page padding, gaps, chip padding), verified by test now, not phase 08.
- Prototype base sizes ≈ screenshot px × 0.683 (2732→1366 then /2). Table below.
- Inputs <16px font trigger iOS focus zoom → field font 16 base.
- Chips are 28px tall visually at base (<44px touch rule) → enlarge hit area with `::after{inset:-8px 0}` (no visual change).
- Blur lock: always render unlocked markup with **fixed sample data** (not visitor numbers) blurred, `aria-hidden` + `inert`; overlay lock layer absolute → zero layout shift.
- Range line: CSS only, absolute markers at `left:%`; `tabular-nums` on money.
- Logo/font assets missing → text/SVG placeholder "ASPEN VALUATIONS"; font stack `"DIN Next LT Pro", Arial, Helvetica, sans-serif`.

## Requirements
- Functional: header, step 1 card, step 2 card, result card (locked/unlocked), Aspen card (QR slot white tile 116 base, filled in phase 07), footer (fine print + staff slot).
- Non-functional: no scroll ≥880px from 1024x768 to 2560x1440; max-width 1900px; WCAG AA contrast; visible labels; same palette both color schemes (`color-scheme: dark`).

## Architecture
Tokens + scale (`src/app/globals.css`):
```css
:root{
  --u: clamp(1px, min(100vh / 768, 100vw / 1366), 1.5px);
  --bg:#12302C; --bg-a:#1B4440; --bg-b:#0C2220; --grid:rgba(5,180,201,.06);
  --card:rgba(255,255,255,.045); --card-border:rgba(5,180,201,.38); --field:rgba(0,0,0,.22);
  --teal:#05B4C9; --teal-text:#3FD0E0; --text:#fff; --muted:#C4D6D3; --faint:#93AAA6;
  --on-teal:#062421; --qr-dark:#1A322F; --error:#FF9B8F;
  --font:"DIN Next LT Pro", Arial, Helvetica, sans-serif; color-scheme: dark;
}
@supports (height:100dvh){ :root{ --u: clamp(1px, min(100dvh / 768, 100vw / 1366), 1.5px); } }
body{ background: linear-gradient(var(--grid) 1px,transparent 1px) 0 0/36px 36px,
  linear-gradient(90deg,var(--grid) 1px,transparent 1px) 0 0/36px 36px,
  radial-gradient(circle at 0 0,var(--bg-a),var(--bg-b)) var(--bg);
  font-family:var(--font); letter-spacing:.012em; word-spacing:.04em; color:var(--text); }
```
Grid (`calculator-layout.module.css`):
```css
@media (min-width:880px){
  body{height:100dvh;overflow:hidden}
  .page{height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-width:1900px;margin-inline:auto;
        padding:calc(14*var(--u)) var(--pad-x)}
  .cols{display:grid;grid-template-columns:1.05fr 1fr;gap:calc(21*var(--u));min-height:0}
  .col{display:grid;grid-template-rows:auto minmax(0,1fr);gap:calc(11*var(--u));min-height:0}
}
@media (min-width:880px) and (max-width:1279.98px){ :root{ --pad-x:16px } /* + chip/gap compaction */ }
@media (max-width:879.98px){ .cols{grid-template-columns:1fr} }       /* stacked, scroll allowed */
@media (max-width:519.98px){ .fieldRow{grid-template-columns:1fr} }
```
Base sizes (px at 1366x768; use `calc(N*var(--u))`; borders 1/1.5px and grid 36px stay fixed):
| Token | Base | Token | Base |
|---|---|---|---|
| title | 28 | ARR input h / font | 44 / 22 |
| subtitle | 14 | field h / font | 35 / 16 |
| step heading | 15 | chip h / font | 28 / 13 |
| label | 12.5 | button h / font | 41 / 16 |
| range headline | 40 | kicker / tiles heading | 11.5 (caps, tracking .12em) |
| tile big / desc | 20 / 10.5 | fine print | 10.5 |
| card pad / radius | 14 / 16 | field radius | 10 |
| col gap / card gap | 21 / 11 | QR tile | 116 |
Escape hatch (only if 1024x768 still overflows after compaction; needs sign-off Q5): `@media (min-width:880px) and (max-height:740px){:root{--u:clamp(.82px,min(100dvh/768,100vw/1366),1.5px)}}`.

Range line (`value-range-line.module.css`): `.track{position:relative;height:calc(10*var(--u));border-radius:999px;background:rgba(255,255,255,.08)}` `.band{position:absolute;left:var(--lo);right:calc(100% - var(--hi));background:linear-gradient(90deg,var(--teal),var(--teal-text))}` `.marker{position:absolute;left:var(--x);transform:translateX(-50%)}` mid marker taller + brighter; labels `white-space:nowrap`.

Component tree (server unless noted):
```
app/page.tsx ── <CalculatorApp aspenCard={<AspenCard/>}/>  (client shell, phase 04 state)
  site-header.tsx (aspen-logo.tsx, badge, fullscreen-button.tsx [client, phase 04])
  arr-step-card.tsx (arr-input.tsx, arr-log-slider.tsx, chips, category-select.tsx)
  lead-form-card.tsx (ui/text-field.tsx ×5, next-move-chips.tsx, submit button, error line)
  result-card.tsx (result-locked-overlay.tsx, value-range-line.tsx, aspen-tiles.tsx, Next visitor)
  aspen-card.tsx (QR slot) · site-footer.tsx (fine print, staff slot)
```

## Related code files
All under D:\Downloads\saas_valuation_calculator\src\ — action create (layout.tsx/page.tsx/globals.css modify).
| Path | Purpose |
|---|---|
| app\layout.tsx (modify) | `<html lang="en-CA">`, metadata title/description, viewport (width=device-width, themeColor #12302C) |
| app\globals.css (modify) | tokens, `--u`, reset, background, `.sr-only`, focus ring, `touch-action:manipulation` |
| app\page.tsx (modify) | renders CalculatorApp with static sample props for now |
| components\calculator\calculator-app.tsx + calculator-layout.module.css | grid shell |
| components\layout\site-header.tsx + site-header.module.css, aspen-logo.tsx, site-footer.tsx + site-footer.module.css |
| components\calculator\arr-step-card.tsx, arr-input.tsx, arr-log-slider.tsx, category-select.tsx, lead-form-card.tsx, next-move-chips.tsx + form-controls.module.css, step-cards.module.css |
| components\ui\text-field.tsx, chip-button.tsx | label+input, `aria-pressed` chip |
| components\result\result-card.tsx, result-locked-overlay.tsx, aspen-tiles.tsx + result-card.module.css |
| components\result\value-range-line.tsx + value-range-line.module.css |
| components\aspen\aspen-card.tsx + aspen-card.module.css |
| D:\Downloads\saas_valuation_calculator\playwright.config.ts | create (webServer build+start, projects per viewport) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\no-scroll-viewports.spec.ts | create (smoke now; extended phase 08) |

## Implementation Steps
1. globals.css tokens + `--u` + background + base element styles; `font-variant-numeric:tabular-nums` util.
2. Layout grid module + compaction media query for 880–1279px.
3. Header: logo placeholder (SVG text, letter-spaced, Λ for middle A like screenshot), H1 with `<span>` teal "SaaS company", subtitle, outline pill badge, square icon button slot.
4. Step 1 card: numbered badge, heading, ARR field (`$` teal prefix, 2px teal border), range input styled (`appearance:none`, thumb ≥ 24 visual, 44 hit via padding), end labels $250K/$50M, 5 chips, label "Software category or industry *" + native select with custom caret.
5. Step 2 card: header row with right hint; rows First/Last/Company (3 cols), Email (2fr) + Phone (1fr, placeholder "(555) 555-5555"); next-move chip group (`role="group"` + aria-labelledby) with reserved inline slot after "Other" for text box; full-width teal button; fixed-height error line (`min-height` 1 line) so errors never shift layout.
6. Result card: kicker, headline "$7.8M <small>to</small> $10.5M", basis line, range line, tiles heading, 4 tiles, "Next visitor ↻" pill. Locked: same markup with `SAMPLE_ESTIMATE` blurred (`filter:blur(calc(8*var(--u)))`, `inert`, `aria-hidden`) + absolute overlay (lock icon circle, two lines). Persistent `<p aria-live="polite" class="sr-only">`.
7. Aspen card: heading, paragraph (bold "Aspen Valuations"), 3 bullets, right white rounded QR tile placeholder + teal caption.
8. Footer: fine print left (from site-copy), right slot (empty for now).
9. Stack layout <880px, one field per row <520px.
10. Playwright config + smoke spec: load `/` at 1024x768, 1366x768, 1920x1080, 2560x1440; assert `scrollHeight<=innerHeight` and `scrollWidth<=innerWidth`. Locked state only here (no preview flags, YAGNI); unlocked state is reached by submitting the form in phase 04/08 tests. Meanwhile check unlocked layout manually by passing sample props in `page.tsx`.
11. Visual check vs screenshots with `chrome-devtools` at 1366x768; tune base sizes.
12. Commit `feat(ui): add design tokens, layout and static calculator components`.

## Todo list
- [ ] Tokens, `--u`, background grid
- [ ] Layout grid + compaction + stacked breakpoints
- [ ] Header, step 1, step 2 cards
- [ ] Result card locked/unlocked + range line + tiles
- [ ] Aspen card (QR slot), footer
- [ ] Playwright config + locked no-scroll smoke green at 4 viewports
- [ ] Screenshot compare at 1366x768

## Success Criteria
- Side-by-side with `01-locked.jpg`/`03-unlocked.jpg` visually matches at 1366x768.
- No scroll at 1024x768 … 2560x1440 (locked); stacked scrolling layout at 820x1180.
- Every component file <200 lines; CSS uses tokens only (no raw hex outside globals.css).

## Risk Assessment
- 1024x768 overflow (high): compaction rules; then escape hatch with sign-off.
- Real browser viewport smaller than screen (Chrome on 1366x768 laptop ≈ 650 tall): booth laptop runs fullscreen/kiosk; document in booth checklist; test 1366x650 informational.
- Native select styling differs per OS → accept native popup, style closed state only.

## Security Considerations
- Sample blurred data is static → no visitor data leaked in DOM before submit.
- No external fonts/scripts (privacy, load speed).

## Next steps
- Phase 04 wires state into these components. Phase 07 fills QR slot. Swap logo/font when Aspen delivers (`aspen-logo.tsx`, `@font-face` via `next/font/local`).
