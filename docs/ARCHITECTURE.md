# Architecture

## The lead flow (all four phases)

```
 visitor                                                                     staff
   │                                                                           ▲
   ▼                                                                           │
┌──────────────┐  server action  ┌───────────────────────┐   ┌────────────────┴──┐
│ apps/web     │───────────────▶ │ lib/server/submit.ts  │──▶│ Phase 2: CRM      │
│ intake forms │  (FormData)     │ honeypot → rate limit │   │ pipeline, profile,│
└──────────────┘                 │ → zod (core) → store  │   │ tasks, nurture    │
   │ Phase 3:                    │ → after(): notify     │   └───────────────────┘
   ▼ "Talk to our assistant"     └──────────┬────────────┘            ▲
┌──────────────┐                            │ submit_lead(payload)    │
│ apps/voice   │  signed POST               ▼                         │
│ LiveKit agent│──────────────▶  ┌───────────────────────┐   ┌────────┴──────────┐
└──────────────┘ /api/voice/     │ Supabase Postgres     │◀──│ Phase 3: routing  │
                 complete        │ RLS on every table    │   │ engine (core)     │
                                 │ leads · consent_records   └───────────────────┘
                                 │ lead_events · staff   │
                                 │ specialties · rate_limits
                                 └───────────────────────┘
```

Phase 1 implements the left column and the database: a visitor submits the patient or partner form, the server
validates it with the same zod schema the browser used, stores the lead, its consent evidence and its first audit events
in one transaction, and emails the team (or logs the email) after responding.

### A submission, step by step

1. **Browser**: `useEnquiryForm` validates with `buildIntakeSchema(pack)`. Errors go into a focusable summary. A valid
   form is posted to the server action (without JavaScript, the browser posts it natively).
2. **Honeypot**: if the hidden trap field (`hw_trap_x7`, a name autofill ignores) is filled, the server returns a
   fake success and stores nothing.
3. **Validation**: the same schema again, on the server. Failures return field errors plus the typed values, and do not
   count towards the rate limit.
4. **Rate limit**: `hit_rate_limit(key, 5, 600)`, a fixed window in Postgres, so it holds across serverless instances.
   The key is `form:` plus the first 40 hex characters of `sha256(salt:form:subject)`, where the subject is the client
   IPv4 address or IPv6 /64. The IP comes from `x-nf-client-connection-ip` on Netlify and `x-forwarded-for` elsewhere
   (`TRUSTED_IP_HEADER` overrides). With no IP the limit is skipped rather than shared, and if the check errors the
   request is allowed through.
5. **Store**: `intakeToLeadPayload` maps answers onto columns (offering to `specialty_slug`, free text to `message`) and
   attaches consent evidence (purpose, version, SHA-256 of the exact wording). `submit_lead(payload jsonb)` inserts the
   lead, the consent records and the `lead.created` / `consent.recorded` events atomically.
6. **Notify**: `after()` sends a Resend email with an idempotency key. Without a key, the email is printed to the
   console. A notification problem never affects the response. The email carries no name, full phone number or free
   text.

## Packages and responsibilities

