import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell';
import { requireSession } from '@/lib/server/auth';
import { countDueReminders } from '@/lib/server/queries';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const reminders = await countDueReminders(session);
  return (
    <AppShell session={session} reminders={reminders}>
      {children}
    </AppShell>
  );
}
