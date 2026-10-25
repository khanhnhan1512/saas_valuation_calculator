# Phase 04: Calculator interactions, validation, result, reset/idle/fullscreen

## Context links
- [plan.md](plan.md) · spec "User flow and screens", "Form fields and validation", "Kiosk mode", "Accessibility"
- `reports/01-spec-and-video-analysis-report.md` (video timeline: placeholder 5,000,000, reset behavior)
- `research/researcher-02-frontend-kiosk-report.md` §2 (fullscreen), §4 (slider, caret, phone, autofill), §6 (idle reset)
- Phase 02 libs, phase 03 components

## Overview
- Date: 2026-10-25 · Priority: P0 booth-critical · Status: Not started · Review: Not reviewed
- Client state for the whole page: ARR text/slider/chips sync, select, lead fields, next move + Other, ordered validation, submit → unlock snapshot result, "Next visitor" reset, 2-min idle reset (kiosk=1), fullscreen toggle, URL params (source, kiosk). Persistence hook point for phase 05.

## Key Insights
- Single source of truth `arr: number | null`; text and slider derived. Start `null` (placeholder "5,000,000", slider thumb at 500 visual) → submit without typing ⇒ error 1 (matches prototype).
- Controlled formatted inputs jump caret on iOS → helper keeps caret after same digit count.
- After submit: result = **snapshot** of submitted values; form controls disabled (`<fieldset disabled>` styled to keep normal look); button "Multiple generated" disabled until reset (assumption, spec says disabled until reset).
- Reset never reloads page (offline relaunch = blank page risk) and never touches queue; bump `formKey` to remount DOM (kills autofill residue).
- Idle timer: timestamp check every 1s survives throttled timers; armed only `unlocked && kiosk` (Q6).
- Read `source`/`kiosk` from `window.location.search` in effect → page stays statically prerendered (no `useSearchParams` Suspense).
- Autofill: `autocomplete="off"` per spec + non-semantic `name`/`id` (`f1`…`f5`) + `<form autoComplete="off">`; real fix is device config (booth checklist).

## Requirements
- Functional: all spec field rules; one error line under button, first failing rule only, cleared on next valid submit; chips `aria-pressed`; result region polite announcement; fullscreen button hidden when unsupported or standalone.
- Non-functional: result visible <60s from first tap; no layout shift on unlock/error; inputs never zoom on iOS.

## Architecture
```ts
// src/hooks/use-calculator-state.ts  (useReducer)
type State = { values: LeadFormValues; error: string | null; result: Estimate | null; formKey: number };
actions: setArr(n|null) | setField(name, value) | setNextMove(label) | fail(msg) | unlock(estimate) | reset
// src/components/calculator/calculator-app.tsx (client)
const { source, kiosk } = useKioskParams();               // {source: slug|'website', kiosk: boolean}
function onSubmit(e) {
  e.preventDefault();
  const msg = validateLead(values); if (msg) return dispatch(fail(msg));
  const sel = resolveSelection(values.selection)!;
  const est = estimate(values.arr!, sel.category, sel.industry);
  dispatch(unlock(est));
  onLeadSubmitted?.(values, source);                       // phase 05: enqueue + flush
}
const reset = useCallback(() => { (document.activeElement as HTMLElement)?.blur?.(); dispatch({type:'reset'}); scrollTo(0,0); }, []);
useIdleReset({ enabled: !!result && kiosk, timeoutMs: IDLE_RESET_MS, onIdle: reset });
```
```ts
// src/hooks/use-idle-reset.ts
useEffect(() => { if (!enabled) return; let last = Date.now();
  const bump = () => { last = Date.now(); };
  const evs = ['pointerdown','keydown','input','wheel'];
  evs.forEach(e => addEventListener(e, bump, { capture: true, passive: true }));
  const check = () => { if (Date.now() - last >= timeoutMs) onIdle(); };
  const t = setInterval(check, 1000); document.addEventListener('visibilitychange', check);
  return () => { clearInterval(t); evs.forEach(e => removeEventListener(e, bump, { capture: true })); document.removeEventListener('visibilitychange', check); };
}, [enabled, timeoutMs, onIdle]);
```
```ts
// src/hooks/use-caret-preserving-format.ts
onChange(e): digitsLeft = count digits in value.slice(0, selectionStart); next = format(value);
  setValue(next); requestAnimationFrame(() => el.setSelectionRange(pos, pos)) // pos = index after digitsLeft-th digit
// fullscreen-button.tsx
const el = document.documentElement as any; const enter = el.requestFullscreen ?? el.webkitRequestFullscreen;
const exit = document.exitFullscreen ?? (document as any).webkitExitFullscreen;
hidden if !(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled)
       || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
listen 'fullscreenchange' + 'webkitfullscreenchange' → swap icon; aria-label "Enter full screen"/"Exit full screen"
```
Inputs: ARR `type="text" inputMode="numeric" enterKeyHint="next"`; email `type="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}`; phone `type="tel" inputMode="tel"`; names `autoCapitalize="words"`. Max lengths: names 100, company 200, email 254, other 100. Honeypot `<input name="website_url" tabIndex={-1} aria-hidden autoComplete="off">` visually hidden (value sent in phase 05).

