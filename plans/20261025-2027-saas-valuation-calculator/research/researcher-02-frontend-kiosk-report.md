# Researcher 02: Frontend + Kiosk Report (2026-10-25)

Scope: one-screen calculator, Next.js App Router + TS on Vercel, iPad/laptop booth kiosk, later public. Spec: `reports/00-spec-extracted.txt`.

## 1. Viewport-scaled sizing
**Reading the formula.** The PDF garbles the operator. The only reading that gives "base at 1366x768" is `size = clamp(base, min(base*100vh/768, base*100vw/1366), base*1.5)`, i.e. base ÷ 7.68 vh and base ÷ 13.66 vw. It factors as `base * clamp(1, min(vh/7.68, vw/13.66), 1.5)`, so define one unit:
```css
:root{ --u: clamp(1px, min(100vh / 768, 100vw / 1366), 1.5px); }
@supports (height:100dvh){ :root{ --u: clamp(1px, min(100dvh / 768, 100vw / 1366), 1.5px); } }
/* usage */ .title{ font-size: calc(34 * var(--u)); } .card{ padding: calc(20 * var(--u)); border-radius: calc(16 * var(--u)); }
```
- Use `@supports`, not two declarations in a row. A custom property is never validated, so a second declaration with dvh always wins and becomes invalid on old engines. dvh support: Safari/iPadOS 15.4+.
- If Tailwind v4: `text-[calc(34*var(--u))]`, or register `--spacing` tokens off `--u`. CSS modules work just as well.
- Grid lines (36px squares) and 1px/1.5px borders should stay fixed px. Scale only type, spacing, radii and control sizes.
- **Main risk:** the lower clamp is `base`, so nothing shrinks below base. At 1024x768 the vw term gives 0.75, which clamps to 1. The layout therefore has to fit **1024 wide at base sizes**. The real height is the browser *viewport*, not the screen: a "1366x768" laptop in Chrome gives roughly 1366x650 inner. A home-screen web app on a 1024x768 iPad gives about 1024x748 (status bar). Recommend designing to a 1024x650 worst case, or adding a guarded escape such as `@media (min-width:880px) and (max-height:700px){ :root{ --u: min(100dvh/768, 100vw/1366) } }` (drops the floor). This needs a product decision (see questions).
- At 2560x1440 the factor is 1.875, capped to 1.5, which leaves lots of room. Center the content with `max-width:1900px`.

**Guaranteeing no scroll (≥880px):**
```css
html,body{height:100%;margin:0}
@media (min-width:880px){
  body{height:100dvh;overflow:hidden}
  .page{height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-width:1900px;margin-inline:auto}
  .cols{display:grid;grid-template-columns:1.05fr 1fr;min-height:0;gap:calc(16*var(--u))}
  .col{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0}
}
@media (max-width:879.98px){ .cols{grid-template-columns:1fr} body{overflow:auto} }
@media (max-width:519.98px){ .form-row{grid-template-columns:1fr} }
```
- `overflow:hidden` hides overflow; it does not fix it. Add a Playwright test at 1024x768, 1366x768, 1920x1080 and 2560x1440 (plus 1366x650), in both locked and unlocked states and with the "Other" text box open. Assert `document.documentElement.scrollHeight <= innerHeight` and that no card has `scrollHeight > clientHeight`.
- iPad portrait (768/820 wide) is under 880, so it gets the stacked, scrolling layout. Lock the booth iPad to landscape (Control Center rotation lock).
- The iPad on-screen keyboard shrinks the visual viewport but not the layout viewport (dvh stays the same), so fields scroll into view. That is fine.
- Use `font-variant-numeric: tabular-nums` on money figures so widths don't jump.

