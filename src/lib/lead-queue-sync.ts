// Sends queued leads one at a time. Stops at the first network error, 429 or 5xx so a booth
// with many queued leads never trips the rate limit; the next retry continues.
import { QUEUE_RETRY_MS } from '@/config/valuation-config';
import { readQueue, removeLead, updateLead, type LeadPayload } from './lead-queue-storage';

export type SendOutcome = 'ok' | 'bad' | 'retry';

const REQUEST_TIMEOUT_MS = 10_000;
let inFlight: Promise<void> | null = null;
let rerun = false;

export async function postLead(payload: LeadPayload, fetchImpl: typeof fetch = fetch): Promise<SendOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
      // A captive portal or proxy page must never count as "saved".
      redirect: 'error',
    });
    if (res.status === 400 || res.status === 413) return 'bad';
    if (!res.ok) return 'retry';
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return body?.ok === true ? 'ok' : 'retry';
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

async function runFlush(fetchImpl: typeof fetch) {
  for (const record of readQueue()) {
    if (record.bad) continue;
    const outcome = await postLead(record.payload, fetchImpl);
    if (outcome === 'ok') removeLead(record.id);
    else if (outcome === 'bad') updateLead(record.id, { bad: true, attempts: record.attempts + 1 });
    else {
      updateLead(record.id, { attempts: record.attempts + 1 });
      return;
    }
  }
}

/**
 * Safe to call often: only one run at a time, so each record is sent once at a time.
 * A call during a run schedules one more pass, so a lead queued mid-run is sent right after.
 */
export function flushQueue(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        rerun = false;
        await runFlush(fetchImpl);
      } while (rerun);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Retries on load, every 30 seconds, when the network returns and when the page is shown. */
export function startQueueSync(): () => void {
  const flush = () => void flushQueue();
  const onVisible = () => {
    if (document.visibilityState === 'visible') flush();
  };
  flush();
  const timer = window.setInterval(flush, QUEUE_RETRY_MS);
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('online', flush);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
