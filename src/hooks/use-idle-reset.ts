'use client';

import { useEffect, useRef } from 'react';

// The handler only stores a timestamp, so frequent events like mousemove are cheap.
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'input', 'wheel', 'scroll', 'touchstart'] as const;

/**
 * Calls onIdle once no activity has been seen for timeoutMs while enabled.
 * Compares timestamps instead of trusting one long timer, which browsers throttle.
 */
export function useIdleReset(enabled: boolean, timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const check = () => {
      if (Date.now() - last >= timeoutMs) onIdleRef.current();
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, bump, { capture: true, passive: true });
    }
    const timer = window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, bump, { capture: true });
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [enabled, timeoutMs]);
}
