# Manager dashboard metrics

Every number and chart on the CRM's `/dashboard` (managers only, capability `screen.dashboard`) is computed from the
database on each request. Nothing is hardcoded or cached. This page gives, for each one, a plain-English definition,
the function that computes it, the SQL it runs and the caveats.

- **Queries**: `apps/crm/lib/server/dashboard.ts`, one exported function per metric, all called by `loadDashboard`.
- **Arithmetic** (shares, percentiles, weeks, funnel steps, takeaway wording): `apps/crm/lib/dashboard-math.ts`, pure
  functions with no database access.
- **Page**: `apps/crm/app/(app)/dashboard/page.tsx`; charts in `apps/crm/components/dashboard/charts.tsx`.

## How every query is scoped

**Row level security, not hand-written filters.** Every query runs inside `asStaff(session, tx => …)`, which sets
`role authenticated` and the manager's JWT claims for the transaction. The `leads` policy (`staff_can_see_lead`) then
limits rows to the manager's own industry, and `lead_events`, `appointments`, `call_sessions` and `staff` are limited
the same way through their own policies. No query filters by industry by hand. The industry pack (from the signed-in
manager's industry) is used only for stage order and labels, the booked and no-show stage ids, SLA targets and the
roles that take bookings.

**Filters** (a GET form, so every view has its own URL):

| Parameter  | Meaning                                                                                          | Default             |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------- |
| `from`     | First day, inclusive, `YYYY-MM-DD` in the pack's time zone (India time, `Asia/Kolkata`)          | 29 days before `to` |
| `to`       | Last day, inclusive                                                                              | Today (India time)  |
| `offering` | One of the pack's offering slugs (a specialty for the clinic), matched to `leads.specialty_slug` | Any                 |

`resolveRange` swaps a reversed range, replaces an unreadable date with the default, and caps the range at 366 days;
each adjustment is shown on the page. An unknown `offering` is ignored. The day boundaries become timestamps in SQL:

```sql
-- bounds(): midnight at the start of `from` and after the end of `to`, India time
start = (:from::date::timestamp at time zone 'Asia/Kolkata')
end   = ((:to::date + 1)::timestamp at time zone 'Asia/Kolkata')
```

**The lead cohort.** Most metrics look at the same set of leads, built by `cohort()`:

```sql
select l.id, l.stage, l.source, l.urgency, l.created_at, l.first_response_at
from public.leads l
where l.lead_type = 'individual'
  and l.created_at >= :start
  and l.created_at < :end
  and l.specialty_slug = :offering        -- only when an offering is chosen
```

- **Partner leads are left out** (`lead_type = 'individual'`) everywhere except team load: partner enquiries do not
  go through the patient funnel, bookings or the assistant.
- **Erased leads are kept** in the cohort metrics (funnel, first response, sources, conversion, no-shows, calls).
  `erase_lead` clears personal data in place but keeps stage, source, urgency and timestamps precisely so that these
  aggregates stay correct after a withdrawal; dropping them would make history change whenever someone withdraws
  consent. They are **left out of team load**, matching routing, because nobody can work an erased lead.
- **Demo leads are kept** (`is_demo` is not filtered): this is a demo.

**Empty data.** A share with a zero denominator is `null` (`share()`), shown as "—". Charts are replaced by a sentence
when there is nothing to draw. No number can render as NaN.

## Key numbers (the six tiles)

| Tile                      | Definition                                                                                                  | Source                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Leads created             | Leads in the cohort                                                                                         | `funnel` → `total`              |
| Reached _won stage_       | Leads in the cohort whose furthest funnel step is the won stage (clinic: Package active), and its share     | `funnel` → last row             |
| First response on time    | Answered within target ÷ (answered + waiting past target)                                                   | `firstResponse` → `onTimeShare` |
| Median first response     | Median minutes from enquiry to first response, among answered leads; the detail line is the 90th percentile | `firstResponse`                 |
| No-show rate              | Missed ÷ (attended + missed), finished appointments that started in the range                               | `noShows` → `rate`              |
| Assistant calls qualified | Calls with outcome `completed` ÷ all finished calls that started in the range                               | `callOutcomes`                  |

## Funnel by stage

**Function:** `funnel()` (with `funnelSteps`, `funnelRows` and `biggestDrop` from `dashboard-math.ts`).

**Steps.** The pack's open stages in pipeline order, then its won stages. The pack's no-show stage
(`booking.noShowStageId`) is a side stage, not a step: a lead that was in it counts at the step before it (it was
booked). Lost stages are not steps. For the clinic pack the steps are New → AI triaged → Appointment booked → Visited
→ Follow-up due → Package active, with positions 0 to 5; No-show maps to position 2.

**Reached.** A lead reached a step when that step is at or before the furthest step it has ever been in. "Ever been
in" means its current stage or the `from` or `to` of any of its `stage.changed` events. Counting the furthest step
(rather than "has an event into this stage") matters because leads skip stages: staff often move a lead straight from
New to Appointment booked, and the seed does too. Every lead reaches the first step, so the first bar is the cohort.

```sql
with scope as (/* cohort */),
visited as (
  select s.id, s.stage as stage_id from scope s
  union
  select e.lead_id, e.payload ->> 'to' from public.lead_events e
    join scope s on s.id = e.lead_id where e.type = 'stage.changed'
  union
  select e.lead_id, e.payload ->> 'from' from public.lead_events e
    join scope s on s.id = e.lead_id where e.type = 'stage.changed'
),
furthest as (
  select v.id, coalesce(max(m.position), 0) as position
  from visited v
  left join unnest(:stage_ids::text[], :positions::int[]) as m(stage_id, position) on m.stage_id = v.stage_id
  group by v.id
)
select step.position, count(f.id)::int as reached
from generate_series(0, :step_count - 1) as step(position)
left join furthest f on f.position >= step.position
group by step.position
order by step.position;

-- Lost (shown under the chart and in the table)
with scope as (/* cohort */)
select count(*)::int as n from scope where stage = any(:lost_stage_ids::text[]);
```

`:stage_ids` and `:positions` come from `funnelSteps(pack.stages, [pack.booking.noShowStageId])`.

**Derived numbers** (`funnelRows`):

- _Of all leads_ = reached ÷ leads created.
- _Went no further_ (drop-off) = reached at this step − reached at the next step. It includes leads that are lost and
  leads still sitting at this step; the funnel does not wait for a lead to finish.
- _Drop-off %_ = went no further ÷ reached at this step.
- _Now in a lost stage_ = cohort leads whose current stage has kind `lost`.

**Takeaway:** "_W_ of _N_ leads (_x_%) reached _won stage_. The biggest drop-off is between _A_ and _B_: _d_ of _r_
(_y_%) went no further." The biggest drop-off is the consecutive pair with the most leads lost, ties broken by the
higher rate (`biggestDrop`).

**Caveats:** an undone stage move leaves a `stage.changed` event whose `from` is the stage the lead was undone out
of, so a mistaken move still counts as reached. Stage ids in old events that are no longer in the pack are ignored.

## First response against target

**Function:** `firstResponse()`.

**Definition.** For every lead in the cohort, the first response time is `first_response_at − created_at`
(`first_response_at` is set by the first staff action on the lead). Each lead is judged with `slaStatus` from
`@healwyn/core` against the pack's target for its urgency (`pack.crm.sla.firstResponseMinutes`; clinic: urgent 1 h,
high 4 h, normal 1 day, low 2 days), the same rule the pipeline's SLA badges use:

