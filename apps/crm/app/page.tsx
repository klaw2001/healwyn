import { homePathFor } from '@healwyn/core';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/server/session';

export default async function Home() {
  const session = await readSession();
  redirect(session ? homePathFor(session.role) : '/login');
}
