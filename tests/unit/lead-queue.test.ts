// The offline queue sends to the real POST /api/leads handler backed by real Postgres (PGlite).
// Only the network layer between them is controlled, to simulate the booth Wi-Fi dropping.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

class MemoryStorage {
  private data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
const g = globalThis as Record<string, unknown>;

type Queue = typeof import('@/lib/lead-queue-storage');
type Sync = typeof import('@/lib/lead-queue-sync');
let queue: Queue;
let sync: Sync;
let POST: (req: Request) => Promise<Response>;
let countLeads: () => Promise<number>;

let networkUp = true;
let sent = 0;
const realFetch: typeof fetch = async (input, init) => {
  if (!networkUp) throw new TypeError('Failed to fetch');
  sent += 1;
  return POST(new Request(`http://booth.test${String(input)}`, init as RequestInit));
};

beforeAll(async () => {
  process.env.PGLITE_DIR = 'memory://';
  process.env.LEAD_RATE_LIMIT = '1000';
  // No fake `window`: PGlite would then think it runs in a browser.
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  queue = await import('@/lib/lead-queue-storage');
  sync = await import('@/lib/lead-queue-sync');
  ({ POST } = await import('@/app/api/leads/route'));
  const { getDb } = await import('@/lib/db');
  const repo = await import('@/lib/leads-repository');
  countLeads = async () => repo.countLeads(await getDb());
});

afterAll(() => {
  delete g.localStorage;
});

beforeEach(() => {
  storage.clear();
  storage.failWrites = false;
  networkUp = true;
  sent = 0;
});

let seq = 0;
function lead(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    submittedAt: new Date().toISOString(),
    source: 'saas-north-2026-booth',
    websiteUrl: '',
    arr: 4_000_000,
    selection: 'Healthcare',
    firstName: 'Queue',
    lastName: 'Test',
    company: 'Northwind',
    email: 'queue@northwind.io',
    phone: '(647) 451-5164',
    nextMove: 'Just exploring',
    nextMoveOther: '',
    ...overrides,
  };
}

describe('offline lead queue', () => {
  it('keeps the lead while offline and saves it once when the network returns', async () => {
    const before = await countLeads();
    networkUp = false;
    queue.enqueueLead(lead());
    await sync.flushQueue(realFetch);
    expect(queue.pendingCount()).toBe(1);
    expect(queue.readQueue()[0].attempts).toBe(1);

    networkUp = true;
    await sync.flushQueue(realFetch);
    await sync.flushQueue(realFetch);
    expect(queue.pendingCount()).toBe(0);
    expect(await countLeads()).toBe(before + 1);
  });

  it('a re-sent id after a lost response is not stored twice', async () => {
    const before = await countLeads();
    const record = lead();
    await POST(new Request('http://booth.test/api/leads', { method: 'POST', body: JSON.stringify(record) }));
    queue.enqueueLead(record); // As if the first response never reached the browser.
    await sync.flushQueue(realFetch);
    expect(queue.pendingCount()).toBe(0);
    expect(await countLeads()).toBe(before + 1);
  });

  it('concurrent flushes send every lead exactly once, including one queued mid-run', async () => {
    const before = await countLeads();
    queue.enqueueLead(lead());
    queue.enqueueLead(lead());
    const first = sync.flushQueue(realFetch);
    queue.enqueueLead(lead());
    await Promise.all([first, sync.flushQueue(realFetch), sync.flushQueue(realFetch)]);
    expect(sent).toBe(3);
    expect(queue.pendingCount()).toBe(0);
    expect(await countLeads()).toBe(before + 3);
  });

  it('a lead the server refuses is kept as failed, not retried, and does not block others', async () => {
    const before = await countLeads();
    queue.enqueueLead(lead({ selection: 'Not a category' }));
    queue.enqueueLead(lead());
    await sync.flushQueue(realFetch);
    expect(queue.failedCount()).toBe(1);
    expect(queue.pendingCount()).toBe(0);
    expect(await countLeads()).toBe(before + 1);
    sent = 0;
    await sync.flushQueue(realFetch);
    expect(sent).toBe(0);
  });

  it('a 200 that is not the API answer (captive portal page) does not remove the lead', async () => {
    const portal: typeof fetch = async () => new Response('<html>Accept terms</html>', { status: 200 });
    queue.enqueueLead(lead());
    await sync.flushQueue(portal);
    expect(queue.pendingCount()).toBe(1);
  });

  it('still sends from memory when the device storage refuses writes', async () => {
    const before = await countLeads();
    storage.failWrites = true;
    networkUp = false;
    queue.enqueueLead(lead());
    await sync.flushQueue(realFetch);
    expect(queue.pendingCount()).toBe(1);
    networkUp = true;
    await sync.flushQueue(realFetch);
    expect(queue.pendingCount()).toBe(0);
    expect(await countLeads()).toBe(before + 1);
  });
});
