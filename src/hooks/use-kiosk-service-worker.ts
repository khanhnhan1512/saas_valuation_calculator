'use client';

import { useEffect } from 'react';

/** Booth only (kiosk=1): register the offline service worker so the app reopens without Wi-Fi. */
export function useKioskServiceWorker(kiosk: boolean) {
  useEffect(() => {
    if (!kiosk || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline reopen is a bonus; the calculator works without it.
    });
  }, [kiosk]);
}
