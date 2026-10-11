# Healwyn Clinics: demo platform

> **Demo brand, all content fictional.** Healwyn Clinics is a fictional multi-specialty clinic brand in India. Every
> clinic, doctor, package, partner and enquiry is synthetic, and nothing here is medical advice.

A portfolio showcase of a lead-to-doctor platform: _"The right doctor, from the first call."_ A visitor describes what
they need, an AI assistant qualifies them, a routing engine matches them with the right doctor's team, and staff follow
up from a CRM with nurture sequences.

It is built in four phases. **Phase 1** is the foundation:

- **Brand kit and design system** (`packages/ui`): warm paper, teal ink and a marigold accent, with Fraunces and
  Atkinson Hyperlegible type. Light and dark themes, with WCAG AA contrast checked by tests.
- **Marketing website** (`apps/web`): home, six specialty pages, doctors, health packages, locations, partners, contact,
  privacy, terms and a demo disclaimer. Mobile-first and accessible, scoring Lighthouse 96 to 99 for performance and
  100 for accessibility and best practices on mobile.
- **Intake forms**: patient and partner enquiries, validated in the browser and on the server with the same zod schema.
  They have two separate, versioned consents, a honeypot, database-backed rate limiting and Resend notifications.
- **Data model** (`packages/db`): Supabase Postgres with row level security on every table, append-only audit and
  consent ledgers, and erasure on consent withdrawal (India's DPDP Act).
- **Industry pack** (`packages/core`): the form, stages, staff levels and sequences all come from one typed config, so
  Phase 4 can re-skin the system for other industries.

**Phase 2** adds the CRM (`apps/crm`) and nurture automation (`packages/messaging`):

- **Four roles** (manager, care coordinator, specialist doctor, billing desk) with a permissions matrix in
  `packages/core`, enforced in the UI, in every server action and in Postgres row level security. Tests prove that a
  doctor cannot read another doctor's leads and a coordinator cannot open manager-only screens.
- **Pipeline board** with columns from the industry pack: drag with a mouse, finger or keyboard, or use each card's Move
  menu. Every move is audited and can be undone. Filters and a sortable list view sit beside it.
- **Lead profiles**: contact, consent history, assignment (with the reason recorded), a timeline from the audit trail,
  notes from templates, tasks with reminders, every message with its channel and status, a rule-based score with its
  breakdown, and an AI summary panel (filled by the Phase 3 assistant).
- **Workspace**: my leads, today's tasks, the unassigned queue and the next seven days, with first-response SLA timers.
- **Nurture sequences** from the pack, started and stopped by stage changes, replies, unsubscribes and consent
  withdrawal. Email goes through Resend (logged until a domain is verified); SMS and WhatsApp are simulated. The worker
  is idempotent and safe to run in parallel. Managers can preview and pause sequences and see enrolments.

**Phase 3** adds routing and the AI intake assistant (`apps/voice`):

- **Routing engine** (`packages/core/src/routing`): a pure, deterministic function that picks the right person from
  the specialty's team by language, seniority for urgent leads, spare capacity and continuity of care, with a score
  breakdown for every candidate on the lead profile. Staff can accept the suggestion or override it with a reason.
- **AI assistant**: "Talk to our assistant" on Home and Contact, by voice through LiveKit or by typing. It says it is
  an AI, asks for consent, asks the pack's qualifying questions in English or Hindi, confirms what it heard and never
  gives medical advice. Red-flag symptoms stop the intake and send the caller to emergency services. Every line it
  speaks is fixed in the pack; Gemini only classifies answers.
- **Signed results** reach the CRM (`/api/voice/complete`): the call is stored, the lead moves to AI-triaged, gets
  routed and shows a short summary. Staff can run a simulated assistant call from a profile; real phone calls are
  wired for LiveKit SIP but need a trunk.
- **Guards and evidence**: per-call and daily limits checked in SQL, a manager usage screen, and an evaluation of 43
  scripted conversations (`docs/VOICE_EVAL.md`) in which every safety scenario passes.

Next: the dashboard, booking, payments, industry switcher and pitch kit (Phase 4). See `CLAUDE.md` for the plan,
`NEXT.md` for where things stand and `docs/VOICE.md` for the assistant.

## Run it locally

Requirements: Node 22+, pnpm 10 (`corepack enable`). Optional: Postgres 15+ server binaries for the local database.

```bash
pnpm install
cp .env.example .env          # fill in what you have; everything is optional for a first look
pnpm dev                      # http://localhost:3000
```

With no database configured, `pnpm dev` stores enquiries in memory and prints notification emails to the terminal.

### With a local database (no Docker)

```bash
pnpm db:local start                                   # throwaway Postgres on :54329 with Supabase's roles
export DATABASE_URL="$(pnpm -s db:local url)"            # owner: migrations and seed
pnpm db:migrate && pnpm db:seed                       # schema + synthetic staff and demo leads
export WEB_DATABASE_URL="$(pnpm -s db:local web-url)"   # the site's least-privilege role
pnpm dev                                              # submissions now land in Postgres
psql "$DATABASE_URL" -c 'select stage, full_name, specialty_slug from leads order by created_at desc limit 5'
```

### The CRM

With the local database running and seeded (above), add `SESSION_SECRET`, `UNSUBSCRIBE_SECRET` and `CRON_SECRET` to
`.env` (any random 32+ characters), plus `DEMO_LOGIN=true` for one-click demo logins, then:

```bash
export CRM_DATABASE_URL="$(pnpm -s db:local crm-url)"   # the CRM's least-privilege login
pnpm dev:crm                                          # http://localhost:3001
pnpm worker --every 60                                # sends due sequence steps once a minute
```

### The AI assistant

Needs Python 3.12+ (and `uv` if you have it). Add `VOICE_WEBHOOK_SECRET` and `VOICE_AGENT_SECRET` (32+ characters)
to `.env`, then:

```bash
pnpm voice:setup              # apps/voice/.venv with the LiveKit agent and dev tools
pnpm voice:serve              # text service: typed chat on the website, simulated calls from the CRM
pnpm voice:agent dev          # optional: the voice agent (needs LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
pnpm eval:voice               # 43 scripted conversations -> docs/VOICE_EVAL.md
```

Without `GEMINI_API_KEY` (or with `VOICE_USE_LLM=false`) the assistant runs fully deterministically.

Demo staff sign in with `DEMO_USER_PASSWORD` (default `demo-pass-2026`): `anita.kapoor@healwyn.example` (manager),
`neha.joshi@healwyn.example` (care coordinator), `asha.raman@healwyn.example` (specialist doctor) and
`deepa.menon@healwyn.example` (billing desk). Submit an enquiry on the website and it appears on the board.

### With your Supabase project

1. Apply the schema, choosing one of these:
   - `pnpm db:migrate`, with `DATABASE_URL` set to your project's connection string (Dashboard > Connect). The direct
     host is IPv6-only on the free plan; on an IPv4-only network use the **Session pooler** string instead.
   - Without a direct connection, set `SUPABASE_ACCESS_TOKEN` (a personal access token) and `SUPABASE_URL`, leave
     `DATABASE_URL` empty, and run `pnpm db:migrate`. This runs over HTTPS through the Management API.
   - Or paste the files from `packages/db/supabase/migrations/` into the SQL editor, in order. Never run
     `local-shim.sql` against Supabase.
2. Run `pnpm db:seed` for synthetic specialties, staff and demo leads.
3. For the website, use one of these:
   - **Least privilege (recommended):** in the SQL editor run
     `create role healwyn_web login password '…'; grant web_submitter to healwyn_web;`, then set `WEB_DATABASE_URL` to
     the transaction pooler (port 6543) with user `healwyn_web.<project-ref>`. This role can only submit leads.
   - **HTTPS:** set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Dashboard > Project Settings > API Keys). The
     service-role key is server-only, and the build fails if it ends up in browser code.

