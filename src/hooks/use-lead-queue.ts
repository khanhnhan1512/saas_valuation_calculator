'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { failedCount, pendingCount, subscribeQueue } from '@/lib/lead-queue-storage';
import { startQueueSync } from '@/lib/lead-queue-sync';

/** Starts the background retry loop for the lifetime of the page. */
export function useLeadQueueSync() {
  useEffect(() => startQueueSync(), []);
}

/** Number of leads saved on this device but not yet confirmed by the server. */
export function useQueuedCount(): number {
  return useSyncExternalStore(subscribeQueue, pendingCount, () => 0);
}

/** Leads the server refused (kept on the device for staff to recover). */
export function useFailedCount(): number {
  return useSyncExternalStore(subscribeQueue, failedCount, () => 0);
}
