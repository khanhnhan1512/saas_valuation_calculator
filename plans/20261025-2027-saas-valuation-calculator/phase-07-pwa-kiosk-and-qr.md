# Phase 07: PWA / kiosk + QR

## Context links
- [plan.md](plan.md) · spec "Kiosk mode", "Assets needed", Aspen card copy
- `research/researcher-02-frontend-kiosk-report.md` §2 (manifest, iOS limits, storage separation), §3 (optional SW), §5 (QR)
- Skills: `web-frameworks`, `media-processing` (icon PNGs via ImageMagick)

## Overview
- Date: 2026-10-25 · Priority: P1 booth-critical (QR, manifest, icons); SW = P1 recommended (Q7) · Status: Not started · Review: Not reviewed
- Web app manifest + Apple meta + icons so booth iPad runs as Home Screen app; build-time SVG QR to contact page; kiosk-only tiny service worker so an offline relaunch still loads; kiosk CSS hardening.

## Key Insights
- iOS ignores `display: fullscreen` → falls back to `standalone` (no Safari UI anyway). Keep `fullscreen` per spec.
- Home Screen app storage is separate from Safari → queue lives in app; never delete icon while queued; staff check queued count in the app footer.
- Installing from the booth URL keeps params as start URL on iOS; manifest `start_url` with booth params is fine in phase 1 because site is not public yet. **Phase 2: change `start_url` to `/`.**
- QR: dark `#1A322F` modules need white quiet zone → white rounded tile (already in phase 03). Render in async Server Component at build → zero client JS.
- SW risk = stale code; mitigate: network-first navigations, cache-first only hashed `/_next/static/*`, never `/api/*`, versioned cache name, registered only when `kiosk=1`.

## Requirements
- Functional: Add to Home Screen opens fullscreen-like standalone with booth params; QR scans to `https://aspenval.com/ca/contact-us/` from ~1m at ≥116px; offline relaunch in kiosk shows calculator and queue survives.
- Non-functional: first load <2s; no client JS for QR; safe-area padding on notched devices.

## Architecture
```ts
// src/app/manifest.ts
export default function manifest(): MetadataRoute.Manifest { return {
  name: 'Aspen SaaS Valuation Calculator', short_name: 'Aspen Valuation',
  start_url: '/?source=saas-north-2026-booth&kiosk=1',   // PHASE 2: '/'
  scope: '/', display: 'fullscreen', orientation: 'landscape',
  background_color: '#12302C', theme_color: '#12302C',
  icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }] }; }
// layout.tsx metadata: appleWebApp { capable: true, statusBarStyle: 'black-translucent', title: 'Aspen' },
//   icons { apple: '/icons/apple-touch-icon.png' }; viewport { viewportFit: 'cover', themeColor: '#12302C' }
```
```tsx
// src/components/aspen/aspen-qr-code.tsx (async server component)
import QRCode from 'qrcode';
export async function AspenQrCode() {
  const svg = await QRCode.toString(CONTACT_URL, { type: 'svg', errorCorrectionLevel: 'M', margin: 2,
    color: { dark: '#1A322F', light: '#FFFFFF' } });
  return <div className={styles.qr} role="img" aria-label={copy.qrAlt} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```
```js
// public/sw.js (~40 lines)
const CACHE = 'calc-v1';                                    // bump per release if needed
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('/'))); });
self.addEventListener('activate', e => e.waitUntil(/* delete other caches */ clients.claim()));
self.addEventListener('fetch', e => { const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') e.respondWith(fetch(e.request).then(r => { cache put '/' copy; return r; })
                                       .catch(() => caches.match('/')));
  else if (u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/icons/'))
    e.respondWith(caches.match(e.request).then(hit => hit ?? fetch(e.request).then(put-and-return)));
});
// src/components/kiosk/service-worker-register.tsx: if (kiosk && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
```
Kiosk CSS (globals): `overscroll-behavior:none; -webkit-tap-highlight-color:transparent; -webkit-touch-callout:none` on non-inputs; `padding: env(safe-area-inset-*)` on `.page`; `user-select:none` except inputs.