## 2. Fullscreen API + PWA on iPad
- **iPad Safari:** element Fullscreen API supported. It was unprefixed in Safari 16.4; older versions need `webkitRequestFullscreen`. Developers report it drops out of fullscreen when an input is focused, which hurts a form page. **iPhone:** still no element fullscreen as of the Safari 27 beta (June 2026); video only. Sources: https://developer.apple.com/forums/thread/133248 , https://www2.webkit.org/show_bug.cgi?id=206854 , https://firt.dev/notes/pwa-ios/
- Button logic: `const el=document.documentElement; (el.requestFullscreen??el.webkitRequestFullscreen)?.call(el)`. Toggle off with `document.exitFullscreen ?? webkitExitFullscreen`. Hide the button when `!(document.fullscreenEnabled||document.webkitFullscreenEnabled)` or when `matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches`. This covers iPhone and installed apps. Listen to `fullscreenchange`/`webkitfullscreenchange` to update the icon.
- **Manifest:** iOS does **not** support `display: fullscreen` and falls back to `standalone`. Keep `fullscreen` per the spec (Android/desktop honour it), or set `standalone`; the result on iOS is the same. iOS ignores `display_override`. Since iOS/iPadOS 26, sites added to the Home Screen open as web apps by default, even without a manifest (https://firt.dev/notes/pwa-ios/).
- Next.js: `app/manifest.ts` returns `MetadataRoute.Manifest` `{name, short_name, start_url:'/?source=saas-north-2026-booth&kiosk=1', display:'fullscreen', orientation:'landscape', background_color:'#12302C', theme_color:'#12302C', icons:[192,512 png + svg]}`. In layout metadata: `appleWebApp:{capable:true, statusBarStyle:'black-translucent', title:'Aspen'}` and `viewport:{viewportFit:'cover', themeColor:'#12302C'}`. Add `env(safe-area-inset-*)` padding. Note: a public manifest with the booth `start_url` would tag public installs as booth leads. Either serve the manifest only for kiosk use, or have the booth add the URL to the Home Screen with params (Safari keeps the current URL as start when you install from the page).
- **Guided Access** (Settings > Accessibility > Guided Access, then triple-click the top/home button, set a passcode, disable the hardware buttons and optionally touch on the status bar). Also: Auto-Lock Never, rotation lock, Do Not Disturb.
- **Storage gotcha:** a Home Screen web app has **separate storage from Safari** (firt.dev). The offline queue lives only inside the installed app, so export and checks must run in the same context. Do not delete the Home Screen icon while records are queued (deleting it wipes the storage).

## 3. Offline lead queue (KISS)
- Key `aspen.leadQueue.v1` → JSON array `[{id, payload, queuedAt, attempts}]`. Wrap every read/write in try/catch (quota, private mode).
- Submit flow: build the payload with `id` → `POST /api/leads` (AbortController timeout about 8s) → on 2xx (including "already had id"), done. On network error, timeout, 5xx or 429: push to the queue and **still unlock** using the client-side calculation.
- `flush()`: module-level `inFlight` lock so the 30s interval, the `online` event, page load and `visibilitychange→visible` don't double-send. Send **sequentially** and remove each record only on 2xx. On 429, stop the loop and wait for the next tick. On 400 (validation), keep it but mark `bad:true` and surface it to staff; never drop it silently. Don't trust `navigator.onLine` as a gate; just attempt.
- **Rate-limit clash:** 10 submits/IP/min means a queue of more than 10 from the booth IP gets throttled. Sequential send plus stop on 429 handles this, or have the server count already-seen ids as no-ops before the limiter.
- Show the queued count next to the export link. Use a `useSyncExternalStore` hook over the queue, plus the `storage` event.
- **IDs:** `crypto.randomUUID()` is secure-context only (HTTPS/localhost). Safari 15.4+, Baseline since 2022 (https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID). Vercel is HTTPS, so it's fine there. Testing on an iPad over `http://192.168.x.x` breaks it, so add a fallback from `crypto.getRandomValues` (works in insecure contexts) that sets the v4 bits `b[6]=b[6]&0x0f|0x40; b[8]=b[8]&0x3f|0x80`. Generate the id **once per submit attempt**, before the first POST, and keep it with the record.
- Server: `INSERT ... ON CONFLICT (id) DO NOTHING` returns 200 either way.
- **Service worker?** It isn't needed for "<2s first load": the page is small and static, served from Vercel's CDN. The real risk is a **reload while offline** (Safari tab discarded, iPad app relaunched), which gives a blank page and a stuck queue. KISS steps:
  1. Never call `location.reload()` for reset; reset in memory.
  2. Phase 1 option: a ~30-line hand-written `public/sw.js` that caches `/` (network-first) and `/_next/static/*` (cache-first, immutable), registered only when `kiosk=1`. Serwist (`@serwist/next`, the next-pwa successor) is the off-the-shelf route if the team prefers it. Recommend the tiny manual SW for kiosk only. Skip background sync: Safari lacks it, and the interval timer covers the need.
- Safari ITP may wipe script-writable storage after 7 days without user interaction (browser tabs). The booth is used daily, so low risk; installed web apps carry the same caveat less often. Treat the queue as short-term: staff flush and check before the end of each day.

## 4. ARR log slider, chips, phone, autofill
- **Single source of truth:** `arr: number|null`. Derive the slider position and the text from it; never sync two states.
- Slider: `<input type="range" min=0 max=1000 step=1>`. Mapping: `v = exp(lnMin + t/1000*(lnMax-lnMin))` with min 250000 and max 50000000. Inverse: `t = round(1000*(ln(clamp(v))-lnMin)/(lnMax-lnMin))`. Snap the slider output to nice steps: <1M→10K, <10M→50K, else→250K. Typed values above $50M (cap $5B) pin the thumb at max; below $250K, at min. `aria-valuetext="$5.0M"`. Style with `appearance:none` and a ≥44px thumb, and handle `-webkit-slider-thumb` and `-moz-range-thumb` separately. On iOS Safari a tap on the track may not jump the thumb (drag only); the chips cover this.
- ARR text: `type="text" inputMode="numeric" enterKeyHint="next"`. On input, strip non-digits, cap at 5e9, format with `Intl.NumberFormat('en-US')`. On iPad, `numeric` brings up the number row of the full keyboard (no numpad exists), which is OK.
- Chips: `<button type="button" aria-pressed={arr===1e6}>` that sets `arr`. Next-move chips are a single-select group. Spec asks for aria-pressed, so use buttons, not radios. "Other" reveals a text input (reserve its space, or show it inline, to avoid shift and overflow).
- **Caret preservation** (ARR and phone): before formatting, count the digits left of `selectionStart`. After setting the value, put the caret after the same digit count (`setSelectionRange` in `useLayoutEffect` or `requestAnimationFrame`). A controlled input in React 18/19 otherwise jumps the caret to the end on iOS.
- **Phone:** `type="tel" inputMode="tel" autoComplete="off"`. `d = value.replace(/\D/g,''); if (d[0]==='1') d=d.slice(1); d=d.slice(0,10)`. NANP area codes never start with 1, so always stripping one leading 1 is safe. Format progressively: `len<4 → "(ddd"`, `<7 → "(ddd) ddd"`, else `"(ddd) ddd-dddd"`. Only add `") "` and `"-"` once the next digit exists, so Backspace never gets stuck on a separator. Validate exactly 10 digits.
- **Email:** `type="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}`.
- **Autofill pitfalls:** browsers treat `autocomplete="off"` as a hint. Safari iOS ignores it for contact/QuickType suggestions; Chrome ignores it on fields it classifies as address/contact by name, id or label heuristics (https://xenforo.com/community/threads/profile-updating-mobile-issue.110668 , https://meta.discourse.org/t/autocomplete-off-disables-safari-password-manager/14472). Layered tricks:
  1. `<form autoComplete="off">` plus `autocomplete="off"` on each field (per spec).
  2. Non-semantic `name`/`id` (`f1`…`f5`, not `email`/`phone`/`fname`).
  3. Chrome: an unknown token such as `autocomplete="off-lead"` is often more effective than "off". Never use `new-password` (it triggers the password generator).
  4. Optional: `readOnly` until `onFocus` (blocks some Safari autofill, but can confuse the iOS keyboard; test it).
  5. **Device config is the real fix for the booth:** Settings > Apps > Safari > AutoFill, turn off Contact Info and Credit Cards. No "My Card" contact. Settings > General > Keyboard, turn off Predictive and Auto-Correction. Reset Keyboard Dictionary before the show, otherwise QuickType suggests the previous visitor's typed name or email. Add this to the booth checklist.
  6. On reset, set all values to `''` and remount the form (`key`) so the DOM is fresh.

## 5. Range line, blur lock, aria-live, QR
- **Plain CSS, no chart lib** (saves 40–100KB and helps the 2s target). The track is relative-positioned, with an absolutely positioned band and markers at `left: pct(m)`, `pct(m) = (m-axisMin)/(axisMax-axisMin)*100%`.
- **Useful fact:** low = 0.85·mid and high = 1.15·mid, so axisMin = low-0.45R stays above 0 every time, and the axis spans 1.9R. The marker positions are therefore **constant: 23.68%, 50%, 76.32%**. Labels never collide and layout is identical for any input. That means zero layout shift, and the `max(0,…)` guard is never triggered (keep it anyway). The axis end labels are multiples to one decimal.
- The midpoint marker is taller and brighter. Under each marker: value plus "lower · 1.95x". Use `translateX(-50%)` and `white-space:nowrap`.
- **Blur lock without layout shift:** always render the *unlocked* card markup. While locked, fill it with placeholder figures (a fixed realistic sample, not the visitor's live numbers) under `filter: blur(calc(8*var(--u)))`, with `aria-hidden` plus `inert`. Overlay the lock icon and copy with `position:absolute; inset:0`. On unlock, swap in the data and transition the filter for 250ms, disabled under `prefers-reduced-motion`. The box size never changes, so CLS is 0. Reserve height with a fixed grid, not with content.
- **aria-live:** keep a persistent `<p aria-live="polite" className="sr-only">` that exists in the DOM from first render (VoiceOver misses regions that are inserted already filled). On unlock, set its text to "Your indicative value range is $7.8M to $10.5M, 1.95x to 2.63x ARR". Don't make the whole card live. The error line under the button can use `role="alert"` or a second polite region.
- **QR:** `qrcode` npm (`QRCode.toString(url,{type:'svg',errorCorrectionLevel:'M',margin:2,color:{dark:'#1A322F',light:'#FFFFFF'}})`) in an async **Server Component**. It's static, so it renders at build time, inlined with `dangerouslySetInnerHTML`: zero client JS. Alternative: a prebuild script that writes `public/qr-contact.svg` (preferred if the URL is fixed; simplest). Dark #1A322F modules **need a light quiet zone or background**; dark-on-teal scans poorly, so put a white rounded tile behind it. Minimum about 120px on screen at the booth. Add `?utm_source=booth` only if Aspen wants it (question).

## 6. Idle reset (2 min after result, kiosk=1 only)
- Arm the timer only when `unlocked && kiosk`. Record `lastActivity = Date.now()` on `pointerdown`, `keydown`, `input` and `wheel` (window, capture, passive). Check `Date.now()-lastActivity >= 120000` with a 1s `setInterval` and on `visibilitychange`. A timestamp check survives throttled or suspended timers better than one long `setTimeout`.
- `reset()` (shared with "Next visitor"): `document.activeElement?.blur()` (dismisses the iPad keyboard), clear state, bump `sessionKey` to remount the form, `scrollTo(0,0)`, re-enable the button, clear errors. **Never** clear the queue and never call `location.reload()`.
- Optional (not in spec): a 10s "Still there?" toast before reset. Skip unless Aspen asks.
- Also consider an idle reset when there is input but no result (a visitor walks away mid-form, leaving PII on screen). The spec only covers after-result (question).

## Summary picks
CSS `--u` clamp unit + dvh; grid with `minmax(0,1fr)` + Playwright no-scroll tests; prefixed Fullscreen button hidden in standalone/iPhone; manifest via `app/manifest.ts` + `appleWebApp` meta; localStorage queue + sequential flush + UUID fallback; optional tiny kiosk-only SW; single-state log slider; progressive phone formatter; device-level autofill/predictive off; plain CSS range line with constant marker positions; build-time SVG QR; timestamp idle reset.

## Unresolved questions
1. Lower clamp = base means no shrink: should short viewports (laptop browser ~650px tall, iPad web app 748px) drop the floor, or must the design fit 1024x650 at base?
2. Should the booth use the Home Screen web app (separate storage, no Safari UI) or Safari plus the Fullscreen button? The queue and staff export must run in the same context.
3. Is a kiosk-only service worker acceptable for offline relaunch, or is the "no SW" KISS option accepted along with its risk?
4. Should the rate limit exempt already-seen ids or booth-source flushes?
5. Idle reset also before a result (PII left mid-form)?
6. QR target: plain contact URL or UTM-tagged? Does Aspen supply the QR or do we generate it?
7. Should manifest `start_url` carry the booth params, given the public site later shares the same domain?
