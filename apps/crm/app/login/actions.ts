'use server';

import { demoAuthUserId, demoUsers, getActivePack, homePathFor, isStaffRole, sha256Hex } from '@healwyn/core';
import { packOf } from '@/lib/server/pack';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionForAuthUser, verifyPassword } from '@/lib/server/auth';
import { system } from '@/lib/server/db';
import { clearSessionCookie, setSessionCookie } from '@/lib/server/session';

export interface SignInState {
  error?: string;
  /** Echoed back so a failed attempt keeps the email (React resets forms after an action). */
  email?: string;
}

/**
 * Ten attempts per ten minutes for each connection and account. Keyed on both,
 * so colleagues behind one office IP do not lock each other out, while
 * guessing one account's password stays slow.
 */
async function allowAttempt(email: string): Promise<boolean> {
  const h = await headers();
  const ip = h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!ip) return true;
  const key = `login:${(await sha256Hex(`${process.env.SESSION_SECRET}:${ip}:${email.toLowerCase()}`)).slice(0, 40)}`;
  const [row] = await system()<{ allowed: boolean }[]>`select public.hit_rate_limit(${key}, 10, 600) as allowed`;
  return row?.allowed ?? true;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.', email };
  if (!(await allowAttempt(email)))
    return { error: 'Too many attempts. Please wait ten minutes and try again.', email };

  const userId = await verifyPassword(email, password);
  const session = userId ? await sessionForAuthUser(userId) : null;
  if (!session) return { error: 'That email and password do not match an active staff account.', email };
  await setSessionCookie(session);
  redirect(homePathFor(session.role));
}

/** Demo only: sign in as the seeded user for a role, without a password. Off unless DEMO_LOGIN=true. */
export async function signInAsDemo(formData: FormData): Promise<void> {
  if (process.env.DEMO_LOGIN !== 'true') redirect('/login');
  const role = formData.get('role');
  const industry = formData.get('industry');
  const pack = typeof industry === 'string' ? packOf(industry) : getActivePack();
  const user = demoUsers(pack.demo.staff).find((u) => u.role === role);
  if (!isStaffRole(role) || !user) redirect('/login');
  const session = await sessionForAuthUser(demoAuthUserId(user.staffId));
  if (!session) redirect(`/login?demo=missing&industry=${pack.id}`);
  await setSessionCookie(session);
  redirect(homePathFor(session.role));
}

export async function signOut(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