| Package              | Owns                                                                                                                                                                                                                                                                                                | Must not                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/core`      | `brand.ts` (the only place the brand name lives); industry packs (`IndustryPack`: questions, consents, stages, staff levels, sequences, offerings); site copy and synthetic people for the clinic pack; zod schemas built from a pack; consent rendering and hashing; the `NewLeadPayload` contract | import server-only code or read env                     |
| `packages/ui`        | design tokens (`tokens.css`, Tailwind v4 `@theme`, light and dark), accessible components, nav and footer                                                                                                                                                                                           | know about routes or data fetching                      |
| `packages/db`        | migrations (Supabase CLI layout), local Supabase shim, SQL functions, lead stores (`supabase` over HTTPS, `postgres`, `memory`), seed builder, migration runner, type generator                                                                                                                     | be imported by client components                        |
| `apps/web`           | pages, forms, server actions, the submission pipeline, notification, logging                                                                                                                                                                                                                        | hardcode brand, stages or questions                     |
| `apps/crm`           | staff app: session, capability checks, RLS-scoped reads (`asStaff`), server actions calling staff SQL functions, board, profile, workspace, sequences, cron and inbound-webhook routes                                                                                                              | query leads outside `asStaff`; hardcode stages or roles |
| `packages/messaging` | email through Resend (console fallback), unsubscribe tokens, the nurture worker and its CLI                                                                                                                                                                                                         | log message bodies or recipients                        |
| `apps/voice`         | Python intake assistant: the deterministic `IntakeSession` engine, safety checks, the LiveKit agent, the signed text service (typed chat, simulated dialer), the eval harness; pydantic models generated from core's zod contracts                                                                  | speak model output; log transcripts or personal data    |

## Data model

| Table                     | Purpose                                                                                                    | Notes                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `leads`                   | Every enquiry (`lead_type` individual or partner), stage, urgency, specialty, assignee, qualifying answers | Personal data columns are nulled by `erase_lead`; check constraints forbid half-erased rows |
| `consent_records`         | Append-only consent ledger: purpose, granted, text version, text hash, source                              | Current state is the `current_consents` view (latest row per lead and purpose)              |
| `lead_events`             | Append-only audit trail (`lead.created`, `consent.recorded`, `consent.withdrawn`, `lead.erased`, …)        | Payloads never hold personal data. Phase 2 adds `stage.changed`, `lead.assigned`, …         |
| `staff`                   | People leads are routed to: level, role, specialties, languages, locations, capacity                       | `auth_user_id` links to `auth.users` (Supabase Auth)                                        |
| `specialties`             | Offering slugs mirrored from the pack                                                                      | Content stays in `packages/core`                                                            |
| `rate_limits`             | Fixed-window counters keyed by salted hashes                                                               | Pruned opportunistically after a day                                                        |
| `notes`, `tasks`          | Staff notes (optionally from a template) and tasks with due dates                                          | Phase 2; deleted by erasure                                                                 |
| `sequence_enrollments`    | One row per lead per sequence run: active, completed or stopped (with a reason)                            | At most one active run per lead and sequence (partial unique index)                         |
| `scheduled_messages`      | One row per step to send: due time, status, attempts, last error code                                      | The worker's queue; claimed with `FOR UPDATE SKIP LOCKED`                                   |
| `messages`                | Every message sent, simulated, logged or received, with channel and status                                 | Unique `scheduled_message_id`, so a step is recorded once; bodies nulled by erasure         |
| `lead_scores`             | The latest rule-based score per lead, with its factor breakdown                                            | Recomputed after each staff action                                                          |
| `sequence_settings`       | Per-sequence pause switch                                                                                  | Managers only                                                                               |
| `call_sessions`           | One row per assistant call: channel, status, outcome, language, flags, summary, transcript, usage          | Phase 3. Created by `start_call` (checks), completed by `record_voice_call` (idempotent)    |
| `verified_demo_numbers`   | Numbers a real (trial-trunk) phone call may ring                                                           | Phase 3. Managers only                                                                      |
| `call_policies`           | Call rules per industry and channel: consent purpose, caps, window, verified numbers                       | Phase 3. Written by the seed from the pack; read only by `start_call`                       |
| `assignment_explanations` | Why a lead was assigned, in words, beside the `lead.assigned` event                                        | Phase 3. Deleted by erasure; the event keeps codes, ids and scores                          |

Functions: `submit_lead` and `hit_rate_limit` (executable by `service_role` and the least-privilege `web_submitter`
role), and `withdraw_consent` and `erase_lead` (`service_role` only). `submit_lead` rejects a lead unless every consent
marked required is granted. Erasure reasons and withdrawal sources must be short codes, so no free text reaches the
audit trail. The audit tables cannot be updated, deleted from directly, or truncated.

Security model in Phase 1: RLS is enabled on every table with **no policies**, and all privileges are revoked from
`anon` and `authenticated`, so the browser cannot touch the database at all. The website writes through server code,
either as the service role (supabase-js over HTTPS) or, preferably, as a login role in `web_submitter`
(`WEB_DATABASE_URL`). That role can execute `submit_lead` and `hit_rate_limit` and nothing else. Tests assert all of this
generically, so a future table without RLS, or a new privilege for an API role, fails the build.

## Industry packs (how Phase 4 plugs in)

`getActivePack()` returns the pack in use (clinic today). Everything pack-specific reads from it:

- form questions and their order, option lists, hints, length limits (`intake.questions`, `channels: ['form', 'voice']`);
- which question picks the offering and which is the free text (`offeringQuestionId`, `messageQuestionId`);
- consents, their wording and versions, and whether withdrawal erases data;
- pipeline stages (Phase 2 board columns), staff levels (Phase 3 routing ranks), nurture sequences (Phase 2);
- the voice prompt for each question (Phase 3).

Phase 4 adds packs to `industryPacks` and lets `getActivePack()` switch at runtime. SQL stores pack ids as plain
text, so no migration is needed per industry.

## Runtime configuration

`LEAD_STORE=auto` picks Supabase (service-role key, HTTPS) if configured, else Postgres (`DATABASE_URL`), else the
in-memory store in development. In production with nothing configured, submissions fail with a friendly message rather
than going nowhere. The build fails if server secrets or database code appear in `.next/static`.

## Phase 2: the CRM and nurture engine

```
 staff browser ──▶ apps/crm (Next.js)                         Netlify scheduled function (5 min)
                   proxy.ts: no cookie → /login                          │ POST /api/cron/nurture (Bearer)
                   page: requireSession / requireCapability (403)        ▼
                   asStaff(session): BEGIN; SET LOCAL ROLE      packages/messaging runNurtureWorker
                     authenticated; set request.jwt.claims        claim_due_messages (SKIP LOCKED)
                   reads → RLS (staff_can_see_lead)               stop checks → Resend / simulated
                   actions → change_lead_stage, assign_lead,      finish_scheduled_message
                     add_note, … (security definer)
