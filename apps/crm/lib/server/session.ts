import 'server-only';
import { isStaffRole, type StaffRole } from '@healwyn/core';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'hw_crm_session';
const SESSION_HOURS = 8;

export interface Session {
  /** Supabase Auth user id (the JWT `sub` RLS sees). */
  userId: string;
  staffId: string;
  role: StaffRole;
  name: string;
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters).');
  return new TextEncoder().encode(value);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ sid: session.staffId, role: session.role, name: session.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setAudience('healwyn-crm')
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: 'healwyn-crm', algorithms: ['HS256'] });
    if (
      !payload.sub ||
      typeof payload.sid !== 'string' ||
      !isStaffRole(payload.role) ||
      typeof payload.name !== 'string'
    ) {
      return null;
    }
    return { userId: payload.sub, staffId: payload.sid, role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session) {
  (await cookies()).set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
