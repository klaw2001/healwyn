# NEXT.md

Status at the end of **Phase 4** (2026-10-11), the last planned phase. The platform is a complete, tested demo. This
file says what is done, what was verified and how, what was not, the known limitations, and what to do before showing
it to a real client.

## Milestones

Tag pushes are refused by the git proxy in cloud sessions (HTTP 403), so the tags exist locally and their commits are
listed here. Recreate a tag anywhere with `git tag -a phase-N-complete <sha> -m "Phase N complete"`.

| Tag                | Commit                                  | What                                                   |
| ------------------ | --------------------------------------- | ------------------------------------------------------ |
| `phase-1-complete` | `10988d3`                               | Brand kit, website, intake forms, data model           |
| `phase-2-complete` | `30d1ea7`                               | CRM, staff workspace, nurture sequences                |
| `phase-3-complete` | `c4ed355`                               | Routing engine, AI intake assistant, simulated calls   |
| `phase-4-complete` | the commit titled "Phase 4 complete: …" | Industry packs, booking, payments, dashboard, demo kit |

## Done in Phase 4

- **Four industry packs** (`packages/core/src/industries`): Healwyn Clinics, Nestwyn Realty, Ledgerwyn Wealth and
  Loomwyn Interiors. Each has its brand (in `BRANDS`), theme (light and dark, contrast-tested), site copy, intake and
  consents, stages (including a no-show stage), staff levels, routing weights, sequences and templates, SLA and
  scoring, booking and payment settings, voice script in English and Hindi with its own safety lists, and 40 demo
  leads. A generic contract test holds every pack to the same shape.
- **Runtime selection.** The website is generated per pack under `/[industry]` and `proxy.ts` picks one (demo cookie,
  else `INDUSTRY`); the CRM follows the signed-in staff member's industry; anything acting on a lead uses the lead's
  pack. Industry is enforced in RLS (`staff_can_see_lead`, `industry_stages`).
- **Booking** (`20261014000001_booking.sql`, `packages/core/src/booking`): weekly hours and exceptions, `openSlots`,
  an exclusion constraint against double booking, booking functions that re-check slots and move stages with their
  nurture plans, the worker's automatic no-shows, the public `/book` flow from a signed link, and the CRM's booking
  panel, Bookings screen and Hours screen.
- **Payments** (`20261015000001_payments.sql`): Razorpay test mode or a simulated checkout through the same signed,
  idempotent, forward-only event handling; live keys refused at start-up and in SQL; `/pay` from the person's link; the
  CRM payment panel and payment links.
- **Manager dashboard** (`/dashboard`, `docs/METRICS.md`).
- **Demo kit**: demo bars (industry switch, Reset demo, guided tour), `pnpm demo:reset`, the case-study page, the
  architecture diagram (`docs/architecture.svg`, Mermaid in `docs/ARCHITECTURE.md`), `docs/PITCH.md`,
  `docs/WALKTHROUGH_SCRIPT.md`, `docs/DECK_OUTLINE.md`, `docs/FREE_TIER_REPORT.md` and `docs/DEPLOY.md`.
- **Hardening**: a Content-Security-Policy on both apps; zod in jitless mode (no runtime code generation); the voice
  engine no longer lets the model read an answer out of an advice request (found by the Gemini eval run); a dependency
  audit (no known vulnerabilities); new public endpoints rate-limited and tied to the link's own lead.

## Verified, and how

- **`pnpm check`** passes: ESLint and Prettier, ruff, typecheck, `contracts:check`, Vitest (602 tests: core, ui,
  messaging, web, crm, and db against a real Postgres 16), pytest (99), and both production builds with the
  client-bundle secrets check.
- **Database tests** for Phase 4: double booking refused by the constraint and by the functions, slots outside the
  hours refused, rescheduling and cancelling with stage return, who may book whom, attended and automatic no-shows
  starting recovery, calendars invisible across industries; payments marked paid once (duplicate events ignored), a
  late failure never undoing a payment, unknown orders and live mode refused; every staff member of every industry
  seeing exactly the leads `canSeeLead` allows.
- **Playwright**, against production builds and the local database:
  - Website (375 and 1280 px): every page of the default pack (now including `/book`, `/pay`, `/case-study`), the CSP
    and other headers, redirects from the Phase 1 addresses, booking (book, move, cancel) and payments (decline, retry,
    pay) from the person's link.
  - CRM (laptop and tablet): booking from a lead, the Bookings screen, marking attended, an expert's own hours, the
    billing desk's limits, payment links, the dashboard (numbers match a direct query; filters; 403 for non-managers).
  - **The full journey for each of the four industries**: site re-skinned by the demo cookie, the pack's own form,
    a simulated assistant call, routing, the CRM, booking on the person's link and a test payment that moves the lead to
    the pack's won stage.
