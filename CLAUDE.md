# CLAUDE.md

Read this first in every session, then `NEXT.md`, `DECISIONS.md` and `docs/ARCHITECTURE.md`. Their rules bind you.

## What this is

**Healwyn Clinics** is a fictional multi-specialty clinic brand in India, built as a portfolio demo of a lead-to-doctor
platform. Synthetic data only: no real patients, no real doctors, no medical advice, ever.

The platform is built in four phases:

1. **Foundation** (done): brand kit, marketing website, intake forms, data model.
2. **CRM** (done): staff and manager app, pipeline board, lead profiles, staff workspace, nurture sequences (email
   real, SMS/WhatsApp simulated).
3. **Routing and AI voice** (done): deterministic routing engine with explanations; a LiveKit + Gemini voice assistant
   that qualifies leads (browser voice and typed chat, a simulated dialer; real phone calls need a SIP trunk) and never
   gives medical advice.
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
| `pnpm dev:crm`                          | CRM on http://localhost:3001 (`start:crm` for a production build)                                               |
| `pnpm worker [--every N]`               | Nurture worker: send due sequence steps once, or every N seconds                                                |
| `pnpm lint`                             | ESLint (incl. jsx-a11y) + Prettier check                                                                        |
| `pnpm lint:voice` / `pnpm test:voice`   | ruff / pytest for `apps/voice` (in `apps/voice/.venv`, created on first run by `scripts/voice.sh`)              |
| `pnpm contracts` / `contracts:check`    | Regenerate JSON Schema, the voice script and pydantic models from zod / fail if they are stale                  |
| `pnpm voice:setup`                      | Python venv with the LiveKit agent runtime                                                                      |
| `pnpm voice:serve` / `voice:agent dev`  | The assistant's text service (typed chat, simulated calls; :8090) / the LiveKit voice agent                     |
| `pnpm eval:voice [-- --llm]`            | 43 scripted conversations through the real engine; writes `docs/VOICE_EVAL.md`; fails if a safety one fails     |
| `pnpm format`                           | Prettier write                                                                                                  |
| `pnpm typecheck`                        | `tsc` in every package (`next typegen` first for the web app)                                                   |
| `pnpm test`                             | Vitest: core, ui (WCAG contrast), db (integration, real Postgres), web (submission pipeline)                    |
| `pnpm build`                            | Production build of the website and the CRM, each followed by the client-bundle secrets check                   |
| `pnpm check`                            | lint, lint:voice, typecheck, contracts:check, test, test:voice, build: **the commit gate**                      |
| `pnpm test:e2e`                         | Playwright: website (375/1280 px), then CRM (laptop/tablet) against production builds (run `pnpm build` first)  |
| `pnpm lighthouse [paths]`               | Lighthouse against a running server; `BASE`, `PRESET=desktop`, `COOKIE`, `CATEGORIES` (see the script header)   |
| `pnpm db:local start\|stop\|reset\|url` | Throwaway local Postgres with Supabase roles (no Docker); `web-url` and `crm-url` print least-privilege logins  |
| `pnpm db:migrate`                       | Apply `packages/db/supabase/migrations` to `DATABASE_URL` (or via Supabase Management API with an access token) |
| `pnpm db:seed`                          | Synthetic specialties, staff and demo leads (idempotent; never touches real leads)                              |
| `pnpm db:types`                         | Regenerate `packages/db/src/database.types.ts` from a migrated database                                         |

Local database loop: `pnpm db:local start`, then `DATABASE_URL="$(pnpm -s db:local url)" pnpm db:migrate`, same for
`db:seed`, `db:types` and `pnpm dev`. Both apps also load the root `.env` themselves (`process.loadEnvFile` in
`next.config.ts`; variables already set win). `pnpm test` starts its own temporary cluster when Postgres binaries exist
(`TEST_DATABASE_URL` overrides); `pnpm test:e2e` uses the local cluster when it is running, and the CRM suite reseeds
it. Both e2e suites delete the leads they created when they finish.

## Repo structure

