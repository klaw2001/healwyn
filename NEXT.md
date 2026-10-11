# NEXT.md

Status at the end of **Phase 3** (2026-10-11). The next session starts here.

## Milestones

Tag pushes are refused by the git proxy in cloud sessions (HTTP 403), so the tags exist locally and their commits are
listed here. Recreate a tag anywhere with `git tag -a phase-N-complete <sha> -m "Phase N complete"`.

| Tag                | Commit                                  | What                                                 |
| ------------------ | --------------------------------------- | ---------------------------------------------------- |
| `phase-1-complete` | `10988d3`                               | Brand kit, website, intake forms, data model         |
| `phase-2-complete` | `30d1ea7`                               | CRM, staff workspace, nurture sequences              |
| `phase-3-complete` | the commit titled "Phase 3 complete: …" | Routing engine, AI intake assistant, simulated calls |

## Done in Phase 3

- **Routing engine** (`packages/core/src/routing/engine.ts`).
  - Pure and deterministic. Filters the specialty's team (or falls back to care coordinators), capacity, and level
    rank 3+ for urgent leads; scores language, seniority × urgency, spare load and continuity; breaks ties by load
    ratio, last assignment, then id. The billing desk is copied in on insured leads.
  - Weights live in the pack (`routing`). Every decision explains each candidate's score; the profile shows it.
  - `assignLead(lead, { mode: 'auto' })` uses it with the Phase 2 signature. The profile offers **Accept suggestion**
    or an override with a reason code; both are stored in the `lead.assigned` payload.
  - Table-driven tests plus a simulated week checking that nobody is starved or overloaded.
- **Contracts.** zod → JSON Schema (`packages/core/contracts/`) → pydantic (`apps/voice/healwyn_voice/contracts.py`).
  `pnpm contracts:check` is part of `pnpm check`.
- **The assistant** (`apps/voice`, see `docs/VOICE.md`).
  - One deterministic engine (`IntakeSession`) for the LiveKit voice agent, the typed chat, the simulated dialer and
    the eval. Every line it says comes from the pack's voice script (`clinic-voice.ts`).
  - It says it is an AI, asks for consent before collecting anything, asks five questions in English or Hindi
    (following the caller), recovers from vague or off-topic answers, confirms, and explains what happens next.
  - Safety runs first on every turn: 12 red-flag categories with negations (stop, give 112, flag urgent, urgent task),
    advice requests (declined, intake continues), prompt injection, "are you a person?".
  - Gemini (`gemini-3.5-flash-lite`, free tier) only maps an answer to an allowed option; its output is validated.
  - Limits from the pack: 5 minutes and 40 turns per call, 50 calls a day (SQL, advisory lock).
  - The agent refuses to start with `VOICE_REAL_DATA=true`. Logs carry ids and codes only.
- **CRM.**
  - `/api/voice/complete`: HMAC-SHA256 over `timestamp.body`, 5-minute window, 256 KB cap, zod validation, answers
    checked against the pack. Records the call, merges answers, moves a new lead to AI-triaged (with its nurture
    plan), routes it, creates an urgent task after a red flag and rescores. Replays change nothing.
  - The AI summary panel: summary, outcome, flags, answers and the transcript (behind a disclosure).
  - **Simulated assistant call** on the profile (front desk), and **Phone call** when a SIP trunk is configured.
  - The manager's **AI assistant** screen: today against the daily cap, the month against LiveKit's free minutes
    and credit, Gemini requests, recent calls, and the verified demo numbers.
- **Website.** **Talk to our assistant** on Home and Contact: a dialog with the consent text and a plain explanation
  of the microphone; voice through LiveKit with live captions, an "AI assistant" label, mute and end; typed chat when
  the microphone is refused or LiveKit is unreachable (connect capped at 12 s). The lead is created first, so a dropped
  call still reaches staff.
- **Data.** Migrations `20261012000001` to `…03`: routing context functions, `assign_lead` with the method and
  explanation, `call_sessions`, `verified_demo_numbers`, `start_call` (consent, opt-out, erasure, cap; window and
  verified number for phone), `record_voice_call` (idempotent, stores the channel), `apply_voice_outcome`,
  `save_call_lead_score`, and erasure of call content.

## Verified, and how

- **`pnpm check`** passes: ESLint and Prettier, ruff, typecheck, `contracts:check`, Vitest, pytest and both builds
  (with the client-bundle secrets check).
- **Vitest** (core, ui, db against a real Postgres 16, messaging, web): routing tables and fairness, assignment,
  voice outcome rules, the assistant start pipeline, call checks in SQL (consent withdrawn, opted out, window, verified
  numbers, cap under concurrency), the webhook's idempotency, RLS on `call_sessions`, erasure of call content.
- **pytest**: safety lists in both languages (with negations), conversation flows, the text service's signatures and
  limits, the webhook signer, and the eval's required scenarios.