- **Voice eval** (`docs/VOICE_EVAL.md`): 233 scenarios across the four packs. Deterministic 229/233 (the four misses are
  descriptions that name no option, marked as needing the model); with Gemini 233/233. Every red-flag and no-advice
  scenario passes in both.
- **Lighthouse** (mobile emulation, production build) for every industry theme: Home, Contact, Services and the case
  study scored 94 to 99 for performance and 100 for accessibility and best practices (after removing zod's `Function`
  probe, which the CSP reported); Book scored 98 to 99.
- **The five-minute demo in `docs/PITCH.md`, run in a browser** with `DEMO_MODE` and `DEMO_LOGIN` on: the demo bar,
  the form, the assistant button, booking, the test payment, the front desk's view of the lead in Package active, a
  simulated assistant call, the summary, booking and payment panels, the Bookings screen, the manager's dashboard, the
  industry switch and the tour. Also Reset demo and the CRM's industry switch. **One step needed fixing**: the script
  told the presenter to show the assistant's summary on the form's lead, but the website chat creates its own enquiry;
  the script now ticks both consents and runs the CRM's simulated call on that lead. Every example phrase in the
  industry talk tracks was checked against that pack's safety rules.

## Not verified

- **Razorpay's real test mode.** No test keys were available, so orders, Checkout and webhooks from Razorpay itself
  have only been exercised through unit tests (order request, signatures, event parsing) and the simulated provider.
- **Voice latency and real speech, real phone calls, hosted agent and text service**: unchanged from Phase 3 (the
  sandbox blocks WebRTC; there is no SIP trunk).
- **Live Supabase, Netlify, and real email**: everything ran against the local Postgres 16. `docs/DEPLOY.md` has not
  been followed end to end on real accounts.
- **The guided tour across two real domains** (only checked on localhost), real devices and screen readers.

## Known limitations

- **The CSP allows inline scripts** (`'unsafe-inline'`): the pages are static per industry, so per-request nonces would
  mean rendering every page on demand. It still restricts every other origin.
- **`DEMO_MODE` is read when the website is built** (static pages). Changing it needs a rebuild.
- **Booking** offers one range per weekday (no split shifts), slots of one length per pack, and India time only.
  Experts can book only into their own calendar. There are no booking confirmation emails beyond the pack's reminder
  sequence, and no calendar invites (ICS).
- **Payments** have no refunds and no receipts or invoices. A started but abandoned order stays "Started".
- **The dashboard** reads live tables on every load; fine for demo volumes, but it would need indexes or rollups at
  scale. Lists elsewhere are not paginated.
- **Message templates** use `{specialty}` with a generic fallback when someone chose "not sure".
- **Gemini's free tier** may use inputs to improve Google's products: synthetic data only.
- **LiveKit's free credit** may cover as few as about 30 voice calls a month depending on the voice
  (`docs/FREE_TIER_REPORT.md`); typed chat is unaffected.
- **Rotate the supplied keys.** The database password, Resend, Gemini and LiveKit keys were pasted into a chat.

## Before showing it to a real client (in order)

1. **Rotate every key** and move secrets into the hosting dashboards only.
2. **Deploy following `docs/DEPLOY.md`** (Supabase in Mumbai, both Netlify sites, Render) and run the five-minute demo
   on the real URLs; record the 90-second walkthrough there.
3. **Razorpay test keys**: set them, add the webhook, and run a payment through Razorpay's own test checkout.
4. **Voice on a real network and phone**: measure latency, try Hindi and noisy rooms, and decide the speech voice
   (cost differs, see the free-tier report).
5. **The client's own pack**: their questions, staff, stages, wording, and a review of the safety rules by someone from
   their field (a doctor, a registered advisor, an engineer).
6. **Legal and privacy review** of consents, the privacy notice and data retention for their use, and move Gemini to the
   paid tier before any real personal data.
7. **Real channels**: a verified email domain, then an Indian SMS/WhatsApp provider (DLT registration) and a SIP trunk
   from an Indian provider for phone calls.
8. **A third-party security review** and a basic load test; add monitoring and alerting (errors, the cron, credit
   meters).
9. **Product gaps that clients will ask for**: confirmation emails with calendar invites, refunds and receipts,
   pagination, exports to their existing tools.
