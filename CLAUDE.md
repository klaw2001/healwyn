# CLAUDE.md

Read this first in every session, then `NEXT.md`, `DECISIONS.md` and `docs/ARCHITECTURE.md`. Their rules bind you.

## What this is

**Healwyn Clinics** is a fictional multi-specialty clinic brand in India, built as a portfolio demo of a lead-to-doctor
platform. Synthetic data only: no real patients, no real doctors, no medical advice, ever.

The platform is built in four phases:

1. **Foundation** (done): brand kit, marketing website, intake forms, data model.
2. **CRM**: staff and manager app, pipeline board, lead profiles, staff workspace, nurture sequences (email real,
   SMS/WhatsApp simulated).
3. **Routing and AI voice**: deterministic routing engine with explanations; a LiveKit + Gemini voice assistant that
   qualifies leads (browser first, then phone) and never gives medical advice.
4. **Pitch kit**: manager dashboard, booking, Razorpay test-mode payments, an industry switcher (real estate, wealth
   advisory, home interiors) and a demo kit.

Every lead flows: intake form, AI voice assistant qualifies, routing engine picks the right doctor's team, staff member
receives the lead with an AI summary, nurture sequences follow up, close (booked, paid or lost).

## Commands

All from the repo root. Node 22+, pnpm 10.

| Command                                 | What it does                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                          | Install everything                                                                                              |
| `pnpm dev`                              | Website on http://localhost:3000                                                                                |
| `pnpm lint`                             | ESLint (incl. jsx-a11y) + Prettier check                                                                        |
| `pnpm format`                           | Prettier write                                                                                                  |
| `pnpm typecheck`                        | `tsc` in every package (`next typegen` first for the web app)                                                   |
| `pnpm test`                             | Vitest: core, ui (WCAG contrast), db (integration, real Postgres), web (submission pipeline)                    |
| `pnpm build`                            | Production build of the website + client-bundle secrets check                                                   |
| `pnpm check`                            | lint + typecheck + test + build: **the commit gate**                                                            |
| `pnpm test:e2e`                         | Playwright smoke tests against a production build (run `pnpm build` first)                                      |
| `pnpm lighthouse`                       | Lighthouse (mobile) on Home and Contact against a running `pnpm start`                                          |
| `pnpm db:local start\|stop\|reset\|url` | Throwaway local Postgres with Supabase roles (no Docker)                                                        |
| `pnpm db:migrate`                       | Apply `packages/db/supabase/migrations` to `DATABASE_URL` (or via Supabase Management API with an access token) |
| `pnpm db:seed`                          | Synthetic specialties, staff and demo leads (idempotent; never touches real leads)                              |
| `pnpm db:types`                         | Regenerate `packages/db/src/database.types.ts` from a migrated database                                         |

Local database loop: `pnpm db:local start`, then `DATABASE_URL="$(pnpm -s db:local url)" pnpm db:migrate`, same for
`db:seed`, `db:types` and `pnpm dev`. `pnpm test` starts its own temporary cluster when Postgres binaries exist
(`TEST_DATABASE_URL` overrides); `pnpm test:e2e` uses the local cluster when it is running.

## Repo structure

```
apps/
  web/        Next.js 16 App Router: public site + intake forms (server actions)
    app/        routes; contact/ and partners/ hold the server actions
    components/ site chrome, forms (client), illustrations (SVG)
    lib/server/ server-only: submission pipeline, lead store singleton, Resend notifier, logger
    e2e/        Playwright;  test/  Vitest
  crm/        Phase 2 (README only)
  voice/      Phase 3, Python LiveKit agent (README only)
packages/
  core/       brand.ts, industry packs (clinic.ts + content + demo data), zod schemas, consent, lead payloads
  ui/         tokens.css (Tailwind v4 theme, light/dark), accessible components, nav/footer
  db/         supabase/migrations, local-shim.sql, lead stores (supabase | postgres | memory), seed, type generator
scripts/      local-db.sh, lighthouse.mjs
docs/         ARCHITECTURE.md and phase docs
```

Workspace packages are consumed as TypeScript source (no build step); Next transpiles them via `transpilePackages`.

## Conventions

- **Brand**: user-visible brand text comes only from `BRAND` in `packages/core/src/brand.ts`. A test fails if the
  capitalised brand name appears anywhere else in code. Lowercase `healwyn` (package scope, DB names) is fine.
- **Industry packs drive everything**: form questions, consents, stages, staff levels and sequences are read from the
  active pack (`getActivePack()`), never hardcoded. Phase 4 adds packs; keep new features pack-driven.
- **One schema, both sides**: zod schemas in `packages/core` validate in the browser and again on the server.
- **Database writes go through SQL functions** (`submit_lead`, `withdraw_consent`, `erase_lead`, `hit_rate_limit`) so
  each operation is one transaction regardless of transport (supabase-js RPC or postgres.js).
- **Migrations** are append-only files in `packages/db/supabase/migrations/<14-digit version>_<name>.sql`. Every new
  table needs RLS enabled and explicit grants/revokes (a test checks every `public` table has RLS and that `anon` /
  `authenticated` hold no privileges and cannot execute functions). Run `pnpm db:types` after schema changes.
- **Audit tables are append-only** (`lead_events`, `consent_records`): rows are never updated; they disappear only with
  their lead. `lead_events.payload` must never contain personal data or free text.
- **Logging**: `lib/server/log.ts` only, with ids, codes and counts. Never log names, phone numbers, emails, IPs or the
  free-text concern. Database errors are logged by name/code only (their messages can echo row values).
- **Accessibility**: labelled inputs, hint/error wired via `aria-describedby`, error summary that takes focus, 48px
  targets, visible focus, WCAG AA contrast (enforced by `packages/ui/test/contrast.test.ts`). Decorative SVGs are
  `aria-hidden`; meaningful ones get `role="img"` and a title.
- **Copy**: calm, plain, no jargon, no medical advice, no real prices, no real people. Placeholder emails use `.example`.
- Style: Prettier (120 cols, single quotes), TypeScript strict with `noUncheckedIndexedAccess`.

## Git rules (every phase)

- Work directly on `main`. No feature branches, no pull requests. (Cloud sessions may also be assigned a
  `claude/...` branch: keep it identical to `main`, see `DECISIONS.md`.)
- Commit small and often with clear messages, but **only when `pnpm lint`, `pnpm typecheck`, `pnpm test` and
  `pnpm build` all pass** (`pnpm check`). Push to `origin main` after each green milestone.
- Never force-push, never rewrite history, never delete tags.
- End each phase with an annotated tag `phase-N-complete`, pushed.

## Constraints

- **Free tiers only.** Hosting: Netlify (commercial use allowed on Free; see `DECISIONS.md`). Do not call paid APIs.
- **No real secrets in the repo.** `.env` (repo root) is gitignored; `.env.example` lists every variable. The
  service-role key and `DATABASE_URL` are server-only; the build fails if they reach `.next/static`.
- **Synthetic data only.** Do not collect or log real health information. Never log the free-text concern.
- **No analytics or third-party trackers.** Fonts are self-hosted.
- **India's DPDP rules**: minimal collection, separate versioned consents with a hash of the exact wording,
  withdrawal is as easy as consent, and withdrawing the storage consent erases personal data (`withdraw_consent` +
  `erase_lead`).
- Health data is sensitive: notification emails exclude names, full phone numbers and free text.
- Emergency notice in the footer and on form pages; demo notice ("Demo brand, all content fictional") on every page.
