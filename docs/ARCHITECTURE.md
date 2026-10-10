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

| Package         | Owns                                                                                                                                                                                                                                                                                                | Must not                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `packages/core` | `brand.ts` (the only place the brand name lives); industry packs (`IndustryPack`: questions, consents, stages, staff levels, sequences, offerings); site copy and synthetic people for the clinic pack; zod schemas built from a pack; consent rendering and hashing; the `NewLeadPayload` contract | import server-only code or read env |
| `packages/ui`   | design tokens (`tokens.css`, Tailwind v4 `@theme`, light and dark), accessible components, nav and footer                                                                                                                                                                                           | know about routes or data fetching  |
| `packages/db`   | migrations (Supabase CLI layout), local Supabase shim, SQL functions, lead stores (`supabase` over HTTPS, `postgres`, `memory`), seed builder, migration runner, type generator                                                                                                                     | be imported by client components    |
| `apps/web`      | pages, forms, server actions, the submission pipeline, notification, logging                                                                                                                                                                                                                        | hardcode brand, stages or questions |
| `apps/crm`      | Phase 2                                                                                                                                                                                                                                                                                             |                                     |
| `apps/voice`    | Phase 3 (Python)                                                                                                                                                                                                                                                                                    |                                     |

## Data model

| Table             | Purpose                                                                                                    | Notes                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `leads`           | Every enquiry (`lead_type` individual or partner), stage, urgency, specialty, assignee, qualifying answers | Personal data columns are nulled by `erase_lead`; check constraints forbid half-erased rows |
| `consent_records` | Append-only consent ledger: purpose, granted, text version, text hash, source                              | Current state is the `current_consents` view (latest row per lead and purpose)              |
| `lead_events`     | Append-only audit trail (`lead.created`, `consent.recorded`, `consent.withdrawn`, `lead.erased`, …)        | Payloads never hold personal data. Phase 2 adds `stage.changed`, `lead.assigned`, …         |
| `staff`           | People leads are routed to: level, specialties, languages, locations, capacity                             | `auth_user_id` links to Supabase Auth in Phase 2                                            |
| `specialties`     | Offering slugs mirrored from the pack                                                                      | Content stays in `packages/core`                                                            |
| `rate_limits`     | Fixed-window counters keyed by salted hashes                                                               | Pruned opportunistically after a day                                                        |

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
