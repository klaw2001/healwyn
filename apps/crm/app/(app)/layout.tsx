import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell';
import { requireSession } from '@/lib/server/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return <AppShell session={session}>{children}</AppShell>;
}
