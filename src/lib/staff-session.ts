// Staff access with one shared password (STAFF_PASSWORD). A signed, httpOnly cookie
// "<expiry>.<hmac>" keeps staff signed in for 12 hours. No user accounts, no database table.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const STAFF_COOKIE = 'aspen_staff';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Signing key = AUTH_SECRET + a hash of STAFF_PASSWORD, so changing the password
 * signs everyone out. Null when either is missing or too short.
 */
function secret(): string | null {
  const value = process.env.AUTH_SECRET;
  const password = process.env.STAFF_PASSWORD;
  if (!value || value.length < 16 || !password || password.length < MIN_PASSWORD_LENGTH) return null;
  return `${value}:${createHash('sha256').update(password).digest('base64url')}`;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so inputs of different length still compare in constant time.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when staff sign-in is configured (AUTH_SECRET 16+ chars, STAFF_PASSWORD 12+ chars). */
export function staffAuthConfigured(): boolean {
  return secret() !== null;
}

export function checkStaffPassword(input: string): boolean {
  if (!staffAuthConfigured()) return false;
  return safeEqual(input, process.env.STAFF_PASSWORD!);
}

export function createSessionToken(now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error('AUTH_SECRET is not configured');
  const expires = String(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
  return `${expires}.${sign(expires, key)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [expires, signature, extra] = token.split('.');
  if (!expires || !signature || extra !== undefined || !/^\d+$/.test(expires)) return false;
  if (!safeEqual(signature, sign(expires, key))) return false;
  return Number(expires) * 1000 > now;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
};
