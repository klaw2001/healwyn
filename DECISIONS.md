# Decisions

One line each: the decision, then why. Newest phase at the bottom.

## Phase 1 (2026-10-10)

### Process and tooling

- **Git: commit on `main` and mirror it to the session branch `claude/cool-curie-bdscy2`.** The prompt book says to work on `main`; the cloud session was also assigned that branch, so both point at the same commits (no PRs, no divergence).
- **pnpm workspaces without Turborepo.** Four packages and one app build in seconds; no concrete need for a task runner.
- **Workspace packages ship TypeScript source, no build step.** Next.js transpiles them (`transpilePackages`), Vitest and tsx run TS directly; nothing to keep in sync.
- **TypeScript 6.0, not 7.0.** typescript-eslint supports `<6.1`; TS 7 (native port) drops the JS API that linting and Next's type check rely on.
- **ESLint 9, not 10.** eslint-config-next's React plugins are not yet verified on ESLint 10.
- **Playwright pinned to 1.56.1.** It matches the Chromium build preinstalled in cloud sessions (revision 1194), so no browser download is needed.
- **Prettier ignores SQL.** Prettier has no SQL parser; migrations are formatted by hand.

### Hosting (checked 2026-10-10, official sources)

- **Netlify Free for hosting.** No commercial-use restriction in its Terms or Self-Serve Subscription Agreement; credit-based Free plan (300 credits/month, hard limit: sites pause instead of billing; production deploy = 15 credits, deploy previews free); App Router and Server Actions fully supported via the OpenNext adapter; 60 s synchronous function timeout. Sources: docs.netlify.com billing for credit-based plans, netlify.com/legal/self-serve-subscription-agreement, docs.netlify.com/build/functions/configuration.
- **Not Cloudflare Workers Free.** Commercial use is allowed and the Worker size limit is now 64 MiB, but the 10 ms CPU limit per request is routinely exceeded by server-rendered Next.js pages (Cloudflare's own docs say SSR typically needs 10 to 20 ms).
- **Not Vercel Hobby.** Its fair use guidelines restrict Hobby to "non-commercial personal use only"; a freelancer's sales demo is commercial.
- **Netlify functions are IPv4-only and Supabase's direct DB host is IPv6-only on Free.** So in production use the Supabase store over HTTPS (service-role key) or the Supavisor transaction pooler (port 6543, prepared statements off), never the direct host.

### Data

- **All writes go through SQL functions** (`submit_lead`, `withdraw_consent`, `erase_lead`, `hit_rate_limit`). Each is one transaction, and the same function serves both transports.
- **Two interchangeable lead stores, picked by env (`LEAD_STORE=auto`).** It uses supabase-js RPC over HTTPS with the service-role key (preferred on serverless), or postgres.js with `DATABASE_URL`. An in-memory store exists for development only. In production with no database configured, submissions fail with a friendly message rather than silently using memory.
- **Phase 1 ran without the Supabase API keys.** The user supplied the database connection string, not the anon or service-role keys. Also, this cloud sandbox has no raw TCP or DNS access to Supabase, so everything was verified against a local Postgres 16 with Supabase's roles emulated (`supabase/local-shim.sql`). The live project still needs migrating; see `NEXT.md`.
- **Migrations use the Supabase CLI layout and history table.** Files live in `supabase/migrations/<version>_<name>.sql` and are recorded in `supabase_migrations.schema_migrations`, so our runner and `supabase db push` agree on what has been applied.
- **The migration runner also works over the Supabase Management API.** With `SUPABASE_ACCESS_TOKEN` and no `DATABASE_URL`, it runs over HTTPS, for environments that cannot open Postgres connections. It is unit-tested with a mocked fetch but not yet run against a live project.
- **Local Postgres without Docker.** `scripts/local-db.sh` uses the Postgres binaries directly and runs as the `postgres` user when invoked as root. The DB tests spin up a throwaway cluster, so `pnpm test` exercises the real SQL. Docker plus the Supabase CLI was rejected as heavy and slow in sandboxes.
- **Own type generator instead of `supabase gen types`.** The CLI needs Docker or an access token. Ours introspects any migrated database and emits the same `Database` shape, which supabase-js accepts.
- **Erasure anonymises in place instead of hard-deleting.** On withdrawal of the storage consent, the name, phone, email, note and answers are nulled, while the row, consent ledger and events stay with no personal data. This honours DPDP erasure while keeping funnel metrics for Phase 4. Check constraints make a half-erased row impossible.
- **Withdrawing `contact` (or `partner_contact`) consent erases data; withdrawing `assistant_call` does not.** This is driven by `erasesDataOnWithdrawal` in the pack.
- **Audit tables are append-only, enforced by a trigger.** `lead_events` and `consent_records` rows cannot be updated or deleted directly; they can only disappear through `ON DELETE CASCADE` from their lead. A history you can rewrite is not an audit trail.
- **Consent records store the text version and a SHA-256 of the exact wording shown,** with the brand and email already filled in. That way the record proves what was agreed even if copy changes, and a brand rename stays a one-line change.
- **RLS on every table, no policies, and explicit revokes from `anon` and `authenticated` in Phase 1.** The browser never talks to the database. Phase 2 adds staff policies together with explicit grants. Tests check all of this generically, so future tables are covered too.
- **Partner enquiries are stored in `leads` with `lead_type = 'partner'`.** Organisation, role and type go in `answers`. One table keeps consent, audit and erasure handling identical for both kinds of lead.
- **Pack-specific values are not enforced in SQL.** Stage ids and staff levels are pack-defined and validated in TypeScript, so the schema works for every Phase 4 industry. SQL only checks their format.
- **`specialties` mirrors the pack's offerings.** Page content stays in `packages/core`, and the seed copies the slugs and names so leads and staff can reference them.
- **Demo rows carry `is_demo = true`.** The seed replaces only those rows, so Phase 4's demo reset never touches real submissions.

### Forms and privacy

- **The free-text description is optional, capped at 500 characters, and carries a hint not to include sensitive details.** This keeps collection minimal under DPDP.
- **Phone numbers must be Indian mobiles.** Ten digits starting 6 to 9, with an optional +91, 91 or 0 prefix; landlines are rejected because the number is used for call-backs. `0` followed by `80…` is genuinely ambiguous (a Bengaluru landline or a mobile), so it is accepted as a mobile.
- **Email is optional for patients and required for partners.** Partners expect an email reply, while patients are called back.
- **The browser validates with the same zod schema as the server.** The form submits through the action dispatcher inside a transition, which avoids React 19's automatic form reset, so typed values survive a server rejection. Without JavaScript the form posts natively and the server re-renders it with its errors.
- **Specialty pre-selection (`/contact?specialty=…`) happens in a client effect.** Reading search params on the server would make the page dynamic.
- **A filled honeypot gets a fake success response and nothing is stored.** Bots learn nothing. No time-trap was added, because the spec asks for a honeypot plus rate limiting.
- **Rate limiting is a database-backed fixed window: 5 submissions per 10 minutes, per form, per hashed client IP.** An in-memory limiter is useless on serverless. The key is a salted SHA-256, so raw IPs are never stored. If the check itself errors, the request goes through, because storage reports its own failure. The IP is taken from `x-nf-client-connection-ip` (set by Netlify) first, then `x-forwarded-for`.
- **Notification emails leave out the name, full phone number and free text,** and include only the reference, choices and a masked phone. Email is a weak channel for health-adjacent data.
- **Notifications are sent after the response with `after()` and an idempotency key,** and failures are logged, never surfaced. The spec requires that a submission never fails because of email.
- **Resend sends from `onboarding@resend.dev` until a domain is verified.** That address delivers only to the Resend account owner, so `LEAD_NOTIFY_EMAIL` must be that address. The supplied key was checked with a read-only call: it is valid and has full access.
- **Logs are structured JSON with ids, codes and counts only.** Database error messages can echo row values, so errors are logged by name and code.

### Site and design

- **The site is `noindex` by default (`ALLOW_INDEXING`).** A fictional clinic must not show up in health searches.
- **Typography: Fraunces (display, optical sizing, 67 KB) and Atkinson Hyperlegible Next (body, 34 KB),** self-hosted from Fontsource through `next/font/local`. The pair is warm and humane without being clinical, Atkinson is designed for low-vision legibility, and no font CDN is involved.
- **Palette: warm paper background, teal ink, a single marigold accent; 17px body text.** It matches the brief: calm, reassuring, one warm accent. AA contrast for every pairing in both themes is enforced by a test.
- **Tailwind v4, with the tokens as CSS variables in `packages/ui/src/tokens.css` (`@theme inline`).** One source of tokens for the web and the CRM. Dark mode follows the system, and `data-theme` overrides it for the CRM later.
- **The mobile menu is a native `<details>` element keyed by path.** It needs no JavaScript and closes after navigation.
- **Doctor portraits are deterministic, featureless SVG illustrations.** The spec forbids photos of real or invented people, and illustrations read as clearly synthetic.
- **Clinic addresses are fictional streets in real cities, labelled "(fictional address)", with no map embed.** Real cities make the demo believable, and the label plus the lack of an embed keep it honest with no third-party trackers.
- **Health packages show no prices.** The spec says no price claims.

### End-of-phase review (2026-10-10)

An independent review pass found no secret leaks, no injection risks and no high-severity defects. These changes came out of it:

- **Line breaks count as one character.** Browsers submit textarea line breaks as CRLF, so the server normalises them before checking length. Without this, a message at the limit passed in the browser and failed on the server.
- **The honeypot field is named `hw_trap_x7`** and carries the password-manager ignore attributes. A field named `website` can be filled in by autofill, which would silently discard a real enquiry.
- **Validation runs before the rate limit, and only storable submissions count.** Typing mistakes no longer lock people out.
  - IPv6 addresses are limited per /64, since a client usually controls the whole block.
  - The Netlify IP header is trusted only when `NETLIFY=true` (`TRUSTED_IP_HEADER` overrides this).
  - Requests with no IP skip the limit instead of sharing one global bucket.
- **Without `RATE_LIMIT_SALT`, the rate limiter uses a random per-process salt instead of a published constant.** A known salt would let anyone brute-force the 2^32 IPv4 addresses back out of the hashes.
- **Rate-limit rows are pruned on every call,** so the privacy notice's one-day promise holds.
- **The website runs as a least-privilege role.** A login role in `web_submitter` (`WEB_DATABASE_URL`) can execute only `submit_lead` and `hit_rate_limit`, which are now `security definer`. A bug in the website can therefore no longer read leads, run DDL or disable triggers.
- **Audit tables cannot be truncated,** even by the owner, and API roles have no TRUNCATE, TRIGGER or REFERENCES privileges on any table. TRUNCATE skips row triggers, so it would bypass the append-only rule.
- **The audit trigger's existence check is `security definer`,** so row security cannot make an event that is still attached to its lead look orphaned (and therefore deletable) in Phase 2.
- **`submit_lead` requires every consent marked `required` to be granted.** Consent evidence now carries that flag. Previously any one granted consent was enough; this enforces the rule in the database for every caller, including the Phase 3 voice path.
- **Erasure reasons and withdrawal sources must be short codes** (`^[a-z0-9_.:-]{1,64}$`), and partner notification emails leave out the organisation. Free text must never reach the audit trail or email.
- **Accessibility fixes:**
  - the Hindi option is marked `lang="hi"`;
  - character counters are linked to their fields with `aria-describedby`;
  - the error summary is announced once (it uses `role="alert"` and takes focus, with no extra live region);
  - the partner error summary lists errors in page order.
- **`.env.example` leaves `DATABASE_URL` blank,** so `cp .env.example .env && pnpm dev` really does use the in-memory store.
- **For now, development uses the local Postgres** (`.env` points at `pnpm db:local`), at the user's request. Supabase is configured later, by swapping the connection strings.

## Phase 2 (2026-10-10)

### Auth and access

- **Supabase Auth's tables, our own session cookie.** Staff accounts live in `auth.users` and `auth.identities` (emulated locally by `local-shim.sql`, real on Supabase), and `staff.auth_user_id` links them. After the password check the CRM issues an 8-hour HS256 cookie (`jose`, `SESSION_SECRET`). The local Postgres has no GoTrue, and this keeps one code path for both. `AUTH_PROVIDER=supabase` sends the password check to Supabase Auth instead; that path is written but not run against a live project.
- **RLS is applied by impersonating Supabase's API.** `asStaff()` opens a transaction, runs `set local role authenticated` and sets `request.jwt.claims`, exactly what PostgREST does, so `auth.uid()` and every RLS policy behave as they would from supabase-js. The CRM's own login role (`crm_server`) holds nothing except membership of `authenticated` and `hit_rate_limit`.
- **Staff read through RLS and write only through `security definer` functions.** `authenticated` has SELECT and nothing else. Each function checks the caller's role (`app_private.acting_staff`) and visibility (`app_private.visible_lead`), validates codes, writes the audit event and applies side effects in one transaction. A write path that cannot skip the audit trail was worth more than direct table updates.
- **Visibility is one rule in two languages.** `LEAD_VISIBILITY` and `canSeeLead` in `packages/core`, and `staff_can_see_lead` in SQL. A DB test signs in as every demo user and compares what RLS returns with what `canSeeLead` predicts, so the two cannot drift.
- **Billing desk visibility:** leads assigned to them, leads flagged for billing (the pack's `billingRule`: has insurance) and leads in the won stage. A billing desk needs insured patients before the visit and every package sale after it, and nothing else.
- **Demo users are inserted into `auth.users` directly by the seed** (bcrypt through `extensions.crypt`, cost 8). The Auth admin API needs the service-role key, which was not supplied; Supabase accepts users created this way. Demo-login buttons render only when `DEMO_LOGIN=true`; the server action checks the flag again.
- **Login throttling: 10 attempts per 10 minutes per IP and email**, through the same `hit_rate_limit` as the forms. Keying on IP alone would lock out a whole clinic behind one office IP.
- **`forbidden()` for capability-guarded pages** (`experimental.authInterrupts`). A coordinator who types `/sequences` gets a real 403 page, not a redirect that hides the reason. Loading skeletons sit on data pages only, because a parent `loading.tsx` starts streaming with 200 before the page can refuse.

### CRM

- **Board: dnd-kit, plus a Move menu on every card.** dnd-kit supports pointer, touch and keyboard sensors with screen-reader announcements. Its keyboard sensor moves 25 px per key press, so a custom coordinate getter jumps whole columns. The Move menu (a native `<details>`) is the click and keyboard path that needs no dragging at all.
- **Optimistic moves with server confirmation.** A card moves at once; if the action fails it moves back and the toast says why.
- **Undo is another stage change** (reason `undo`), stored on a per-tab stack in sessionStorage. The audit trail keeps both moves, and undo survives navigation within the session as the spec asks.
- **Filters live in the URL.** Views can be bookmarked and shared, the back button works, and the server renders the filtered list.
- **The list view sorts in memory on the server** over the filtered rows (`sortLeads`, driven by `sort` and `dir` in the URL). At demo scale (tens to hundreds of leads) that is instant and keeps the query simple; paginate in SQL when a real clinic's volume needs it.
- **`assignLead(lead, context)` lives in `packages/core`.** Manual assignment returns a decision with a plain-language explanation (specialty and language match), stored with the `lead.assigned` event and shown on the timeline. Phase 3 adds routing as another `context.mode`.
- **Lead score: transparent rules from the pack, stored in `lead_scores`.** Each factor (urgency, consent to a call, insurance, recency, reply, overdue SLA, …) adds or subtracts points, the total is clamped to 0–100 and banded, and the profile shows every factor. A model would be a black box for a demo whose point is explainability.
- **SLA = time to first response, with a target per urgency** (urgent 1 h, high 4 h, normal 24 h, low 48 h). `first_response_at` is set by the first stage change, note or "mark as replied": an action that reaches or records contact with the patient. Assigning or creating a task does not count.
- **Task reminders fire 30 minutes before the due time** and show as a count on the workspace link and a "Reminder" label on the task. In-app only: SMS or email reminders to staff would need consent and a channel the demo does not have.
- **Theme choice is a cookie,** so the server renders the right theme with no flash; "Auto" follows the system.
- **Partner enquiries appear on the same board,** filterable by Type. They share consent, audit and erasure handling; separate partner stages can come with Phase 4's packs if needed.
- **Lead references use the last 8 hex digits of the id.** Demo ids share their first digits, so the first 8 made every demo reference identical.

### Nurture

- **Scheduling: a Netlify scheduled function calls `/api/cron/nurture` every 5 minutes** (Bearer `CRON_SECRET`); locally `pnpm worker --every 60`. `pg_cron` was rejected: rendering templates and calling Resend belong in TypeScript, and reaching them from `pg_cron` needs `pg_net` plus a public URL anyway. Netlify scheduled functions are on the Free plan.
- **Idempotent and safe under concurrency, three ways.** `claim_due_messages` locks rows with `FOR UPDATE SKIP LOCKED` (no two workers take a step), `messages.scheduled_message_id` is unique (a step is recorded once even if a worker dies after sending), and Resend gets the idempotency key `step-<id>` (a retried email is not delivered twice). Steps stuck in `processing` for 15 minutes are reclaimed.
- **Stop conditions are checked twice:** when they happen (reply, opt-out, withdrawal and stage changes stop enrolments in the same transaction) and again at send time (`stopReasonFor`), which also covers pausing a sequence.
- **Retries:** up to 3 attempts with 5- and 10-minute back-off, then the step is `failed` and a `message.failed` event is written. Error codes only, never provider messages.
- **SMS and WhatsApp are always `simulated`.** Real SMS in India needs DLT registration. The rendered text is stored so staff can see exactly what would have been sent.
- **Email without a verified domain is `logged`, not sent.** `RESEND_API_KEY` is commented out in `.env` until the user adds a domain; the worker then prints a redacted copy (no recipient, no body) and records `logged`.
- **Unsubscribe tokens are HMACs of the lead id (`UNSUBSCRIBE_SECRET`) with no expiry.** An unsubscribe link must keep working for as long as the email exists. The page asks for one click to confirm, because link scanners prefetch GET URLs; mail clients use the RFC 8058 one-click POST (`List-Unsubscribe-Post`).
- **The inbound webhook is a signed stub:** HMAC-SHA256 of `timestamp.body` with `INBOUND_WEBHOOK_SECRET` and a 5-minute window against replays. A real SMS or WhatsApp provider would sit behind a small adapter that maps its payload onto this.
- **Retention runs with the worker.** `purge_stale_leads(12)` erases leads with no activity for 12 months, which the privacy notice promises.
- **Least-privilege roles per process:** `web_submitter` (site), `crm_server` + `authenticated` (CRM), `nurture_worker` (worker). Each can execute only its own functions.

### Demo data

- **40 deterministic demo leads** (`generateClinicDemoLeads`, seeded PRNG): 8 new, 6 AI-triaged, 7 booked, 6 visited, 5 follow-up due, 4 package active, 4 lost, with some overdue SLAs and tasks. The seed replays each lead's history through `planStageEntry`, so enrolments, sent messages, stop reasons and sequence statistics are real rows rather than painted numbers.
- **Seeded times snap to clinic hours** (09:00–18:30 IST) so staff actions in the timeline look plausible.

### Tooling

- **Both apps load the root `.env` with `process.loadEnvFile`.** Next's `@next/env` caches its first load (the app folder), so the root file was silently ignored. Variables already in the environment still win.
- **The CRM e2e suite reseeds the local database and both suites delete the leads they created,** so the demo board stays clean after a test run.

## Phase 3 (2026-10-11)

### Routing

- **The routing engine is a pure function in `packages/core`** (`routeLead`), fed a roster that SQL builds (`routing_context` under RLS for staff, `system_routing_context` after a call). Same input, same answer; unit-tested without a database; explainable line by line.
- **Filters, then additive scores, then deterministic tie-breaks.** Filters: the specialty's team (else care coordinators), under capacity, and for urgent leads level rank 3 or above. Scores (clinic weights): continuity 35, language 30, seniority 25 × an urgency factor, spare load 25. Ties: lower load ratio, then whoever was assigned longest ago, then id. Weighted scores are easy to explain on a profile; a learned ranker is not.
- **Overrides need a reason code** (`OVERRIDE_REASONS`: patient request, continuity, workload, language, clinical judgement, other). The suggestion and the chosen person are both stored in the `lead.assigned` payload, so a manager can see how often routing is overruled and why. Codes, not free text, keep personal data out of the audit trail.
- **Billing copy-in, not hand-off.** Leads matching the pack's billing rule stay with their clinician; the billing desk sees them through its visibility rule.

### Voice providers (checked 2026-10-10 and 2026-10-11, official pages)

- **LiveKit Cloud Build plan for rooms and agent hosting:** 1,000 agent session minutes a month, 5 concurrent sessions, 1 agent deployment, no card. The user supplied LiveKit keys; the agent registered with LiveKit Cloud from this sandbox.
- **Speech through LiveKit Inference:** `deepgram/nova-3` with `language="multi"` (English and Hindi, code-switching) for STT, `rime/coda` for TTS. Inference includes US$2.50 of credit a month with a hard cap (about 430 STT minutes at US$0.0058/min); the TTS model was listed at US$0.00 per character when checked. One key, one bill, no extra sign-ups.
- **Gemini `gemini-3.5-flash-lite` on the AI Studio free tier for understanding.** The free tier was 15 requests a minute (observed in a 429 response on 2026-10-11); the daily limit is shown only in AI Studio. Free-tier inputs may be used to improve Google's products, so the agent refuses to start when `VOICE_REAL_DATA=true` and every surface says synthetic data only.
- **The text service runs on Render's free web service when deployed:** 750 instance hours a month, sleeps after 15 minutes idle, about a minute to wake, "not for production" in Render's own docs (render.com/docs/free, 2026-10-11). Netlify functions cannot hold a Python process; LiveKit's single free deployment is taken by the agent.

### Conversation design

- **The model never speaks.** Every line the assistant says is a fixed string from the pack's voice script. Gemini only maps a free answer to one of the question's option values (or "none"), with the caller's words passed as quoted data, and its output is checked against the options. A model that cannot speak cannot give medical advice, leak its prompt or be talked into anything.
- **A deterministic safety layer runs first on every turn**, before consent and before understanding: red flags (12 categories, English and Hindi, with negation handling and "when in doubt, fire"), medical-advice requests, prompt injection and "are you a person?". Safety must not depend on a model or on the network, and it is checked 100% by the eval.
- **No LLM attached to the LiveKit session.** The agent overrides `on_user_turn_completed` and answers with `session.say()`, so LiveKit's pipeline cannot generate a reply on its own.
- **One engine for every channel.** The LiveKit agent, the typed chat, the simulated dialer and the eval drive the same `IntakeSession`, so the evaluated behaviour is the shipped behaviour.
- **English and Hindi, switching on the caller's language** (Devanagari, or several common romanised words), with synonyms in both, Hinglish included. These are the pack's languages; more are a pack change.
- **Before the caller agrees, their words are not kept**: the transcript stores only the assistant's lines. Declining withdraws the call consent, so the dialer will not call again.
- **Idle sessions end as `caller_ended`.** A typed chat abandoned for 3 minutes is closed by the service's sweeper with what it has, the same as a hang-up, so the lead still reaches the CRM.

### Calls and cost

- **Every call starts in SQL (`start_call`)**, which checks the call consent, opt-out, erasure and the daily cap (50, from the pack) under a transaction-level advisory lock, and logs every refusal as `call.refused` with a reason code. Limits per call: 5 minutes and 40 turns.
- **The 9am–9pm India-time window applies to real phone calls only.** A simulated call rings nobody, so it runs every other check at any hour; this also keeps the e2e suite independent of the time of day.
- **Real phone calls need a LiveKit SIP trunk, which was not created.** A Twilio trial (verified numbers only) needs sign-up and phone verification, which this build did not do on the user's behalf. The code path exists (`placePhoneCall`), is gated on `LIVEKIT_SIP_TRUNK_ID`, and also refuses numbers not on the CRM's verified list. The simulated dialer runs the real engine with the lead's own form answers as the caller's lines.
- **The website creates the lead before the call starts** (source `voice`, with both consents), so a dropped call still leaves a lead staff can follow up, and the call result has a lead to attach to.
- **The call result is stored with its channel** (`record_voice_call` reads `channel` from the result), so the usage screen separates browser, phone and simulated calls.

### Website

- **`Permissions-Policy: microphone=(self)`.** Phase 1 set `microphone=()`, which silently blocks `getUserMedia` on our own page. Only this origin may ask; frames still get nothing.
- **Voice falls back to typed chat.** If LiveKit cannot connect (the connect call is capped at 12 seconds) or the microphone is refused, the widget switches to typing in the same session. In this sandbox the fallback took about 5 seconds.
- **The call cookie (`hw_call`) is an HMAC of the call and lead ids** (`VOICE_AGENT_SECRET`), httpOnly and SameSite=Strict, so a visitor can only send turns to their own call.
- **Assistant starts are rate-limited like the forms** (5 per 10 minutes per IP hash), on top of the daily cap.

### Contracts

- **zod is the source of truth; JSON Schema and pydantic are generated** (`pnpm contracts`, datamodel-code-generator 0.83). `contracts:check` in `pnpm check` fails on drift. zod's `pattern` on `uuid` and `datetime` strings is dropped from the JSON Schema because pydantic rejects `pattern` alongside those formats; the format still validates.
- **Python tooling lives in `apps/voice/.venv`, created by `scripts/voice.sh`** (uv when available). ruff and pytest run inside `pnpm check`, so the Python side shares the commit gate.
