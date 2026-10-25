'use client';

import { useSyncExternalStore } from 'react';
import { SOURCE_PATTERN, SOURCE_WEBSITE } from '@/config/valuation-config';

export interface KioskParams {
  /** Lead source tag, e.g. "saas-north-2026-booth"; defaults to "website". */
  source: string;
  /** kiosk=1 turns on the idle reset, the queued count and the staff link. */
  kiosk: boolean;
}

const SERVER_PARAMS: KioskParams = { source: SOURCE_WEBSITE, kiosk: false };
let cached: { search: string; params: KioskParams } | null = null;

function read(): KioskParams {
  const search = window.location.search;
  if (cached?.search === search) return cached.params;
  const query = new URLSearchParams(search);
  const source = query.get('source') ?? '';
  const params = {
    source: SOURCE_PATTERN.test(source) ? source : SOURCE_WEBSITE,
    kiosk: query.get('kiosk') === '1',
  };
  cached = { search, params };
  return params;
}

const noopSubscribe = () => () => {};

/** Reads ?source= and ?kiosk= on the client so the page itself stays static. */
export function useKioskParams(): KioskParams {
  return useSyncExternalStore(noopSubscribe, read, () => SERVER_PARAMS);
}