```
apps/
  web/        Next.js 16 App Router: public site + intake forms (server actions)
    app/        routes; contact/ and partners/ hold the server actions
    components/ site chrome, forms (client), illustrations (SVG)
    lib/server/ server-only: submission pipeline, lead store singleton, Resend notifier, logger, assistant
    components/assistant  the "Talk to our assistant" widget (LiveKit voice, typed fallback)
    e2e/        Playwright;  test/  Vitest
    app/unsubscribe, app/api/unsubscribe   unsubscribe page + RFC 8058 one-click endpoint
  crm/        Next.js 16 staff app (see apps/crm/README.md)
    app/(app)/  pipeline, leads/[id], workspace, sequences; actions.ts holds every server action
    app/api/    cron/nurture (worker trigger), messages/inbound (signed reply webhook), voice/complete (call results)
    components/ board (dnd-kit), lead table, filters, profile controls and forms, shell, undo toast
    lib/server/ session (jose), auth, asStaff (RLS transaction), queries, scores, webhooks, routing, voice, dialer
    e2e/        Playwright (laptop + tablet)
  voice/      Python intake assistant: dialogue.py (the engine), safety, nlu, llm (Gemini classifier), server.py
              (text service), agent.py (LiveKit), eval; contracts.py is generated
packages/
  core/       brand.ts, industry packs (clinic.ts + clinic-crm.ts sequences/templates/SLA/scoring + clinic-voice.ts
              script and safety lists + demo staff and leads), permissions.ts (roles, capabilities, lead visibility),
              crm/ (scoring, SLA, sequence planning, templates, assignLead), routing/ (routeLead), voice/ (call result
              contract, outcome rules), zod schemas, consent, lead payloads; contracts/ holds generated JSON
  ui/         tokens.css (Tailwind v4 theme, light/dark), accessible components, nav/footer
  db/         supabase/migrations, local-shim.sql, lead stores (supabase | postgres | memory), seed, type generator
  messaging/  email (Resend or console), unsubscribe tokens, the nurture worker and its CLI
scripts/      local-db.sh, lighthouse.mjs, voice.sh (Python venv)
docs/         ARCHITECTURE.md, VOICE.md, VOICE_EVAL.md, PROMPTS.md (the phase prompts)
```

Workspace packages are consumed as TypeScript source (no build step); Next transpiles them via `transpilePackages`.

## Conventions

- **Brand**: user-visible brand text comes only from `BRAND` in `packages/core/src/brand.ts`. A test fails if the
  capitalised brand name appears anywhere else in code. Lowercase `healwyn` (package scope, DB names) is fine.
- **Industry packs drive everything**: form questions, consents, stages, staff levels and sequences are read from the
  active pack (`getActivePack()`), never hardcoded. Phase 4 adds packs; keep new features pack-driven.
- **One schema, both sides**: zod schemas in `packages/core` validate in the browser and again on the server.
- **Database writes go through SQL functions** (`submit_lead`, `withdraw_consent`, `erase_lead`, `hit_rate_limit`,
  and in the CRM `change_lead_stage`, `assign_lead`, `add_note`, …) so each operation is one transaction regardless of
  transport. Staff functions are `security definer` with `search_path = ''`, check the caller's role themselves
  (`app_private.acting_staff`) and only touch leads the caller can see (`app_private.visible_lead`).
- **Staff reads go through RLS.** CRM code reads inside `asStaff(session, tx => …)`, which sets `role authenticated`
  and the JWT claims for the transaction. Never query leads from the CRM outside `asStaff`. `staff_can_see_lead` in
  SQL mirrors `canSeeLead` in `packages/core`; a DB test compares them for every demo user, so change both together.
- **Permissions live in `packages/core/src/permissions.ts`** and are enforced in the UI, in the server action
  (`assertCapability`) and in SQL. Pages behind a capability call `requireCapability`, which renders a real 403.
- **Nurture**: sequences live in the pack. `planStageEntry` decides enrolments when a stage changes; the SQL applies
  the plan in the same transaction. The worker claims due steps with `FOR UPDATE SKIP LOCKED`, re-checks stop
  conditions at send time, and records exactly one message per step (unique `scheduled_message_id`; Resend idempotency
  key `step-<id>`). SMS and WhatsApp are always `simulated`.
