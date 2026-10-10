# NEXT.md

Status at the end of **Phase 1** (2026-10-10). The next session starts here.

## Done

- **Monorepo**: pnpm workspaces with `apps/web`, `packages/core`, `packages/ui` and `packages/db`; `apps/crm` and
  `apps/voice` are placeholder READMEs. TypeScript strict, ESLint (with jsx-a11y), Prettier, Vitest and Playwright.
- **Brand**: one source of truth in `packages/core/src/brand.ts`. A test fails if the brand name is hardcoded
  anywhere else.
- **Design system** (`packages/ui`):
  - Tokens for colour (light and dark), type scale, spacing, radius and shadow, as a Tailwind v4 theme.
  - Components: button, input, select, textarea, checkbox, radio group, field, card, section, badge, notice, nav,
    footer, skip link and brand mark.
- **Website** (`apps/web`), all statically prerendered:
  - Home: hero, how it works, specialties, partner strip, trust, call to action.
  - Specialties: an overview plus six detail pages.
  - Doctors: 8 fictional clinicians with illustrated portraits.
  - Health packages: 4 illustrative packages, no prices.
  - Locations: 2 fictional clinics.
  - For partners (with its form), Contact and book (with its form), privacy notice (DPDP), terms, demo disclaimer, 404.
  - An emergency notice in every footer and above both forms; the demo notice on every page; `noindex` by default.
- **Forms**:
  - The patient form is generated from the clinic industry pack.
  - The partner form has the organisation, contact, role, phone, email, type, message and consent fields.
  - The same zod schemas validate in the browser and on the server, and the forms work without JavaScript.
  - Spam protection: a honeypot plus database-backed rate limiting (5 per 10 minutes per form per hashed IP).
  - Two separate, versioned and hashed consents on the patient form.
  - Resend notification after the response, with a console fallback. It never fails a submission and carries no name,
    full phone number or free text.
- **Data** (`packages/db`):
  - Three migrations: tables `leads`, `lead_events` (append-only), `consent_records` (append-only), `staff`,
    `specialties` and `rate_limits`; the `current_consents` view; the functions `submit_lead`, `withdraw_consent`,
    `erase_lead` and `hit_rate_limit`.
  - Row level security is on everywhere and grants are revoked from `anon` and `authenticated`.
  - An idempotent seed: 6 specialties, 11 staff, 8 demo leads across all 7 stages.
  - Generated types in `src/database.types.ts`.
  - Lead stores (`supabase`, `postgres`, `memory`), selected automatically from the environment.
- **Industry pack** (`packages/core/src/industries/clinic.ts`): qualifying questions (with voice prompts for Phase 3),
  consents, 7 stages, 4 staff levels and 6 nurture sequences, all typed by `IndustryPack`.
- **Docs**: `CLAUDE.md`, `README.md`, `DECISIONS.md`, `docs/ARCHITECTURE.md` and `docs/PROMPTS.md` (the prompt book).
- **Local secrets**: `.env` at the repo root (gitignored) holds the supplied keys, with the database password
  URL-encoded, and a generated `RATE_LIMIT_SALT`.

## Verified, and how

- **`pnpm check`** (lint, typecheck, test, build) passes. The build includes a check that no server secret names or
  values, and no database code, reach `.next/static`. That check was run with the real `.env` values loaded.
- **Vitest: 172 tests.**
  - core (52): phone normalisation, schemas, pack integrity, consent hashing, brand usage.
  - ui (59): WCAG AA contrast for 28 colour pairings in both themes.
  - db (43): run against a real throwaway Postgres 16 cluster with Supabase's roles emulated. They cover RLS on every
    table, `anon` and `authenticated` holding no privileges and unable to execute any function, atomic
    `submit_lead`, rollback on failure, append-only triggers, consent withdrawal and erasure, cascade deletion,
    concurrent rate limiting, seed idempotency, the supabase-js RPC contract (with a mocked fetch) and the Management
    API transport (also mocked).
  - web (18): the submission pipeline (honeypot, rate limit, validation, a store failure that leaks nothing, no
    personal data in logs) and the notifier (no personal data in the email, console fallback, idempotency key, never
    throws).
- **Playwright: 62 checks** (31 tests at 375 px and 1280 px), run against a production build and the local Postgres.
  - Every page returns 200, has one `h1`, carries the emergency and demo notices, has no horizontal scroll, and has no
    unlabelled images or SVGs.
  - Both forms reject bad input, in the browser and on the server with JavaScript off.
  - A valid patient enquiry creates a lead with its consent records (hashed) and events; a valid partner enquiry
    creates a partner lead.
  - The patient form can be completed with the keyboard alone.
  - The honeypot stores nothing, the rate limit triggers on the 6th attempt, and a specialty is pre-selected from a
    link.
- **Lighthouse** (mobile emulation, simulated throttling, local `next start`):

  | Page             | Performance | Accessibility | Best practices |
  | ---------------- | ----------- | ------------- | -------------- |
  | Home             | 99          | 100           | 100            |
  | Contact          | 96          | 100           | 100            |
  | Every other page | 96 to 99    | 100           | 100            |

  CLS is 0 everywhere. SEO scores 63 only because pages are deliberately `noindex`; no other SEO audit fails.

- **Visual review** from screenshots at 375 px and 1280 px, in light and dark themes. Fixes made along the way: the
  tagline comma wrapping onto its own line, a wrapping button, notice corners, avatar scale, the dark-mode coat colour,
  and a phone placeholder that looked like a filled-in value.
