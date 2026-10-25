'use client';

import { useEffect, useState } from 'react';

/**
 * Total stored leads for a signed-in staff user; null for everyone else (the endpoint returns 401).
 * Refreshes whenever `refreshKey` changes, e.g. when the local queue drains.
 */
export function useStaffLeadCount(enabled: boolean, refreshKey: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch('/api/leads/count', { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { count?: unknown } | null) => {
        setCount(typeof body?.count === 'number' ? body.count : null);
      })
      .catch(() => {
        // Offline or aborted: keep the last known count.
      });
    return () => controller.abort();
  }, [enabled, refreshKey]);

  return enabled ? count : null;
}
