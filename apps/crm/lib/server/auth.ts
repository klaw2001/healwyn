import 'server-only';
import { can, isStaffRole, type Capability } from '@healwyn/core';
import { forbidden, redirect } from 'next/navigation';
import { system } from './db';
import { readSession, type Session } from './session';

/** The signed-in staff member, or a redirect to sign in. */
export async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (!session) redirect('/login');
  return session;
}

/** The signed-in staff member if they hold the capability; otherwise a 403 page. */
export async function requireCapability(capability: Capability): Promise<Session> {
  const session = await requireSession();
  if (!can(session.role, capability)) forbidden();
  return session;
}

/** Same check for server actions: throws instead of rendering. */
export async function assertCapability(capability: Capability): Promise<Session> {
  const session = await readSession();
  if (!session) throw new Error('Your session has ended. Please sign in again.');
  if (!can(session.role, capability)) throw new Error('You do not have permission to do that.');
  return session;
}

export async function sessionForAuthUser(userId: string): Promise<Session | null> {
  const [staff] = await system()<{ staff_id: string; full_name: string; role: string }[]>`
    select staff_id, full_name, role from public.staff_for_auth_user(${userId})`;
  if (!staff || !isStaffRole(staff.role)) return null;
  return { userId, staffId: staff.staff_id, role: staff.role, name: staff.full_name };
}

/**
 * Checks an email and password. AUTH_PROVIDER=local (default) checks Supabase
 * Auth's users table directly; AUTH_PROVIDER=supabase asks Supabase Auth's
 * password endpoint (needs SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).
 */
export async function verifyPassword(email: string, password: string): Promise<string | null> {
  if (process.env.AUTH_PROVIDER === 'supabase') {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey)
      throw new Error('AUTH_PROVIDER=supabase needs SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: { id?: string } };
    return body.user?.id ?? null;
  }
  const [row] = await system()<
    { id: string | null }[]
  >`select public.verify_staff_password(${email}, ${password}) as id`;
  return row?.id ?? null;
}