| Bucket on the chart          | `slaStatus` state      | Meaning                                       |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| Answered on time             | `met`                  | Responded at or before the due time           |
| Answered late                | `met_late`             | Responded after the due time                  |
| Waiting, still within target | `on_track`, `due_soon` | No response yet, due time not passed          |
| Waiting past target          | `overdue`              | No response yet, due time passed (judged now) |

```sql
with scope as (/* cohort */)
select urgency, created_at, first_response_at from scope;
```

The rows hold no personal data. In TypeScript:

- _Median_ and _90th percentile_ = `percentile(minutes, 0.5)` and `percentile(minutes, 0.9)` over answered leads only,
  with linear interpolation between ranks (the same as SQL `percentile_cont`).
- _On time %_ = answered on time ÷ (answered on time + answered late + waiting past target). Leads still inside their
  window are left out because their result is not known yet.
- _Waiting past target_ share = overdue ÷ all leads in the cohort.
- The table repeats every count per urgency, with that urgency's target and median.

**Takeaway:** "Half of the answered leads heard back within _median_, and _x_% of leads with a known result were
answered on time. _n_ still wait past the target."

**Caveats:** "now" is the time of the page request, so waiting buckets move as time passes. Demo leads' timestamps
are generated relative to the moment the seed ran.

## Missed appointments (no-show rate)

