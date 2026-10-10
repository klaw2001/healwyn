# apps/crm

The staff and manager app: pipeline board, lead profiles, workspaces and nurture sequences. Next.js 16 App Router,
server components for reads, server actions for writes.

## Run it

```bash
pnpm db:local start
export DATABASE_URL="$(pnpm -s db:local url)"
pnpm db:migrate && pnpm db:seed           # 12 staff (one demo login per role) and 40 demo leads
pnpm dev:crm                              # http://localhost:3001  (DEMO_LOGIN=true shows one-click demo logins)
pnpm worker --every 60                    # optional: the nurture worker, once a minute
```

Demo users (password `DEMO_USER_PASSWORD`, default `demo-pass-2026`): `anita.kapoor@healwyn.example` (manager),
`neha.joshi@…` (care coordinator), `asha.raman@…` (specialist doctor), `deepa.menon@…` (billing desk).

## How it is put together

| Path                       | What                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `proxy.ts`                 | Sends requests without a session cookie to `/login` (API routes check their own secrets)                       |
| `lib/server/session.ts`    | HS256 session cookie (`hw_crm_session`, 8 hours) signed with `SESSION_SECRET`                                  |
| `lib/server/auth.ts`       | `requireSession`, `requireCapability` (renders 403 via `forbidden()`), password check (local or Supabase Auth) |
| `lib/server/db.ts`         | `asStaff(session, fn)`: a transaction as `authenticated` with the JWT claims set, so RLS applies to every read |
| `lib/server/queries.ts`    | Read models for the board, list, profile, workspace and sequences                                              |
| `app/(app)/actions.ts`     | Server actions; each checks the capability, then calls one `security definer` SQL function                     |
| `components/board.tsx`     | dnd-kit board: pointer, touch and keyboard dragging between columns, plus a Move menu on each card             |
| `components/undo.tsx`      | Undo stack for stage moves (sessionStorage) and the toast                                                      |
| `app/api/cron/nurture`     | Runs the nurture worker once (Bearer `CRON_SECRET`)                                                            |
| `app/api/messages/inbound` | Signed webhook for replies (HMAC of `timestamp.body`, five-minute window); stops sequences                     |
| `netlify/functions/*.mts`  | Scheduled function that calls the cron route every five minutes                                                |

Stages, sequences, templates, SLA targets and scoring rules all come from the active industry pack in
`@healwyn/core`. Permissions come from `PERMISSIONS` and `LEAD_VISIBILITY` in `@healwyn/core` and are enforced
three times: in the UI (what is shown), in the server action (`assertCapability`) and in Postgres (RLS policies and
the checks inside each SQL function).

## Tests

`pnpm --filter @healwyn/crm test:e2e` (after `pnpm build`) starts the website on :3200 and the CRM on :3201 against
the local database, reseeds it, and runs the flows at laptop (1366×860) and tablet (820×1180, touch) sizes: sign-in
per role, 403s, a website enquiry moving through stages with undo, keyboard-only board moves, notes, tasks,
assignment, a sequence sending and stopping on reply, unsubscribe, and the webhook and cron secrets.
