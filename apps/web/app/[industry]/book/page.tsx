import {
  formatAppointment,
  formatDay,
  formatTime,
  slotsByDay,
  zoneLabel,
  type IndustryPack,
  type StaffCalendar,
} from '@healwyn/core';
import { Button, buttonClasses, Container, Notice, RadioGroup } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { pagePack } from '@/lib/pack';
import { candidateCalendars, loadBooking, slotsOf, type LoadedBooking } from '@/lib/server/booking';
import { errorFields, log } from '@/lib/server/log';
import { bookSlot, cancelBooking } from './actions';

export async function generateMetadata(props: PageProps<'/[industry]/book'>): Promise<Metadata> {
  const pack = await pagePack(props);
  return {
    title: `Book a ${pack.booking.noun}`,
    description: `Choose a time for your ${pack.booking.noun}.`,
    robots: { index: false, follow: false },
  };
}

const ERRORS: Record<string, (noun: string) => string> = {
  taken: () => 'Someone booked that time a moment ago. Please choose another.',
  unavailable: () => 'That time is no longer available. Please choose another.',
  choose: () => 'Please choose a time first.',
  already_booked: (noun) => `You already have a ${noun} booked. You can change its time below.`,
  busy: () => 'You have changed your booking several times in the last hour. Please try again later.',
  failed: () => 'Something went wrong and nothing was changed. Please try again in a few minutes.',
  not_found: () => 'We could not find your enquiry. It may have been deleted.',
};

const str = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function BookPage(props: PageProps<'/[industry]/book'>) {
  const sitePack = await pagePack(props);
  const params = await props.searchParams;
  const token = str(params.t);

  let loaded: LoadedBooking | null = null;
  let calendars: StaffCalendar[] = [];
  let failed = false;
  if (token) {
    try {
      loaded = await loadBooking(token);
      if (loaded) calendars = await candidateCalendars(loaded);
    } catch (error) {
      log.error('booking.page_failed', errorFields(error));
      failed = true;
    }
  }
  const pack = loaded?.pack ?? sitePack;
  const { noun } = pack.booking;

  return (
    <>
      <PageHeader
        eyebrow="Booking"
        title={`Choose a time for your ${noun}`}
        intro={`Times are shown in ${zoneLabel(pack.brand.timeZone)}. You can change or cancel your ${noun} from this page at any time.`}
      />
      <Container className="py-section">
        <div className="mx-auto max-w-3xl">
          <Notice tone="demo" className="mb-8">
            Demo booking: the people and times are fictional, and nobody will expect you.
          </Notice>
          {!token || (!loaded && !failed) || str(params.error) === 'link' ? (
            <NoLink pack={sitePack} invalid={Boolean(token) || str(params.error) === 'link'} />
          ) : failed || !loaded ? (
            <Notice tone="emergency">{ERRORS.failed!(noun)}</Notice>
          ) : (
            <Booking loaded={loaded} calendars={calendars} params={params} />
          )}
        </div>
      </Container>
    </>
  );
}

function NoLink({ pack, invalid }: { pack: IndustryPack; invalid: boolean }) {
  const { noun } = pack.booking;
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-10">
      {invalid ? (
        <Notice tone="emergency" className="mb-6">
          This booking link is not valid or has expired. Please send a new enquiry, or use the link from your most
          recent one.
        </Notice>
      ) : null}
      <h2 className="text-2xl">Start with a short enquiry</h2>
      <p className="mt-3 text-ink-muted">
        Booking starts with a few questions, so the right person sees you. Send your enquiry and you can choose a {noun}{' '}
        time straight away.
      </p>
      <Link href="/contact" className={`${buttonClasses({ size: 'lg' })} mt-6`}>
        Send an enquiry
      </Link>
    </div>
  );
}