Idle constant `IDLE_RESET_MS = 120_000` in valuation-config.ts (kiosk section).

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\src\hooks\use-calculator-state.ts | create |
| D:\Downloads\saas_valuation_calculator\src\hooks\use-kiosk-params.ts | create (slug regex `^[a-z0-9-]{1,64}$`, default 'website') |
| D:\Downloads\saas_valuation_calculator\src\hooks\use-idle-reset.ts | create |
| D:\Downloads\saas_valuation_calculator\src\hooks\use-caret-preserving-format.ts | create |
| D:\Downloads\saas_valuation_calculator\src\components\calculator\calculator-app.tsx | modify (state, submit, reset, `onLeadSubmitted` prop) |
| D:\Downloads\saas_valuation_calculator\src\components\calculator\arr-input.tsx, arr-log-slider.tsx, arr-step-card.tsx, category-select.tsx | modify (wire handlers) |
| D:\Downloads\saas_valuation_calculator\src\components\calculator\lead-form-card.tsx, next-move-chips.tsx | modify (fields, Other box, error line `role="alert"`) |
| D:\Downloads\saas_valuation_calculator\src\components\result\result-card.tsx | modify (locked/unlocked from `result`, live text, Next visitor) |
| D:\Downloads\saas_valuation_calculator\src\components\layout\fullscreen-button.tsx | create |
| D:\Downloads\saas_valuation_calculator\src\config\valuation-config.ts | modify (IDLE_RESET_MS) |
| D:\Downloads\saas_valuation_calculator\tests\e2e\calculator-flow.spec.ts | create |

## Implementation Steps
1. Reducer + types; initial values all `''`, `arr:null`, `selection:''`, `nextMove:''`.
2. ARR input: caret helper + `parseArrDigits`/`formatArrInput`; empty → `null`. Slider: `value = arr==null ? 500 : arrToSlider(arr)`, onInput → `sliderToArr`. Chips set exact value; pressed when `arr === chip`. `aria-valuetext={formatMoney(arr)}`.
3. Category select: placeholder option `value=""` disabled; 11 industries then 9 categories from `DROPDOWN_OPTIONS`, no optgroups.
4. Text fields wired; phone uses `formatPhoneInput` with caret helper.
5. Next-move chips single-select; "Other" reveals inline text input in reserved slot, auto-focus it.
6. Submit per Architecture; error line shows message; focus first invalid field (nice-to-have, cheap).
7. Unlock: swap blurred sample for snapshot; transition filter 250ms (off under `prefers-reduced-motion`); set live text "Your indicative value range is $7.8M to $10.5M, 1.95x to 2.63x ARR". Button text from copy, disabled.
8. Next visitor + idle reset share `reset()`.
9. Fullscreen button per Architecture.
10. `useKioskParams` reads once on mount; keep in state (URL unchanged on reset).
11. E2E `calculator-flow.spec.ts`: error order 1→6 via UI; ARR typing "4000000" → "4,000,000"; phone "16474515164" → "(647) 451-5164"; Healthcare $4M submit → headline "$7.8M to $10.5M", "midpoint · 2.29x", axis "1.6x"/"2.9x", button "Multiple generated" disabled; Next visitor → locked, ARR empty, select placeholder; idle: `page.clock.install()`, `?kiosk=1`, submit, `fastForward('02:01')` → locked; without kiosk → still unlocked. Extend no-scroll spec to unlocked + Other-open states.
12. Commit `feat(calculator): wire inputs, validation, result unlock, reset and kiosk idle`.

## Todo list
- [ ] Reducer + kiosk params hook
- [ ] ARR input/slider/chips sync with caret preservation
- [ ] Select, fields, phone format, next move + Other
- [ ] Ordered validation + error line
- [ ] Unlock snapshot + aria-live + no layout shift
- [ ] Next visitor + idle reset (kiosk=1)
- [ ] Fullscreen button (webkit fallback, hidden in standalone/unsupported)
- [ ] calculator-flow E2E + unlocked no-scroll green

## Success Criteria
- Video flow reproducible: type ARR, pick Healthcare, fill, chip, submit → unlocked in <1s, reset returns to initial.
- E2E flow + no-scroll (locked, unlocked, Other open) pass at 4 viewports.

## Risk Assessment
- iPad Safari exits element fullscreen on input focus → PWA standalone is primary path (phase 07); button is best effort.
- Caret glitches on iOS → manual test on real iPad in phase 08.
- Disabled fieldset may lower contrast → override `:disabled` styles.

## Security Considerations
- No PII leaves the browser in this phase. Reset clears all PII from DOM (remount). No PII in console logs.
- Phase-2-only: idle reset for public site off unless kiosk (already default).

## Next steps
- Phase 05 implements `onLeadSubmitted` (queue + API). Phase 07 PWA makes fullscreen moot on iPad.