## Related code files
| Path | Action |
|---|---|
| D:\Downloads\saas_valuation_calculator\src\app\manifest.ts | create |
| D:\Downloads\saas_valuation_calculator\src\app\layout.tsx | modify (appleWebApp, icons, viewportFit) |
| D:\Downloads\saas_valuation_calculator\public\icons\icon.svg | create (placeholder "A" mark, teal on #12302C) |
| D:\Downloads\saas_valuation_calculator\public\icons\icon-192.png, icon-512.png, apple-touch-icon.png (180) | create (ImageMagick from svg) |
| D:\Downloads\saas_valuation_calculator\src\app\icon.svg | create (favicon; delete scaffold favicon.ico) |
| D:\Downloads\saas_valuation_calculator\src\components\aspen\aspen-qr-code.tsx | create |
| D:\Downloads\saas_valuation_calculator\src\components\aspen\aspen-card.tsx | modify (use QR) |
| D:\Downloads\saas_valuation_calculator\public\sw.js | create |
| D:\Downloads\saas_valuation_calculator\src\components\kiosk\service-worker-register.tsx | create |
| D:\Downloads\saas_valuation_calculator\src\components\calculator\calculator-app.tsx | modify (render register when kiosk) |
| D:\Downloads\saas_valuation_calculator\src\app\globals.css | modify (kiosk hardening, safe-area) |
| D:\Downloads\saas_valuation_calculator\next.config.ts | modify (`/sw.js` header `Cache-Control: no-cache`, `Service-Worker-Allowed: /`) |

## Implementation Steps
1. Placeholder icon SVG; generate PNGs: `magick -background "#12302C" public/icons/icon.svg -resize 512x512 public/icons/icon-512.png` (repeat 192, 180). Replace when Aspen logo arrives.
2. manifest.ts + layout metadata/viewport.
3. QR server component; confirm page still statically prerendered (`next build` output shows `○ /`).
4. sw.js + register (kiosk only) + no-cache header for sw.js.
5. Kiosk CSS hardening + safe-area.
6. Real iPad test (preview URL over HTTPS): Safari → open booth URL → Share → Add to Home Screen → launch → no Safari UI, landscape, fullscreen button hidden; submit; enable Airplane mode → force-quit app → relaunch → page loads from SW, submit queued → disable Airplane → queue flushes within 30s.
7. Scan QR from phone at ~1m in booth lighting → contact page opens.
8. Commit `feat(kiosk): add pwa manifest, icons, qr code and kiosk service worker`.

## Todo list
- [ ] Icons (svg + 3 png) + favicon
- [ ] manifest.ts + apple web app meta
- [ ] QR server component in Aspen card
- [ ] sw.js + kiosk-only register + headers
- [ ] Kiosk CSS hardening, safe-area
- [ ] Real iPad Home Screen + offline relaunch test
- [ ] QR scan test
- [ ] (Phase 2 only) manifest `start_url` → `/`

## Success Criteria
- Lighthouse "installable" passes on Chrome; iPad launches standalone with booth params (leads tagged `saas-north-2026-booth`).
- Offline relaunch in kiosk shows working calculator; queued lead saved once after reconnect.
- QR decodes to exact contact URL.

## Risk Assessment
- SW serves stale page after deploy → network-first navigation; worst case staff relaunch online; kill switch: deploy sw.js that unregisters itself.
- Separate Home Screen storage → checklist: never delete app with queued > 0.
- Icon placeholder looks unbranded → swap before Nov 3 if asset arrives.

## Security Considerations
- SW never caches `/api/*` (no PII in Cache Storage); same-origin only.
- QR URL is a constant in config (no user input).

## Next steps
- Phase 08 E2E covers offline + idle; phase 09 booth checklist uses this install flow.
