# NEXT.md

Status at the end of **Phase 2** (2026-10-10). The next session starts here.

## Milestones

Tag pushes are refused by the git proxy in cloud sessions (HTTP 403), so the tags exist locally and their commits are
listed here. Recreate a tag anywhere with `git tag -a phase-N-complete <sha> -m "Phase N complete"`.

| Tag                | Commit                                  | What                                         |
| ------------------ | --------------------------------------- | -------------------------------------------- |
| `phase-1-complete` | `10988d3`                               | Brand kit, website, intake forms, data model |
| `phase-2-complete` | the commit titled "Phase 2 complete: …" | CRM, staff workspace, nurture sequences      |

## Done in Phase 2

- **Auth and roles.**
  - Four roles from the clinic pack: manager, care coordinator, specialist doctor and billing desk.
  - The permissions matrix lives in `packages/core/src/permissions.ts`. It is enforced in the UI, in every server
    action, and in Postgres (RLS policies plus checks inside each `security definer` function).
  - One demo user per role is seeded into `auth.users`. One-click demo logins appear only with `DEMO_LOGIN=true`.
  - Sign-in is throttled per IP and email. Sessions last 8 hours. Pages the role may not open return a real 403.
- **Pipeline.**
  - Board columns come from the pack.
  - Cards move by pointer, touch or keyboard drag, or with each card's Move menu. Moves are optimistic, audited
    (`stage.changed`) and can be undone.
  - Filters (assignee, specialty, language, urgency, source, type, date range) live in the URL.
  - A sortable, searchable list view sits beside the board.
- **Lead profile.**
  - Contact details, concern, qualifying answers, consent status and history (with staff-recorded withdrawal).
  - Assignment, with the reason shown on the timeline.
  - A timeline built from `lead_events`, notes from templates, and tasks with due dates and reminders.
  - Messages with channel and status (a "Simulated" badge for SMS and WhatsApp).
  - Sequence enrolments with their steps, a lead score with its factor breakdown, and an "AI summary" placeholder.
- **Workspace.**
  - Today's tasks, my leads, the unassigned queue (front desk only) and a seven-day agenda.
  - SLA timers on cards and lists (first-response targets per urgency, with overdue warnings).
  - The workspace link counts tasks whose reminder is due.
- **Assignment.** Manual assign and reassign through `assignLead(lead, context)` in `packages/core`. Each decision
  carries an explanation, logged with the `lead.assigned` event.
- **Nurture.**
  - Six sequences in the pack: `new-lead-welcome`, `appointment-reminder`, `no-show-recovery`, `post-visit-check-in`,
    `follow-up-due` and `package-renewal`. Each has steps (delay, channel, template) and the stages that start and
    cancel it.
  - Stage changes enrol and cancel in the same transaction.
  - Sequences stop on a reply ("Mark as replied", or the signed webhook `/api/messages/inbound`), an unsubscribe (link
    page and RFC 8058 one-click), consent withdrawal, a cancelling stage or a manager pause.
  - The worker (`packages/messaging`) is idempotent and safe in parallel. It runs from `pnpm worker`, the cron route
    and a Netlify scheduled function.
  - A manager screen previews, pauses and resumes sequences and shows enrolment statistics.
  - The 12-month retention purge runs with the worker.
- **Data.**
  - Migrations `20261011000001` to `…04`: `notes`, `tasks`, `sequence_enrollments`, `scheduled_messages`, `messages`,
    `lead_scores` and `sequence_settings`, all with RLS.
  - Staff helper functions, staff write functions, worker functions, and the `crm_server` and `nurture_worker` roles.
  - The seed has 12 staff and 40 deterministic demo leads across all stages. Their timelines, messages, tasks and some
    overdue SLAs are replayed through the real sequence planner.
- **Design.**
  - The CRM uses the same `packages/ui` tokens in a denser layout: a sidebar on laptops and a menu on tablets.
  - Light, dark and auto themes (stored in a cookie).
  - Designed empty, loading, error, 403 and not-found states.