- **Routing**: `routeLead` in `packages/core/src/routing` is pure and deterministic; weights live in the pack's
  `routing` block. Every decision carries an explanation stored in the `lead.assigned` payload; overrides need a code
  from `OVERRIDE_REASONS`.
- **Voice assistant**: every spoken line comes from the pack's voice script (`clinic-voice.ts`). The model never
  speaks: Gemini only maps an answer to an allowed option, and its output is validated. Safety checks (red flags,
  advice requests, injection) run first on every turn and must pass 100% in `pnpm eval:voice`. Add a scenario for
  every safety change. After changing zod contracts or the voice script, run `pnpm contracts`.
- **Calls** start only through `start_call` in SQL (consent, opt-out, daily caps; window and verified numbers for real
  phone calls), with rules from `call_policies`, which the seed writes from the pack (`callPolicies`): re-run
  `pnpm db:seed` after changing a pack's voice limits. Every refusal is logged as `call.refused`. Results arrive signed
  at `/api/voice/complete`. Transcripts live only in `call_sessions` under RLS; never log them. Requests to the text
  service are signed over method, path and body (`signServiceRequest`).
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

## Lessons learned (do not relearn these)

- `@next/env` caches its first load, which is the app folder, so a root `.env` was silently ignored. Both
  `next.config.ts` files call `process.loadEnvFile(rootEnv)` instead.
- `forbidden()` needs `experimental.authInterrupts`, and a `loading.tsx` above the page makes the response stream with
  200 before the 403 is known. Keep loading skeletons on data pages that are not capability-guarded at a parent level.
- React 19 resets a form after its action runs; return submitted values (e.g. the login email) and use them as
  `defaultValue`.
- React 19.2 reveals streamed Suspense content in batches, so right after `load` the content can still be in a hidden
  container. In Playwright, assert visibility before `focus()`.
- Next's route announcer is `role="alert"` and dnd-kit's live region is `role="status"`: scope locators (to `main`, or
  by accessible name such as the toast's `Notification`).
- dnd-kit's default keyboard getter moves 25 px per arrow press; `columnCoordinates` in `board.tsx` jumps a column.
- plpgsql `UPDATE … RETURNING … INTO` fails on several rows; use a CTE.
- Rate limits keyed only by IP lock out a whole office (and parallel tests); the CRM login limit is keyed by IP and
  email.
- Never `pkill -f "next start"` in a sandbox shell (it can kill the shell); kill by PID, and never with a loop whose
  pattern also matches your own command line. A stale `next-server` keeps serving an old build on its port.
- Playwright's stdout is lost when a run is killed by a timeout; write diagnostics to stderr or a file.
- Device APIs need the `Permissions-Policy` header to allow them (`microphone=(self)`); `microphone=()` blocks
  `getUserMedia` silently.
- Gemini's free tier allowed 15 requests a minute: pace batch runs (`OptionClassifier(min_interval=…)`).
- Manual testing trips the assistant's start limit (5 per 10 minutes per IP); clear `rate_limits` in the local DB.
- This sandbox cannot carry WebRTC media (UDP blocked, no TURN) or open LiveKit's WebSocket from headless Chromium;
  measure voice latency on a real network.
- zod's `uuid`/`datetime` add a `pattern` next to `format`, which pydantic rejects; the contracts script drops it.

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
  service-role key, every `*_DATABASE_URL` and every `*_SECRET` are server-only; the build fails if they reach
  `.next/static`. Before each commit, grep the staged diff for the values in `.env`.
- **`DEMO_LOGIN` must be off outside demos.** It shows one-click logins for the seeded staff.
- **Synthetic data only.** Do not collect or log real health information. Never log the free-text concern.
- **No analytics or third-party trackers.** Fonts are self-hosted.
- **India's DPDP rules**: minimal collection, separate versioned consents with a hash of the exact wording,
  withdrawal is as easy as consent, and withdrawing the storage consent erases personal data (`withdraw_consent` +
  `erase_lead`).
- Health data is sensitive: notification emails exclude names, full phone numbers and free text.
- Emergency notice in the footer and on form pages; demo notice ("Demo brand, all content fictional") on every page.
