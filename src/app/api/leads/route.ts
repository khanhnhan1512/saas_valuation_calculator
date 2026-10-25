import { getDb } from '@/lib/db';
import { processLead } from '@/lib/lead-intake';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };
// Spec: 10 submits per IP per minute. LEAD_RATE_LIMIT only exists so E2E tests can raise it.
const limiter = createRateLimiter(Number(process.env.LEAD_RATE_LIMIT) || 10, 60_000);

/** Public, create-only: validates, recalculates the range, stores the lead once per id. */
export async function POST(request: Request) {
  if (!limiter.allow(clientIp(request.headers))) {
    return Response.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  try {
    const result = await processLead(await request.text(), getDb);
    return Response.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (err) {
    // Log the error class only, never the lead (personal information).
    console.error('lead insert failed:', err instanceof Error ? err.name : 'unknown');
    // 503 tells the browser to keep the lead queued and retry.
    return Response.json({ ok: false, error: 'Please try again' }, { status: 503, headers: NO_STORE });
  }
}