## Verified, and how

- **`pnpm check`** (lint, typecheck, test, build) passes. Both apps' builds include the client-bundle secrets check,
  which now also covers the Phase 2 secrets (every `*_DATABASE_URL` and `*_SECRET`).
- **Vitest: 233 tests across 14 files.**
  - core (86): permissions matrix, lead visibility, stage plans, stop conditions, scoring, SLA, templates and
    `assignLead`.
  - db (64, against a real Postgres 16). Highlights:
    - RLS for every demo user compared with `canSeeLead`; a doctor cannot read another doctor's lead, even by id.
    - Staff-function authorisation.
    - The worker run twice and in parallel with no duplicate sends.
    - Send-time stops, pause, retry and crash recovery.
    - Retention, erasure of CRM data, and unsubscribe.
  - messaging (6), ui (59) and web (18).
- **Playwright.**
  - Website: 62 checks at 375 px and 1280 px.
  - CRM: 40 checks at 1366×860 laptop and 820×1180 touch tablet:
    - sign in as each role, each seeing exactly the leads the matrix allows;
    - a coordinator gets a 403 on manager screens, even by URL;
    - a doctor opening another doctor's lead by URL gets "This lead is not available to you";
    - password sign-in, rejection and sign-out;
    - website enquiry → CRM → stage moves → undo;
    - keyboard-only Move menu and keyboard drag-and-drop;
    - filters and sorting;
    - notes from templates; tasks created and completed;
    - keyboard assignment, with its recorded reason;
    - a sequence enrols, sends its first message and stops on reply;
    - unsubscribe takes effect at once;
    - the webhook rejects unsigned and stale requests;
    - the cron route rejects a wrong secret;
    - a manager pauses and resumes a sequence;
    - the reminder count in the navigation.
- **Lighthouse on the CRM** (local `next start`, signed in as the manager):

  | Preset           | Pages                                                    | Performance | Accessibility | Best practices |
  | ---------------- | -------------------------------------------------------- | ----------- | ------------- | -------------- |
  | Desktop          | login, board, list, workspace, a lead profile, sequences | 100         | 100           | 100            |
  | Mobile emulation | board, list, workspace, a lead profile, sequences        | not scored  | 100           | 100            |

- **Visual review** from screenshots at 1366×860 and 820×1180, in light and dark. Fixes made along the way:
  - board cards overflowing their columns;
  - every demo reference reading `1EAD-0000`;
  - a ragged filter row on tablets (now a grid);
  - wrapped names in the list;
  - "After 1 days";
  - leftover e2e leads cluttering the demo board (both suites now clean up after themselves).

## Not verified

- **Live Supabase, again.** Everything ran against the local Postgres 16 with Supabase's roles and `auth` schema
  emulated. On a real project, check `auth.users` inserts from the seed, `AUTH_PROVIDER=supabase`, and the
  `crm_server` login through the pooler.
- **Real email.** No verified sending domain yet, so `RESEND_API_KEY` is commented out in `.env`. Emails are recorded
  as `logged`, and the console shows a redacted copy. The Resend request (headers, idempotency key,
  `List-Unsubscribe`) is unit-tested with a mocked fetch.
- **Netlify deploys**, including the scheduled function (`apps/crm/netlify/functions/nurture-cron.mts`): no account
  access.
- **Real devices, Safari and Firefox, and screen readers.** Only Chromium emulation and automated checks were used.
  Touch dragging was exercised only through Playwright's touch emulation, and the Move menu is the dependable touch
  path.

## Known gaps and caveats

- **Phase 3 hooks.**
  - The "AI summary" panel is a placeholder.
  - The `ai_triaged` stage exists, but nothing triages automatically yet.
  - `assignLead` supports only `mode: 'manual'`.
