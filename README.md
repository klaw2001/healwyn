# Healwyn Clinics: demo platform

> **Demo brand, all content fictional.** Healwyn Clinics is a fictional multi-specialty clinic brand in India. Every
> clinic, doctor, package, partner and enquiry is synthetic, and nothing here is medical advice.

A portfolio showcase of a lead-to-doctor platform: _"The right doctor, from the first call."_ A visitor describes what
they need, an AI assistant qualifies them, a routing engine matches them with the right doctor's team, and staff follow
up from a CRM with nurture sequences.

It is built in four phases. **Phase 1 (this release)** is the foundation:

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

Next phases: the CRM (2), routing and the AI voice assistant (3), then the dashboard, booking, payments, industry
switcher and pitch kit (4). See `CLAUDE.md` for the plan and `NEXT.md` for where things stand.

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
export DATABASE_URL="$(pnpm -s db:local url)"
pnpm db:migrate && pnpm db:seed                       # schema + synthetic staff and demo leads
pnpm dev                                              # submissions now land in Postgres
psql "$DATABASE_URL" -c 'select stage, full_name, specialty_slug from leads order by created_at desc limit 5'
```

### With your Supabase project

1. Apply the schema, choosing one of these:
   - `pnpm db:migrate`, with `DATABASE_URL` set to your project's connection string (Dashboard > Connect). The direct
     host is IPv6-only on the free plan; on an IPv4-only network use the **Session pooler** string instead.
   - Without a direct connection, set `SUPABASE_ACCESS_TOKEN` (a personal access token) and `SUPABASE_URL`, leave
     `DATABASE_URL` empty, and run `pnpm db:migrate`. This runs over HTTPS through the Management API.
   - Or paste the files from `packages/db/supabase/migrations/` into the SQL editor, in order. Never run
     `local-shim.sql` against Supabase.
2. Run `pnpm db:seed` for synthetic specialties, staff and demo leads.
3. For the website, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Dashboard > Project Settings > API Keys).
   The service-role key is server-only, and the build fails if it ends up in browser code.

### Quality checks

```bash
pnpm check                    # lint + typecheck + unit/integration tests + build (the commit gate)
pnpm build && pnpm test:e2e   # Playwright: every page, both forms, keyboard-only, no-JS, honeypot, rate limit
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
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, recommended because they work over HTTPS. Alternatively set
     `DATABASE_URL` to the Supabase **transaction pooler** (port 6543); Netlify functions cannot reach the IPv6-only
     direct host.
   - `RATE_LIMIT_SALT`: a random string.
   - `RESEND_API_KEY` and `LEAD_NOTIFY_EMAIL`. Without a verified domain, Resend only delivers to the address you
     signed up with.
   - `SITE_URL`: your Netlify URL.
3. Deploy. Use deploy previews to iterate: they are free, while each production deploy costs 15 of the plan's 300
   monthly credits.

## Repository layout

```
apps/web        Next.js site and forms         packages/core   brand, industry packs, schemas
apps/crm        Phase 2 (placeholder)          packages/ui     tokens and components
apps/voice      Phase 3 (placeholder)          packages/db     migrations, stores, seed, types
docs/           architecture and phase docs    scripts/        local-db.sh, lighthouse.mjs
```

More detail: `docs/ARCHITECTURE.md` (lead flow, data model, security), `DECISIONS.md` (every judgement call),
`CLAUDE.md` (commands, conventions and rules for contributors, human or AI).
