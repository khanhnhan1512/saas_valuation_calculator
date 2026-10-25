// Write-ahead lead queue in localStorage (one key). A record is removed only after the
// server confirms it, so a dropped booth Wi-Fi or a closed tab never loses a lead.
import type { LeadFormValues } from './lead-validation';

export const QUEUE_KEY = 'aspen.leadQueue.v1';

export interface LeadPayload extends LeadFormValues {
  id: string;
  submittedAt: string;
  source: string;
  websiteUrl: string;
}

export interface QueuedLead {
  id: string;
  payload: LeadPayload;
  queuedAt: string;
  attempts: number;
  /** Server rejected it as invalid (400/413); kept and shown to staff as "failed", never retried. */
  bad?: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let memoryCopy: QueuedLead[] = [];
/** Set when a write fails (quota, blocked storage); the in-memory copy is then the source of truth. */
let storageBroken = false;

function storage(): Storage | null {
  if (storageBroken) return null;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // Blocked storage (private mode, policies).
  }
}

export function readQueue(): QueuedLead[] {
  const store = storage();
  if (!store) return memoryCopy;
  try {
    const parsed: unknown = JSON.parse(store.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as QueuedLead[]) : [];
  } catch {
    return memoryCopy;
  }
}

function writeQueue(queue: QueuedLead[]) {
  memoryCopy = queue;
  const store = storage();
  if (store) {
    try {
      store.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Keep retrying from memory while this page stays open.
      storageBroken = true;
    }
  }
  listeners.forEach((fn) => fn());
}

export function enqueueLead(payload: LeadPayload) {
  const queue = readQueue().filter((r) => r.id !== payload.id);
  queue.push({ id: payload.id, payload, queuedAt: new Date().toISOString(), attempts: 0 });
  writeQueue(queue);
}

export function updateLead(id: string, change: Partial<Pick<QueuedLead, 'attempts' | 'bad'>>) {
  writeQueue(readQueue().map((r) => (r.id === id ? { ...r, ...change } : r)));
}

export function removeLead(id: string) {
  writeQueue(readQueue().filter((r) => r.id !== id));
}

/** Records still waiting for the server. */
export function pendingCount(): number {
  return readQueue().filter((r) => !r.bad).length;
}

/** Records the server refused; they stay on the device so staff can notice and recover them. */
export function failedCount(): number {
  return readQueue().filter((r) => r.bad).length;
}

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === QUEUE_KEY) fn();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}