```

**Sessions and roles.** Sign-in checks the password against `auth.users` (`AUTH_PROVIDER=local`, bcrypt through
`verify_staff_password`) or Supabase Auth (`AUTH_PROVIDER=supabase`), then issues an 8-hour HS256 cookie holding the
auth user id, staff id, role and name. Every query runs inside `asStaff`, which makes Postgres see exactly what
Supabase's PostgREST would: role `authenticated` and `auth.uid()` = the staff member's auth user. The CRM's own
login role (`crm_server`) can do nothing else but become `authenticated` and call `hit_rate_limit` for login
throttling (10 attempts per 10 minutes per IP and email).

**Who sees what** (`LEAD_VISIBILITY` in core, `staff_can_see_lead` in SQL): managers and care coordinators see every
lead; specialist doctors see leads assigned to them; the billing desk sees leads assigned to them, leads flagged for
billing (the pack's `billingRule`, e.g. "has insurance") and leads in the won stage. Capabilities (`PERMISSIONS`)
decide which screens and actions each role gets; the sequences screen is manager-only.

**Stage changes.** The action reads the lead's active enrolments, asks `planStageEntry(pack.sequences, toStage,
active)` which sequences to start and which to stop, and calls `change_lead_stage(lead, stage, plan, reason)`. The
SQL function validates the caller, writes `stage.changed`, stops cancelled enrolments, creates new enrolments and
their `scheduled_messages` rows, and sets `first_response_at` on the first staff action, all in one transaction.
Undo is another stage change with reason `undo`, so the audit trail keeps both.

**Assignment.** `assignLead(lead, context)` in `packages/core` decides; Phase 2 supports `mode: 'manual'` and
returns an explanation (specialty and language match) that is stored with the `lead.assigned` event and shown on
the timeline. Phase 3 adds the routing engine as another mode, with no UI change.

**The worker.** `claim_due_messages(limit, stale_after)` marks due rows `processing` with `FOR UPDATE SKIP LOCKED`
and reclaims rows stuck in `processing` for 15 minutes, so two workers never take the same step and a crashed run
is retried. For each claimed step the worker re-checks stop conditions (`stopReasonFor`: opted out, replied, consent
withdrawn, erased, sequence paused, enrolment stopped), renders the pack template (emails get an unsubscribe line and
`List-Unsubscribe` headers; texts get "Reply STOP"), sends email through Resend with idempotency key `step-<id>` (or
logs it without a key), records SMS and WhatsApp as `simulated`, and calls `finish_scheduled_message`. That function
inserts at most one `messages` row per step (unique key), schedules a retry with back-off up to three attempts, and
completes the enrolment after its last step. Each worker run also prunes old rate-limit rows (inside
`claim_due_messages`) and erases leads untouched for 12 months (`purge_stale_leads`, the retention promise in the
privacy notice).

**Stopping.** Replies stop sequences through `mark_replied` (staff) or `record_inbound_message` (the signed webhook
`/api/messages/inbound`). Unsubscribing (`/unsubscribe?token=` with a confirm button, or the RFC 8058 one-click POST
to `/api/unsubscribe`) calls `opt_out_lead`, which stops every enrolment at once. Withdrawing the contact consent
erases the lead (`erase_lead` v3 also deletes notes and tasks and nulls message bodies).

**Scoring and SLAs.** `scoreLead(pack.crm.scoring, input, now)` returns a 0–100 score, a band and the factors behind
it; the CRM stores it in `lead_scores` after each action. `slaStatus` compares the time to first response with the
pack's target for the lead's urgency (urgent 1 h, high 4 h, normal 24 h, low 48 h) and drives the card badges and
overdue warnings.

## Phase 3: routing and the AI assistant

```
 website widget ── /api/assistant/start ──▶ start_web_call (consent, opt-out, daily cap; advisory lock)
   │ voice: LiveKit token + agent dispatch            │ typed: text service /sessions
   ▼                                                  ▼
 LiveKit room ◀──▶ apps/voice agent.py ──┐     apps/voice server.py ◀── CRM "Simulated assistant call"
                                         │ IntakeSession (dialogue.py): safety → limits → nlu → (Gemini) → reply
                                         ▼
                      POST /api/voice/complete (HMAC sha256 of "ts.body", 5-minute window, 256 KB, zod)
                                         ▼
 apps/crm applyVoiceResult: record_voice_call → apply_voice_outcome (stage, urgent task) →
                            routeForSystem (routing engine) → save_call_lead_score