### Quality checks

```bash
pnpm check                    # lint (TS + Python) + typecheck + contracts + tests (Vitest + pytest) + build
pnpm build && pnpm test:e2e   # Playwright: the site (every page, both forms, no-JS, rate limit), then the CRM flows
pnpm start & pnpm lighthouse  # Lighthouse (mobile) on Home and Contact; reports in .lighthouse/
```

`pnpm test` runs its database tests against a temporary Postgres cluster if Postgres binaries are installed (or
`TEST_DATABASE_URL`); otherwise those tests are skipped. `pnpm test:e2e` uses the local database when
`pnpm db:local start` is running, and asserts that leads, consent records and events are stored.

## Deploy for free (Netlify)

Netlify's Free plan allows commercial use and runs Next.js server actions as functions. The terms were checked on
2026-10-10; see `DECISIONS.md`.

1. Create a site from this repository. In **Build settings** leave the base directory empty and set **Package
   directory** to `/apps/web`. `apps/web/netlify.toml` supplies the build command and publish directory.
2. Set these environment variables:
   - `WEB_DATABASE_URL`: the least-privilege `healwyn_web` role through the Supabase **transaction pooler** (port
     6543); Netlify functions cannot reach the IPv6-only direct host. Alternatively, `SUPABASE_URL` and
     `SUPABASE_SERVICE_ROLE_KEY` work over HTTPS but with full database rights.
   - `RATE_LIMIT_SALT`: a random string.
   - `RESEND_API_KEY` and `LEAD_NOTIFY_EMAIL`. Without a verified domain, Resend only delivers to the address you
     signed up with.
   - `SITE_URL`: your Netlify URL.
3. Deploy. Use deploy previews to iterate: they are free, while each production deploy costs 15 of the plan's 300
   monthly credits.

The CRM is a second site from the same repository, with **Package directory** `/apps/crm` (`apps/crm/netlify.toml`).
Give it `CRM_DATABASE_URL` (a login role granted `crm_server` and `authenticated`, through the transaction pooler),
`SESSION_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, `INBOUND_WEBHOOK_SECRET`, `SITE_URL` (the
website's URL, for unsubscribe links), `RESEND_API_KEY` and `EMAIL_FROM`. Its scheduled function runs the nurture
worker every five minutes. Leave `DEMO_LOGIN` unset unless the deployment is a demo. The website also needs
`UNSUBSCRIBE_SECRET` (the same value) for its unsubscribe page.

The assistant's agent runs on LiveKit Cloud and its text service on a small Python host; see `docs/VOICE.md` for the
free-tier deployment and the variables each site needs.

## Repository layout

```
apps/web        Next.js site and forms         packages/core       brand, industry packs, permissions, CRM rules
apps/crm        Next.js staff CRM              packages/ui         tokens and components
apps/voice      Python intake assistant        packages/db         migrations, stores, seed, types
docs/           architecture and phase docs    packages/messaging  email, unsubscribe, nurture worker
                                               scripts/            local-db.sh, lighthouse.mjs
```

More detail: `docs/ARCHITECTURE.md` (lead flow, data model, security), `DECISIONS.md` (every judgement call),
`CLAUDE.md` (commands, conventions and rules for contributors, human or AI).
