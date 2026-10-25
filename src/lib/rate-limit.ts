// Fixed-window limiter kept in server memory. It is per instance, so it is a backstop:
// the main limit is the Vercel Firewall rule (see docs/deployment-guide.md).

export interface RateLimiter {
  /** True when the key may proceed; false when it is over the limit for this window. */
  allow(key: string, now?: number): boolean;
}

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const hits = new Map<string, { windowStart: number; count: number }>();
  return {
    allow(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || now - entry.windowStart >= windowMs) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (now - v.windowStart >= windowMs) hits.delete(k);
          if (hits.size >= maxKeys) hits.clear();
        }
        hits.set(key, { windowStart: now, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

/** Client IP as seen by Vercel's proxy. */
export function clientIp(headers: Headers): string {
  return headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
