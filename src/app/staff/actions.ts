'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientIp, createRateLimiter } from '@/lib/rate-limit';
import {
  STAFF_COOKIE,
  checkStaffPassword,
  createSessionToken,
  sessionCookieOptions,
} from '@/lib/staff-session';

const FAILED_SIGN_IN_DELAY_MS = 600;
// 5 sign-in attempts per IP per minute (per server instance; add a Firewall rule for /staff too).
const signInLimiter = createRateLimiter(5, 60_000);

export async function signIn(formData: FormData) {
  if (!signInLimiter.allow(clientIp(await headers()))) redirect('/staff?error=limit');
  const password = formData.get('password');
  if (typeof password !== 'string' || !checkStaffPassword(password)) {
    // Slow down password guessing without keeping any state.
    await new Promise((resolve) => setTimeout(resolve, FAILED_SIGN_IN_DELAY_MS));
    redirect('/staff?error=1');
  }
  const jar = await cookies();
  jar.set(STAFF_COOKIE, createSessionToken(), sessionCookieOptions);
  redirect('/staff');
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(STAFF_COOKIE);
  redirect('/staff');
}
