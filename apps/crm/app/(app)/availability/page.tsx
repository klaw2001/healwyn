import { formatDay, localDate, zoneLabel } from '@healwyn/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AddException, RemoveException } from '@/components/booking/exceptions';
import { WeeklyHours } from '@/components/booking/weekly-hours';
import { EmptyState } from '@/components/empty-state';
import { EXCEPTION_REASON_LABELS } from '@/lib/booking-labels';
import { PageTitle } from '@/components/shell';
import { requireCapability } from '@/lib/server/auth';
import { slotsOf, staffCalendars } from '@/lib/server/booking';
import { asStaff } from '@/lib/server/db';
import { packFor } from '@/lib/server/pack';

export const metadata: Metadata = { title: 'Hours and time off' };

export default async function AvailabilityPage({ searchParams }: PageProps<'/availability'>) {
  const session = await requireCapability('availability.manage');
  const pack = packFor(session);
  const tz = pack.brand.timeZone;
  const params = await searchParams;
  const isExpert = session.role === 'specialist_doctor';
  const calendars = await asStaff(session, (tx) => staffCalendars(tx, pack, isExpert ? [session.staffId] : null, 60));
  const selected = calendars.find((c) => c.staff_id === (isExpert ? session.staffId : params.staff)) ?? calendars[0];
  const today = localDate(new Date(), tz);

  return (
    <>
      <PageTitle
        title={isExpert ? 'My hours' : 'Hours and time off'}
        description={`When each person takes ${pack.booking.noun}s, in ${zoneLabel(tz)}. Time off and extra hours change the slots offered online straight away; existing bookings stay as they are.`}
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
        {!isExpert ? (
          <nav aria-label="People who take bookings">
            <ul className="grid gap-1">
              {calendars.map((c) => (
                <li key={c.staff_id}>
                  <Link
                    href={`/availability?staff=${c.staff_id}`}
                    aria-current={selected?.staff_id === c.staff_id ? 'page' : undefined}
                    className="block min-h-10 rounded-md px-3 py-2 text-sm aria-[current=page]:bg-primary aria-[current=page]:text-surface"
                  >
                    <span className="block font-semibold">{c.full_name}</span>
                    <span className="block text-xs opacity-80">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {!selected ? (
          <EmptyState title="Nobody takes bookings yet">Add colleagues with a bookable role first.</EmptyState>
        ) : (
          <div className="grid content-start gap-6">
            <section aria-labelledby="week-title" className="rounded-lg border border-line bg-surface p-4">
              <h2 id="week-title" className="text-xl">
                {selected.full_name}: weekly hours
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {slotsOf(selected, pack).length} open {pack.booking.slotMinutes}-minute slots in the next{' '}
                {pack.booking.horizonDays} days.
              </p>
              <div className="mt-4">
                <WeeklyHours
                  key={selected.staff_id}
                  staffId={selected.staff_id}
                  initial={selected.rules.map((r) => ({ weekday: r.weekday, start: r.start, end: r.end }))}
                  defaults={{ start: pack.booking.defaultHours.start, end: pack.booking.defaultHours.end }}
                />
              </div>
            </section>
            <section aria-labelledby="exceptions-title" className="rounded-lg border border-line bg-surface p-4">
              <h2 id="exceptions-title" className="text-xl">
                Time off and extra hours
              </h2>
              {selected.exceptions.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {selected.exceptions.map((x) => {
                    const label = `${x.kind === 'off' ? 'Time off' : 'Extra hours'} on ${formatDay(x.date)}`;
                    return (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span>
                          <span className="font-semibold">{formatDay(x.date)}</span> ·{' '}
                          {x.kind === 'off' ? 'Time off' : 'Extra hours'}
                          {x.start ? ` ${x.start} to ${x.end}` : ', whole day'} ·{' '}
                          {EXCEPTION_REASON_LABELS[x.reason ?? 'other'] ?? x.reason}
                        </span>
                        {x.id ? <RemoveException exceptionId={x.id} label={label} /> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">Nothing in the next 60 days.</p>
              )}
              <div className="mt-4 border-t border-line pt-4">
                <AddException key={selected.staff_id} staffId={selected.staff_id} today={today} />
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
