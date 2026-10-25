import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limit';
import {
  SESSION_TTL_SECONDS,
  checkStaffPassword,
  createSessionToken,
  staffAuthConfigured,
  verifySessionToken,
} from '@/lib/staff-session';
import { createUuid } from '@/lib/uuid';

const ENV = { ...process.env };

beforeEach(() => {
  process.env.STAFF_PASSWORD = 'correct horse battery staple';
  process.env.AUTH_SECRET = 'a-long-random-secret-for-tests-only';
});
afterEach(() => {
  process.env = { ...ENV };
});

describe('staff session', () => {
  it('checks the shared password', () => {
    expect(staffAuthConfigured()).toBe(true);
    expect(checkStaffPassword('correct horse battery staple')).toBe(true);
    expect(checkStaffPassword('wrong')).toBe(false);
    expect(checkStaffPassword('')).toBe(false);
  });

  it('refuses every password when not configured', () => {
    delete process.env.STAFF_PASSWORD;
    expect(staffAuthConfigured()).toBe(false);
    expect(checkStaffPassword('')).toBe(false);
    process.env.STAFF_PASSWORD = 'x';
    process.env.AUTH_SECRET = 'short';
    expect(checkStaffPassword('x')).toBe(false);
  });

  it('accepts its own token until it expires', () => {
    const now = Date.UTC(2026, 10, 4, 12);
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now)).toBe(true);
    expect(verifySessionToken(token, now + (SESSION_TTL_SECONDS - 1) * 1000)).toBe(true);
    expect(verifySessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejects tampered, foreign or malformed tokens', () => {
    const now = Date.now();
    const token = createSessionToken(now);
    const [expires, sig] = token.split('.');
    expect(verifySessionToken(`${Number(expires) + 9999}.${sig}`, now)).toBe(false);
    expect(verifySessionToken(`${expires}.${sig}x`, now)).toBe(false);
    expect(verifySessionToken(`${token}.extra`, now)).toBe(false);
    expect(verifySessionToken('', now)).toBe(false);
    expect(verifySessionToken(undefined, now)).toBe(false);
    process.env.AUTH_SECRET = 'a-different-secret-on-another-deploy';
    expect(verifySessionToken(token, now)).toBe(false);
  });

  it('changing the staff password signs everyone out', () => {
    const now = Date.now();
    const token = createSessionToken(now);
    process.env.STAFF_PASSWORD = 'a brand new staff passphrase';
    expect(verifySessionToken(token, now)).toBe(false);
  });

  it('refuses passwords shorter than 12 characters as configuration', () => {
    process.env.STAFF_PASSWORD = 'short-pass';
    expect(staffAuthConfigured()).toBe(false);
    expect(checkStaffPassword('short-pass')).toBe(false);
  });
});

describe('rate limiter', () => {
  it('allows 10 per minute per key, then resets', () => {
    const limiter = createRateLimiter(10, 60_000);
    const t = 1_000_000;
    for (let i = 0; i < 10; i += 1) expect(limiter.allow('1.2.3.4', t + i)).toBe(true);
    expect(limiter.allow('1.2.3.4', t + 20)).toBe(false);
    expect(limiter.allow('5.6.7.8', t + 20)).toBe(true);
    expect(limiter.allow('1.2.3.4', t + 60_000)).toBe(true);
  });
});

describe('uuid', () => {
  it('creates distinct v4 ids', () => {
    const ids = new Set(Array.from({ length: 200 }, createUuid));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
