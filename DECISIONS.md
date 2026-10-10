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