- **Partner leads share the clinic board** (filter by Type). Separate partner stages may come with Phase 4's packs.
- **Lists are not paginated.** Filtering and sorting happen on the server, in memory over the role's visible leads.
  That is fine for hundreds of leads; add SQL pagination before thousands.
- **No Content-Security-Policy header yet**, on either app. The CRM is fully dynamic, so a nonce-based CSP is now
  practical; do it in Phase 4's hardening pass.
- **Reminders are in-app only** (a count on the workspace link and a label on the task). Staff do not receive email or
  push reminders.
- **The inbound webhook is a stub contract** (signed JSON with `lead_id`, `channel`, `body`). A real SMS or WhatsApp
  provider needs an adapter that maps its payload and verifies its own signature.
- **Rotate the supplied keys.** The database password, Resend, Gemini and LiveKit keys were pasted into a chat. The
  Gemini key starts with `AQ.` rather than the usual `AIza`; check it first thing in Phase 3.

## Exact first steps for Phase 3

1. Read `CLAUDE.md`, this file, `DECISIONS.md` and `docs/ARCHITECTURE.md`. Start the database with
   `pnpm db:local start`, then run `pnpm check`, then `pnpm build && pnpm test:e2e`.
2. **Routing engine** in `packages/core/src/routing/`.
   - Pure functions: `routeLead(lead, roster, weights, now)` returns a choice plus an explanation with a score
     breakdown.
   - Weights go in the pack as a new `routing` block. A hard filter on specialty falls back to a care coordinator.
     Score on language, urgency (rank via `staffLevels[].rank`), load against `staff.capacity`, a returning patient's
     previous doctor, and the billing flag copying in the billing desk. Tie-breaks are deterministic.
   - Add `mode: 'auto'` to `AssignmentContext` in `packages/core/src/crm/assignment.ts` and keep `assignLead`'s
     signature. The CRM already stores `decision.explanation` under `payload.routing` and renders it on the timeline.
   - Tests: table-driven cases, plus a simulated week of leads to check that nobody is starved or overloaded.
   - The SQL `assign_lead(lead, staff, reason, routing jsonb)` already accepts the explanation. It hardcodes
     `method: 'manual'` in the event payload, so add a migration that takes the method from `p_routing`.
3. **Contracts.** Use zod 4's `z.toJSONSchema()` on the schemas in `packages/core`: the voice result payload and the
   intake answers. Write the output to `packages/core/contracts/*.json`. Generate pydantic models for `apps/voice` with
   `datamodel-code-generator`. `pnpm contracts:check` must regenerate into a temporary folder and diff; add it to
   `pnpm check`.
4. **`/api/voice/complete` in `apps/crm`.**
   - Reuse `verifySignedRequest` from `lib/server/webhooks.ts`, with a new `VOICE_WEBHOOK_SECRET`.
   - Add a `call_sessions` migration: transcript and summary under RLS, never logged.
   - A `security definer` function records the call, moves the lead to `ai_triaged` with its sequence plan, and runs
     routing.
   - Fill the AI summary panel in `app/(app)/leads/[id]/page.tsx`.
5. **`apps/voice`.**
   - Python and LiveKit Agents, with a Gemini Flash-class model.
   - Research the free STT and TTS tiers, and log the choice with its date in `DECISIONS.md`.
   - Build the conversation from the pack's `voicePrompt`s. Enforce the safety rules with a tested red-flag list.
     Refuse to run if `REAL_DATA=true`.
   - Cost guards: maximum call length and calls per day, plus a usage counter.
6. **Browser widget** on Home and Contact, with a typed fallback. Then a simulated dialer with the call-window,
   consent, opt-out and daily-cap checks. Then the eval harness: at least 20 scenarios through `pnpm eval:voice`,
   writing `docs/VOICE_EVAL.md`.
7. Keep `main` and the session branch identical. Tag `phase-3-complete` and add its commit to the milestones table.