**Function:** `noShows()`. The heading uses the pack's booking noun ("Missed consultations" for the clinic).

**Definition.** Appointments that **started** in the range and have **already ended**, excluding cancelled ones, for
individual leads (and the chosen offering, by the lead's specialty).

```sql
select a.status, count(*)::int as n
from public.appointments a
join public.leads l on l.id = a.lead_id
where l.lead_type = 'individual'
  and a.status <> 'cancelled'
  and a.starts_at >= :start and a.starts_at < :end
  and a.ends_at <= now()
  and l.specialty_slug = :offering        -- only when an offering is chosen
group by a.status;
```

- _No-show rate_ = `no_show` ÷ (`attended` + `no_show`).
- _Not marked yet_ = ended appointments still `booked`. They are shown but not in the rate. (Unmarked bookings
  become missed automatically two hours after they end, see the bookings screen.)

**Takeaway:** "_m_ of _n_ marked consultations were missed (_x_%). _u_ finished consultations still need marking."

## Team load

**Function:** `staffLoad()`.

**Definition.** One row per active staff member whose role takes bookings (`pack.booking.bookableRoles`; clinic:
specialist doctors) or is a care coordinator. _Open leads_ is a snapshot of **now**, counted exactly as routing counts
load: leads of any type assigned to the person, not erased, in a stage of kind `open`. _Capacity_ is
`staff.capacity`. _Load_ = open leads ÷ capacity. _Appointments in period_ = their non-cancelled appointments that
start in the range.

```sql
select s.id, s.full_name, s.role, s.capacity, s.specialties,
  (select count(*)::int from public.leads l
    where l.assigned_staff_id = s.id and l.erased_at is null
      and l.stage = any(:open_stage_ids::text[])
      and l.specialty_slug = :offering) as open_leads,          -- offering line only when chosen
  (select count(*)::int from public.appointments a join public.leads l on l.id = a.lead_id
    where a.staff_id = s.id and a.status <> 'cancelled'
      and a.starts_at >= :start and a.starts_at < :end
      and l.specialty_slug = :offering) as appointments
from public.staff s
where s.active and s.role = any(:roles::text[])
order by array_position(:roles::text[], s.role), s.full_name;
```

With an offering chosen, the list keeps people who cover that offering (`staff.specialties`) or have any counted leads
or appointments. The date range does not change _open leads_ (it is a snapshot); it changes _appointments in period_.

**Chart.** Bars show load on one scale for everyone, from 0 to the larger of 100% and the highest load; the dark line
marks 100% (full capacity). Colour and a text label mark people at 80% or more ("near capacity") and over 100%
("over capacity").

**Takeaway:** "_Name_ is the most loaded: _o_ open leads against a capacity of _c_ (_x_%). _n_ people over capacity."
Staff names are colleagues' names, shown throughout the CRM; they are never logged.

## AI assistant call outcomes

**Function:** `callOutcomes()`.

**Definition.** Assistant calls (`call_sessions`, every channel: browser voice, typed chat, simulated dialer, phone)
that **started** in the range, for individual leads (and the chosen offering).

```sql
select case
         when c.status = 'started' and c.started_at >= now() - interval '15 minutes' then 'in_progress'
         when c.status = 'started' then 'never_finished'
         else coalesce(c.outcome, 'error')
       end as outcome,
       count(*)::int as calls
from public.call_sessions c
join public.leads l on l.id = c.lead_id
where l.lead_type = 'individual'
  and c.started_at >= :start and c.started_at < :end
  and l.specialty_slug = :offering        -- only when an offering is chosen
group by 1
order by 2 desc, 1;
```

**Grouping** (`CALL_OUTCOME_GROUP`), from the outcomes the database allows
(`20261012000004_call_safeguards.sql`):

| Group     | Stored outcomes                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completed | `completed`: the lead answered the questions and was qualified                                                                                                                            |
| Escalated | `emergency`: a red flag; the caller was told to seek emergency help and the lead was flagged urgent                                                                                       |
| Abandoned | `consent_declined`, `no_consent`, `caller_ended`, `limit_reached` (time or turn limit), and `never_finished` (still `started` after 15 minutes, the same rule as the AI assistant screen) |
| Failed    | `error`: the result could not be used (`fail_voice_call`), status `failed`                                                                                                                |

Calls started in the last 15 minutes and not finished are _in progress_: listed in the table, not counted.
_Total_ = the four groups. Each bar's percentage is its count ÷ total.

**Takeaway:** "_c_ of _n_ calls (_x_%) ended with the lead qualified; _a_ did not finish and _e_ were escalated to
emergency advice."

**Caveats:** a call with a safety flag that still finished (`completed`) counts as completed; escalation means the
call ended on the emergency path.

## Lead sources

**Function:** `sourcePerformance()`.

**Definition.** For each `leads.source` in the cohort (web form, voice assistant, phone, added by staff, demo data):

- _Leads_: leads in the cohort with that source.
- _Booked_: leads that were ever in the pack's booked stage (`booking.bookedStageId`, current stage or a
  `stage.changed` into it) **or** have any non-cancelled appointment.