```

**Routing** (`packages/core/src/routing/engine.ts`) is a pure function of the lead, the roster and the pack's
`routing` config, so it is unit-tested without a database and gives the same answer every time. It filters the
specialty's team (or falls back to care coordinators), drops people at capacity and, for urgent leads, anyone below
the pack's minimum level rank. It scores each candidate on language match, seniority weighted by urgency, spare
capacity and continuity (has this person worked with the lead before), and breaks ties by load ratio, then by who was
assigned longest ago, then by id. The decision carries a plain-language explanation for every candidate, which is
stored in the `lead.assigned` event and shown on the profile. Staff can accept a suggestion or override it with a
reason code (`OVERRIDE_REASONS`). `routing_context` (RLS, staff) and `system_routing_context` (after a call) build the
roster in SQL; `assign_lead` checks the target and writes the explanation.

**The assistant.** One deterministic engine serves every channel; the pack's voice script
(`clinic-voice.ts`, exported to `packages/core/contracts/voice-script.clinic.json`) holds every line it can say.
Gemini only maps a free answer onto one of the allowed option values, and its output is validated against them.
Safety checks run before anything else on every turn. See `docs/VOICE.md` for the full flow, providers and limits,
and `docs/VOICE_EVAL.md` for the evaluation.

**Contracts.** `packages/core/scripts/contracts.ts` writes JSON Schema for `VoiceCallResult` and
the voice script, then generates `apps/voice/healwyn_voice/contracts.py` with datamodel-code-generator.
`pnpm contracts:check` (in `pnpm check`) fails when the generated files are stale.

**Calls in SQL.** `start_call` is the single gate for every call, with rules from `call_policies` (never from the
caller): the call consent must be current, the lead not opted out or erased, today's count under the group's cap and
the phone number's cap (a transaction-level advisory lock makes them exact), and for real phone calls the time window
and the verified number list. Every refusal is written as `call.refused` with a reason code. A browser call can switch
to typed chat once (`use_text_fallback`). `record_voice_call` is idempotent per call id and ignores the voice agent's
result for a call that continued as typed chat; `apply_voice_outcome` moves a new lead to AI-triaged with that stage's
nurture plan and creates an urgent task after a red flag. Erasure scrubs call summaries, transcripts and flags.