- **Voice eval** (`docs/VOICE_EVAL.md`): 43 scenarios. Deterministic 42/43, with Gemini 43/43; every red-flag and
  no-advice scenario passes in both. The deterministic miss is a description that names no option ("red itchy
  patches"): it is asked again and handed to a coordinator.
- **Playwright.**
  - Website (375 px and 1280 px): the security headers (including `microphone=(self)`), the assistant dialog's
    consent and validation, plus every Phase 1 check.
  - CRM (laptop and tablet): website form → simulated assistant call → the lead is AI-triaged, routed with an
    explanation and shows the summary; a red-flag call creates an urgent task; refusals (no consent) are logged;
    accept and override routing; the manager's assistant screen and verified numbers; the webhook rejects unsigned,
    stale and invalid requests.
- **By hand, end to end** with the local servers: typed chat from the website (triaged and routed to the right
  doctor, with a summary), a red-flag chat (urgent flag and task) and the simulated dialer.
- **Lighthouse**: Home and Contact (mobile) 98 performance, 100 accessibility, 100 best practices; the CRM's
  assistant screen and a lead profile 100.
- **Latency**: engine under 1 ms per turn; Gemini classification 0.7–1.1 s when needed; typed chat 50–190 ms per turn
  at a phone-sized viewport; voice-to-typed fallback about 5 s.
- **LiveKit**: the agent registered with LiveKit Cloud from this sandbox.

## Not verified

- **Voice latency (caller stops speaking → assistant speaks) and real speech.** This sandbox blocks WebRTC media (UDP,
  no TURN) and headless Chromium could not open LiveKit's WebSocket through the proxy. The agent logs
  `agent.latency` and `agent.turn` per turn; measure on a real network and phone. Recognition quality for Hindi and
  Hinglish, interruptions and noise are untested.
- **Real phone calls.** No SIP trunk exists (a Twilio trial needs sign-up and phone verification). `placePhoneCall` is
  written to LiveKit's SIP API but has never dialled. Steps in `docs/VOICE.md`.
- **Agent hosting** on LiveKit Cloud and the text service on Render: not deployed.
- **Live Supabase, Netlify, and real email**, as in Phase 2: everything ran against the local Postgres 16.
- **Real devices and screen readers** for the widget (Chromium emulation only).

## Known gaps and caveats

- **Gemini's free tier** is 15 requests a minute and may use inputs for training: fine for a demo with synthetic data,
  not for patients. The deterministic matcher covers most answers; heavy concurrent use will hit the limit and fall
  back to "asked again, then a coordinator".
- **The typed chat's sessions live in the text service's memory.** A restart drops calls in progress (each still has
  its lead). Render's free instance sleeps after 15 minutes, so the first chat after a quiet spell waits about a
  minute unless the keep-awake ping is set up.
- **Inference credit** (US$2.50 a month) caps speech-to-text at roughly 430 minutes; the usage screen shows an
  estimate from call durations, not LiveKit's billing.
- **No Content-Security-Policy yet** (Phase 4 hardening). The website's voice call needs `connect-src` for the
  LiveKit host (wss) and `media-src`/`blob:` for audio.
- **Partner leads share the clinic board; lists are not paginated; reminders are in-app only; the inbound webhook is a
  stub**: unchanged from Phase 2.
- **Rotate the supplied keys.** The database password, Resend, Gemini and LiveKit keys were pasted into a chat.

## Exact first steps for Phase 4

1. Read `CLAUDE.md`, this file, `DECISIONS.md`, `docs/ARCHITECTURE.md` and `docs/VOICE.md`. `pnpm db:local start`,
   migrate and seed, then `pnpm check`, then `pnpm build && pnpm test:e2e` (the CRM suite starts the text service on
   :3290 itself).
2. **Dashboard** (`apps/crm/app/(app)/dashboard`): SQL views or functions under RLS for the funnel, first response
   against SLA, no-shows, load, call outcomes (`call_sessions.outcome`), sources and conversion over time. Date range
   and specialty filters in the URL. Document every query in `docs/METRICS.md`.
3. **Booking**: `availability_templates`, `availability_exceptions` and `appointments` with an exclusion constraint
   (`btree_gist`, `tstzrange`) per staff member against double booking; `book_appointment` / `reschedule` / `cancel`
   functions that move stages through `apply_stage_change` so nurture plans follow. India time everywhere.
4. **Payments**: Razorpay test mode. Refuse keys that do not start with `rzp_test_`. Server-side orders, a signed
   webhook (idempotent by payment id) that moves the lead to Package active.
5. **Industry packs**: real estate, wealth advisory, home interiors, each with copy, questions, stages, sequences,
   routing weights, a voice script with its own safety rules (wealth: never investment advice), a theme and demo seed;
   eval scenarios per pack. `getActivePack()` becomes runtime-switchable (cookie or DB setting behind `DEMO_MODE`).
6. **Demo kit**: `docs/PITCH.md`, `WALKTHROUGH_SCRIPT.md`, `DECK_OUTLINE.md`, the case-study page, the architecture
   diagram (Mermaid + SVG), `pnpm demo:reset`, the guided tour. Then hardening (CSP with nonces, audit, a11y, perf),
   `docs/FREE_TIER_REPORT.md`, `docs/DEPLOY.md`, the final `NEXT.md`, and the `phase-4-complete` tag.