- _Reached won stage_: leads that were ever in a stage of kind `won` (current stage or a `stage.changed` into it).
- _Conversion_ = reached won stage ÷ leads. _Booked %_ = booked ÷ leads.

```sql
with scope as (/* cohort */),
visited as (
  select s.id, s.stage as stage_id from scope s
  union
  select e.lead_id, e.payload ->> 'to' from public.lead_events e
    join scope s on s.id = e.lead_id where e.type = 'stage.changed'
),
per_lead as (
  select s.id, s.source,
    exists (select 1 from visited v where v.id = s.id and v.stage_id = :booked_stage_id)
      or exists (select 1 from public.appointments a where a.lead_id = s.id and a.status <> 'cancelled')
      as booked,
    exists (select 1 from visited v where v.id = s.id and v.stage_id = any(:won_stage_ids::text[]))
      as won
  from scope s
)
select source, count(*)::int as leads,
       count(*) filter (where booked)::int as booked,
       count(*) filter (where won)::int as won
from per_lead
group by source
order by leads desc, source;
```

**Chart.** One bar per source, length = leads (one scale for all sources, from zero), split into _reached won stage_
and _not yet_.

**Takeaway:** names the source with the most leads, and the source with the highest conversion when any lead has
converted.

**Caveats:** seeded demo leads have source `seed` ("Demo data"); leads the assistant created have source `voice`.

## Conversion over time

**Function:** `conversionByWeek()`.

**Definition.** Cohort leads grouped by the week they were **created** (weeks start on Monday, India time, as
Postgres `date_trunc('week')` does), with how many of those leads have reached a won stage **by now** (current stage
or a `stage.changed` into it). Weeks with no leads are filled in with zeros by `weekStarts` in TypeScript so the axis
has no gaps.

```sql
with scope as (/* cohort */),
won as (
  select distinct s.id from scope s
  where s.stage = any(:won_stage_ids::text[])
     or exists (select 1 from public.lead_events e
                where e.lead_id = s.id and e.type = 'stage.changed'
                  and e.payload ->> 'to' = any(:won_stage_ids::text[]))
)
select to_char(date_trunc('week', s.created_at at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') as week,
       count(*)::int as leads,
       count(w.id)::int as won
from scope s left join won w on w.id = s.id
group by 1
order by 1;
```

**Chart.** Columns of leads created on a zero-based axis with round ticks (`axis()`), each split into _reached won
stage_ and _not yet_. _Conversion_ in the table = won ÷ leads for that week.

**Takeaway:** "_w_ of _n_ leads (_x_%) have reached _won stage_ so far. The busiest week started _day_, with _k_
leads."

**Caveats:** this is cohort conversion: recent weeks have had less time to convert, so they look worse. The first
and last weeks can extend past the range; only leads created inside the range count.

## General caveats

- **Synthetic data.** All demo leads, staff, appointments and calls are generated by `pnpm db:seed`. Their timestamps
  are relative to the moment the seed ran, so the numbers change after a reseed and drift as days pass (leads move
  out of "last 30 days", waiting leads become overdue).
- **Time zone.** Dates are India days (the pack's `brand.timeZone`), not UTC days.
- **Live, not cached.** The page runs seven read-only transactions per request; nothing is stored. No metric logs
  names, phone numbers, emails or free text.
- **Changing a definition.** Change the function in `dashboard.ts` and the matching section here together.