- **Migrations and seed** run twice against a fresh database: the second runs are no-ops.
- **The Resend API key is valid**, checked with one read-only call (`GET /domains`). It has full access and no
  verified domain.

- **An independent review** found no secret leaks, injection risks or high-severity defects. Its medium and low
  findings are fixed in `20261010000004_phase1_hardening.sql` and the code; see "End-of-phase review" in
  `DECISIONS.md`. Highlights:
  - the website runs as a least-privilege role (`web_submitter`), and e2e exercises that path;
  - the database rejects leads whose required consent is missing;
  - the audit tables cannot be truncated;
  - validation mistakes don't count towards the rate limit;
  - line breaks no longer break the length limit.

## Not verified

- **The live Supabase project has not been migrated.** This cloud sandbox has no raw TCP or DNS access to
  `db.<ref>.supabase.co`, and no service-role key or access token was supplied. At the user's request, development
  uses a local Postgres for now (`.env` points at `pnpm db:local`; the Supabase string is kept commented out there).
  The site and tests ran against a local Postgres 16 with Supabase's roles emulated.
- **The Supabase HTTPS store against real PostgREST**: only its request contract is tested, with a mocked fetch.
- **Migrations over the Supabase Management API**: only tested with a mocked fetch.
- **Real email delivery**: the user will add a sending domain later, so the email code is tested only with a mocked
  fetch. `LEAD_NOTIFY_EMAIL` is empty, and the Resend key is valid.
- **A Netlify deploy**: no account access. `apps/web/netlify.toml` follows Netlify's monorepo docs but is untested.
- **Real devices, Safari or Firefox, and screen readers**: only Chromium emulation plus automated accessibility checks
  were used.

## Known gaps and caveats

- **Retention.** The privacy notice promises deletion 12 months after last contact, but no scheduled job does this
  yet. Add a `pg_cron` purge (`erase_lead` for stale leads) in Phase 2, alongside the scheduler.
- **Self-service withdrawal.** Withdrawal is by email to a placeholder `.example` address. Phase 2's unsubscribe link
  and staff "withdraw consent" action should call `withdraw_consent`.
- **Partner leads share the clinic pipeline.** They live in `leads` with `lead_type = 'partner'`, so the Phase 2 board
  should filter by `lead_type` or give partners their own stages.
- **Rate-limit IP source.** Netlify's `x-nf-client-connection-ip` is trusted first. On other hosts `x-forwarded-for`
  can be spoofed, so the limit is best-effort there.
- **No Content-Security-Policy header.** A strict CSP needs per-request nonces, which would make every page dynamic.
  The other security headers are set. Revisit when the CRM (already dynamic) arrives.
- **Footer wording.** The emergency notice text is the exact wording from the brief ("This form is not for urgent
  care"), so it also mentions "this form" on pages without one.
- **Pack values are not enforced in SQL.** `leads.stage` and `staff.level` are checked in SQL only for their format;
  the pack defines the valid values. Phase 2 should validate stage changes against `getActivePack().stages` in
  `packages/core`.
- **Rotate the supplied keys.** They were pasted into a chat: the database password, Resend, Gemini and LiveKit. The
  Gemini key starts with `AQ.` rather than the usual `AIza`, so check it in Phase 3.

## Exact first steps for Phase 2

1. Read `CLAUDE.md`, this file, `DECISIONS.md` and `docs/ARCHITECTURE.md`. Then run
   `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Postgres binaries make `pnpm test` cover
   the SQL.
2. **Get the live database migrated** with one of these:
   - From a machine with IPv6, or with the Session pooler URL in `DATABASE_URL`: `pnpm db:migrate && pnpm db:seed`.
   - From a cloud session: add `SUPABASE_ACCESS_TOKEN` to `.env`, blank `DATABASE_URL` for that one command, and run
     `pnpm db:migrate`.
   - Or paste the three migration files into the Supabase SQL editor, in order.
3. Add `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env` (Dashboard > Project Settings >
   API Keys). The website then switches automatically to the HTTPS store.
4. Scaffold `apps/crm` as a Next.js 16 app reusing `@healwyn/ui` (tokens.css plus `@source`) and `@healwyn/core`.
   Toggle dark mode with `data-theme` on `<html>`.
5. Add migration `20261011000001_staff_auth_and_rls.sql`:
   - a `role` column on `staff` (manager, care_coordinator, specialist_doctor, billing_desk), linked through
     `auth_user_id`;
   - `security definer` helpers such as `public.current_staff_id()` and `public.current_staff_role()`, with
     `search_path = ''`;
   - RLS **policies** on `leads`, `lead_events`, `consent_records` and `staff` for `authenticated`, plus explicit
     grants, because Phase 1 revoked everything. Extend `packages/db/test/security.test.ts`: it currently asserts that
     `authenticated` has _no_ grants, so update that assertion deliberately.
6. Put the permissions matrix in `packages/core` and test it. Prove in SQL tests (with `set local role authenticated`
   and `set local request.jwt.claims = '{"sub": "…"}'`, which `auth.uid()` reads, as on Supabase) that a doctor cannot read another doctor's
   leads.
7. Seed one demo user per role through the Auth admin API (service role), behind `DEMO_LOGIN=true`.
8. Build the remaining Phase 2 scope from `docs/PROMPTS.md`. Stage changes write `lead_events` (`stage.changed` with
   `from`/`to`), assignment goes through `assignLead()` in `packages/core`, and the 40-lead seed extends `buildSeedSql`
   (keep `is_demo = true`).
9. Keep `main` and the session branch identical. Tag `phase-2-complete` at the end.
