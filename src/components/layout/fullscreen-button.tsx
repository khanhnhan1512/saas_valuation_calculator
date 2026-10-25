'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { COPY } from '@/config/site-copy';
import styles from './page-layout.module.css';

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'];

function subscribe(onChange: () => void) {
  for (const name of CHANGE_EVENTS) document.addEventListener(name, onChange);
  return () => {
    for (const name of CHANGE_EVENTS) document.removeEventListener(name, onChange);
  };
}

/** 0 = unsupported or already a standalone app, 1 = windowed, 2 = full screen. */
function readMode(): 0 | 1 | 2 {
  const doc = document as WebkitDocument;
  const standalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (standalone || !(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) return 0;
  return doc.fullscreenElement || doc.webkitFullscreenElement ? 2 : 1;
}

export function FullscreenButton() {
  const mode = useSyncExternalStore(subscribe, readMode, () => 0 as const);

  const toggle = useCallback(async () => {
    const doc = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;
    try {
      if (readMode() === 2) await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      else await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
    } catch {
      // Fullscreen can be refused (e.g. not from a user gesture); the page still works.
    }
  }, []);

  if (mode === 0) return null;
  const label = mode === 2 ? COPY.fullscreenExit : COPY.fullscreenEnter;
  return (
    <button type="button" className={styles.iconButton} onClick={toggle} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
        {mode === 2 ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" strokeWidth="2" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
    </button>
  );
}
