import { addDays, can, formatDay, formatTime, isLocalDate, localDate, zoneLabel } from '@healwyn/core';
import { Badge, buttonClasses } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppointmentActions } from '@/components/booking/appointment-actions';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/shell';
import { requireCapability } from '@/lib/server/auth';
import { appointmentsBetween, unmarkedAppointments, type AppointmentRow } from '@/lib/server/booking';
import { packFor } from '@/lib/server/pack';
import { listStaff } from '@/lib/server/queries';

export const metadata: Metadata = { title: 'Bookings' };

const STATUS: Record<AppointmentRow['status'], { label: string; tone: 'teal' | 'neutral' | 'accent' }> = {
  booked: { label: 'Booked', tone: 'teal' },
  attended: { label: 'Attended', tone: 'neutral' },
  no_show: { label: 'Missed', tone: 'accent' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const session = await requireCapability('screen.bookings');
  const pack = packFor(session);
  const tz = pack.brand.timeZone;
  const params = await searchParams;
  const today = localDate(new Date(), tz);
  const from = isLocalDate(params.from) ? params.from : today;
  const to = addDays(from, 6);
  const staff = (await listStaff(session)).filter((s) =>
    (pack.booking.bookableRoles as readonly string[]).includes(s.role),
  );
  const isExpert = session.role === 'specialist_doctor';
  const staffId = isExpert
    ? session.staffId
    : typeof params.staff === 'string' && staff.some((s) => s.id === params.staff)
      ? params.staff
      : null;
  const [appointments, unmarked] = await Promise.all([
    appointmentsBetween(session, pack, from, to, staffId),
    unmarkedAppointments(session),
  ]);
  const canManage = can(session.role, 'booking.manage');
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const href = (query: { from?: string; staff?: string | null }) => {
    const search = new URLSearchParams();
    const f = query.from ?? from;
    if (f !== today) search.set('from', f);
    const s = query.staff === undefined ? staffId : query.staff;
    if (s && !isExpert) search.set('staff', s);
    const q = search.toString();
    return q ? `/bookings?${q}` : '/bookings';
  };
  const mine = unmarked.filter((a) => !isExpert || a.staff_id === session.staffId);

  return (
    <>
      <PageTitle
        title="Bookings"
        description={`Every ${pack.booking.noun} in ${zoneLabel(tz)}. The database refuses double booking; people book online from the link after their enquiry, or you book from a lead's page.`}
        actions={
          can(session.role, 'availability.manage') ? (
            <Link href="/availability" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              {isExpert ? 'My hours' : 'Hours and time off'}
            </Link>
          ) : null
        }
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8">
        {mine.length ? (
          <section aria-labelledby="unmarked-title" className="rounded-lg border border-accent bg-accent-soft p-4">
            <h2 id="unmarked-title" className="font-sans text-base font-bold">
              Did they come? {mine.length} {mine.length === 1 ? 'booking needs' : 'bookings need'} marking
            </h2>
            <p className="mt-1 text-sm">
              Unmarked bookings become missed two hours after they end, which starts the recovery messages.
            </p>
            <ul className="mt-3 grid gap-2">
              {mine.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface p-3">
                  <span className="text-sm">
                    <Link
                      href={`/leads/${a.lead_id}`}
                      className="font-semibold text-primary underline underline-offset-4"
                    >
                      {a.lead_name ?? 'Erased lead'}
                    </Link>{' '}
                    · {formatDay(localDate(new Date(a.starts_at), tz))}, {formatTime(new Date(a.starts_at), tz)} ·{' '}
                    {a.staff_name}
                  </span>
                  {canManage ? (
                    <AppointmentActions
                      appointmentId={a.id}
                      started
                      noun={pack.booking.noun}
                      label={`${a.lead_name ?? 'lead'}, ${formatTime(new Date(a.starts_at), tz)}`}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Weeks" className="flex flex-wrap items-center gap-2">
            <Link
              href={href({ from: addDays(from, -7) })}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              Previous week
            </Link>
            <Link href={href({ from: today })} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              Today
            </Link>
            <Link
              href={href({ from: addDays(from, 7) })}
              className={buttonClasses({ variant: 'secondary', size: 'sm' })}
            >
              Next week
            </Link>
            <span className="text-sm font-semibold">
              {formatDay(from)} to {formatDay(to)}
            </span>
          </nav>
          {!isExpert && staff.length > 1 ? (
            <nav aria-label="Whose bookings" className="flex flex-wrap gap-1 text-sm">
              <Link
                href={href({ staff: null })}
                aria-current={staffId === null ? 'true' : undefined}
                className="rounded-md px-2 py-1 aria-[current=true]:bg-primary aria-[current=true]:text-surface"
              >
                Everyone
              </Link>
              {staff.map((s) => (
                <Link
                  key={s.id}
                  href={href({ staff: s.id })}
                  aria-current={staffId === s.id ? 'true' : undefined}
                  className="rounded-md px-2 py-1 aria-[current=true]:bg-primary aria-[current=true]:text-surface"
                >
                  {s.full_name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        {appointments.length === 0 ? (
          <EmptyState title={`No ${pack.booking.noun}s this week`}>
            Book from a lead&rsquo;s page, or share the booking link people get after their enquiry.
          </EmptyState>
        ) : (
          <ol className="grid gap-4">
            {days.map((day) => {
              const list = appointments.filter((a) => localDate(new Date(a.starts_at), tz) === day);
              if (list.length === 0) return null;
              return (
                <li key={day}>
                  <h2 className="font-sans text-sm font-bold tracking-[0.08em] text-ink-muted uppercase">
                    {formatDay(day)}
                    {day === today ? ' · today' : ''}
                  </h2>
                  <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
                    {list.map((a) => {
                      const start = new Date(a.starts_at);
                      const status = STATUS[a.status];
                      return (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="w-20 font-semibold tabular-nums">{formatTime(start, tz)}</span>
                            <span>
                              <Link
                                href={`/leads/${a.lead_id}`}
                                className="font-semibold text-primary underline underline-offset-4"
                              >
                                {a.lead_name ?? 'Erased lead'}
                              </Link>
                              <span className="block text-sm text-ink-muted">
                                With {a.staff_name}
                                {a.booked_via === 'website' ? ' · booked online' : ''}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {canManage && a.status === 'booked' ? (
                              <AppointmentActions
                                appointmentId={a.id}
                                started={start <= now}
                                noun={pack.booking.noun}
                                label={`${a.lead_name ?? 'lead'}, ${formatTime(start, tz)}`}
                              />
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
