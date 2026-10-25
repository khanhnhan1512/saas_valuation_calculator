import { cookies } from 'next/headers';
import { STAFF_COOKIE, verifySessionToken } from './staff-session';

export async function isStaff(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(STAFF_COOKIE)?.value);
}

/** Every staff route calls this itself; returns a 401 response when not signed in. */
export async function requireStaff(): Promise<Response | null> {
  if (await isStaff()) return null;
  return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