function Booking({
  loaded,
  calendars,
  params,
}: {
  loaded: LoadedBooking;
  calendars: StaffCalendar[];
  params: Record<string, string | string[] | undefined>;
}) {
  const { pack, context, token } = loaded;
  const { noun } = pack.booking;
  const tz = pack.brand.timeZone;
  const appointment = context.appointment;
  const error = str(params.error);
  const done = str(params.done);
  const changing = str(params.change) === '1';
  const link = (query: string) => `/book?t=${encodeURIComponent(token)}&i=${pack.id}${query ? `&${query}` : ''}`;
  const locationName = (calendar: StaffCalendar | undefined) =>
    calendar?.locations
      .map((id) => pack.site.locations.items.find((l) => l.id === id)?.name)
      .filter(Boolean)
      .join(' or ');

  return (
    <div className="grid gap-8">
      {error && ERRORS[error] ? (
        <div role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-4">
          {ERRORS[error]!(noun)}
        </div>
      ) : null}
      {done === 'booked' && appointment ? (
        <div role="status" className="rounded-md border border-success bg-success-soft p-4">
          Your {noun} is booked. We will send a reminder before it.
        </div>
      ) : null}
      {done === 'cancelled' && !appointment ? (
        <div role="status" className="rounded-md border border-success bg-success-soft p-4">
          Your {noun} is cancelled. You can choose a new time whenever you like, or wait for our call.
        </div>
      ) : null}

      {appointment && !changing ? (
        <Upcoming
          loaded={loaded}
          calendar={calendars.find((c) => c.staff_id === appointment.staff_id)}
          link={link}
          locationName={locationName}
        />
      ) : (
        <Chooser loaded={loaded} calendars={calendars} params={params} link={link} locationName={locationName} />
      )}
      {appointment && changing ? (
        <p>
          <Link href={link('')} className="font-semibold text-primary underline underline-offset-4">
            Keep {formatAppointment(new Date(appointment.starts_at), tz)}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Upcoming({
  loaded,
  calendar,
  link,
  locationName,
}: {
  loaded: LoadedBooking;
  calendar: StaffCalendar | undefined;
  link: (query: string) => string;
  locationName: (calendar: StaffCalendar | undefined) => string | undefined;
}) {
  const { pack, token } = loaded;
  const appointment = loaded.context.appointment!;
  const { noun } = pack.booking;
  const start = new Date(appointment.starts_at);
  return (
    <section aria-labelledby="upcoming" className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-8">
      <h2 id="upcoming" className="text-2xl">
        Your {noun}
      </h2>
      <p className="mt-3 text-xl font-semibold">{formatAppointment(start, pack.brand.timeZone)}</p>
      {calendar ? (
        <p className="mt-1 text-ink-muted">
          With {calendar.full_name}, {calendar.title}
          {locationName(calendar) ? ` · ${locationName(calendar)}` : ''}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={link(`change=1&staff=${appointment.staff_id}`)} className={buttonClasses()}>
          Change the time
        </Link>
        <Link
          href={`/pay?t=${encodeURIComponent(token)}&i=${pack.id}`}
          className={buttonClasses({ variant: 'secondary' })}
        >
          Pay online (test payment)
        </Link>
        <form action={cancelBooking}>
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="appointment" value={appointment.id} />
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Cancel this {noun}
          </Button>
        </form>
      </div>
    </section>
  );
}

function Chooser({
  loaded,
  calendars,
  params,
  link,
  locationName,
}: {
  loaded: LoadedBooking;
  calendars: StaffCalendar[];
  params: Record<string, string | string[] | undefined>;
  link: (query: string) => string;
  locationName: (calendar: StaffCalendar | undefined) => string | undefined;
}) {
  const { pack, token, context } = loaded;
  const { noun } = pack.booking;
  const tz = pack.brand.timeZone;
  const changing = str(params.change) === '1' ? 'change=1&' : '';
  const selected = calendars.find((c) => c.staff_id === str(params.staff)) ?? calendars[0];
  if (!selected) {
    return (
      <p className="rounded-md border border-line bg-surface p-6">
        No {noun} times are open online right now. We will call you to arrange one.
      </p>
    );
  }
  const days = slotsByDay(slotsOf(selected, pack), tz);
  const day = days.find((d) => d.date === str(params.day)) ?? days[0];
  const languages = (calendar: StaffCalendar) =>
    calendar.languages.map((code) => pack.languages.find((l) => l.code === code)?.label ?? code).join(', ');

  return (
    <>
      {calendars.length > 1 ? (
        <section aria-labelledby="who">
          <h2 id="who" className="text-2xl">
            Who you will see
          </h2>
          <p className="mt-2 text-ink-muted">
            {context.specialty_slug
              ? `These are the people for what you asked about. Choose one to see their times.`
              : `Choose someone to see their times. We can change this later if another person suits you better.`}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {calendars.map((calendar) => {
              const current = calendar.staff_id === selected.staff_id;
              return (
                <li key={calendar.staff_id}>
                  <Link
                    href={link(`${changing}staff=${calendar.staff_id}`)}
                    aria-current={current ? 'true' : undefined}
                    className={`block min-h-12 rounded-md border p-4 ${current ? 'border-primary bg-surface-teal' : 'border-line bg-surface hover:border-primary'}`}
                  >
                    <span className="block font-semibold">{calendar.full_name}</span>
                    <span className="block text-sm text-ink-muted">{calendar.title}</span>
                    <span className="block text-sm text-ink-muted">Speaks {languages(calendar)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p>
          You will see <strong>{selected.full_name}</strong>, {selected.title}
          {locationName(selected) ? ` at ${locationName(selected)}` : ''}.
        </p>
      )}

      {days.length === 0 || !day ? (
        <p className="rounded-md border border-line bg-surface p-6">
          {selected.full_name} has no open times in the next {pack.booking.horizonDays} days. Choose someone else, or
          wait for our call.
        </p>
      ) : (
        <>
          <nav aria-label="Days with open times">
            <h2 className="text-2xl">Choose a day</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {days.map((d) => {
                const current = d.date === day.date;
                return (
                  <li key={d.date}>
                    <Link
                      href={link(`${changing}staff=${selected.staff_id}&day=${d.date}`)}
                      aria-current={current ? 'date' : undefined}
                      className={`inline-flex min-h-12 flex-col justify-center rounded-md border px-4 py-2 text-sm ${current ? 'border-primary bg-primary text-surface' : 'border-line bg-surface hover:border-primary'}`}
                    >
                      <span className="font-semibold">{formatDay(d.date)}</span>
                      <span>
                        {d.slots.length} {d.slots.length === 1 ? 'time' : 'times'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <form action={bookSlot} className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-8">
            <input type="hidden" name="t" value={token} />
            <input type="hidden" name="staff" value={selected.staff_id} />
            <RadioGroup
              id="booking-time"
              name="start"
              legend={`Times on ${formatDay(day.date)} (${zoneLabel(tz)})`}
              hint={`Each ${noun} takes about ${pack.booking.slotMinutes} minutes.`}
              columns={4}
              options={day.slots.map((slot) => ({
                value: slot.start.toISOString(),
                label: formatTime(slot.start, tz),
              }))}
            />
            <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto">
              {context.appointment ? 'Move my booking to this time' : `Book this ${noun}`}
            </Button>
          </form>
        </>
      )}
    </>
  );
}
