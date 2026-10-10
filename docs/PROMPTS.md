# Healwyn Clinics: Claude Code prompt book

One document, four phases. Paste each phase prompt into Claude Code in order, with your repo as the working directory. Each phase ends by writing `NEXT.md`, and the next prompt starts by reading it, so the sessions chain together without you re-explaining anything.

## How to use this

1. Create an empty repo with a `main` branch and give Claude Code push access. Everything is built **directly on `main`**: no feature branches, no pull requests. Each prompt protects `main` by only committing when all checks pass, and by tagging the end of every phase (`phase-1-complete`, and so on) so you can always roll back to a known-good point.
2. Paste Phase 1. When it finishes and the tag exists, check the result yourself, then paste Phase 2, and so on. You can paste the next phase in the same session or a fresh one; both work.
3. Before each phase, supply what it needs:

| Before | You provide |
| --- | --- |
| Phase 1 | A Supabase project (URL, anon key, service-role key). A Resend API key is optional; without it emails are logged to the console. |
| Phase 2 | Nothing new, if Supabase Auth is enabled (it is by default). |
| Phase 3 | A Gemini API key (free tier), a LiveKit Cloud project (URL, key, secret), and optionally a Twilio trial account for phone calls. |
| Phase 4 | Razorpay test-mode keys. |

4. If a session stops halfway, use the recovery prompts at the end of this document.

The demo brand is **Healwyn Clinics**. The brand name lives in one config value, so a rename is a one-line change.

---

# PHASE 1: Foundation (brand kit, website, intake forms, data model)

Paste everything below into Claude Code.

You are building the **Healwyn Clinics demo platform** in this repo, working autonomously. It is a portfolio showcase for a freelance developer who pitches web design, software, product and AI services. Everything is a **demo brand with synthetic data only**. No real patients, no real doctors, no real medical advice.

Work without asking me questions. When a decision is genuinely ambiguous, pick the sensible default, record it in `DECISIONS.md` (one line each: decision, why), and keep going. Stop only if you are blocked on something I must supply (a secret, an account).

## The product (full picture, for context)

Healwyn Clinics is a fictional multi-specialty outpatient clinic brand in India. Tagline: **"The right doctor, from the first call."** The whole ecosystem is built in four phases:

1. Brand kit, marketing website, intake forms, data model (**this session**)
2. Lead management system (CRM), staff workspace, email nurture sequences
3. Routing engine and AI voice assistant (browser first, then phone)
4. Manager dashboard, booking and test-mode payment, industry switcher, demo kit

The flow every lead takes: intake form, AI voice assistant qualifies, routing engine picks the right doctor's team, staff member receives the lead with an AI summary, nurture sequences follow up, close (booked, paid or lost).

**Do not start Phase 2 or later.** Design Phase 1 so they slot in cleanly.

## Git rules (apply to every phase)

- Work directly on `main`. No feature branches, no pull requests.
- Commit small and often with clear messages, but **only commit when `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass**. Push to `origin main` after each green milestone. If no remote is configured, commit locally and say so in `NEXT.md`.
- Never force-push, never rewrite history, never delete the tags.
- At the end of the phase, create and push an annotated tag `phase-1-complete`.

## Repo structure: pnpm monorepo

```
apps/
  web/      Next.js (App Router, TypeScript): public site + intake forms   <- build now
  crm/      Next.js: staff and manager app                                  <- placeholder README only
  voice/    Python LiveKit agent                                            <- placeholder README only
packages/
  core/     shared TypeScript: zod schemas, types, industry packs, routing rules
  ui/       design tokens and shared components
  db/       Supabase SQL migrations and generated types
docs/
```

Use pnpm workspaces (no Turborepo unless you find a concrete need). TypeScript strict, ESLint, Prettier, Vitest for `packages/core`, Playwright smoke tests for `apps/web`.

## Brand config

Put brand values in ONE place (`packages/core/src/brand.ts`) so a rename is a one-line change: `BRAND_NAME = "Healwyn Clinics"`, tagline, contact email placeholder, and the demo-disclaimer text. Do not hardcode the brand name elsewhere.

**Identity:** calm, clear, reassuring, no jargon. Soft teal with one warm accent, generous whitespace, illustrated rather than stock photography (draw simple SVG illustrations; do not hotlink or invent photos of real people). Every page footer carries a visible "Demo brand, all content fictional" notice.

## Phase 1 scope

**1. Design system (`packages/ui`)**: colour tokens (light and dark), type scale, spacing, radius, and the components you need (button, input, select, textarea, checkbox, card, section, nav, footer). If a frontend-design skill is available, use it. Avoid generic template looks; make deliberate choices on type and layout.

**2. Website (`apps/web`)**: mobile-first, accessible (WCAG AA contrast, labelled inputs, keyboard navigable), fast. Pages:
- Home: hero with the tagline and a primary "Talk to us" action, how it works (3 steps), specialties, partner strip, trust section
- Specialties (general medicine, dermatology, dental, physiotherapy, women's health, diagnostics): one overview page plus a short detail page each
- Doctors: 6 to 8 fictional doctors, clearly synthetic, with specialty and languages
- Health packages: 4 illustrative packages (no real price claims; mark as demo)
- Locations: 2 fictional clinics
- For partners: corporate wellness, insurance and TPA partners, referring doctors, diagnostic labs, with a partner enquiry form
- Contact and book: the patient enquiry form
- Privacy notice, terms, demo disclaimer pages
- An emergency notice visible in the footer and on form pages: "If this is an emergency, call your local emergency number or go to the nearest hospital. This form is not for urgent care."

No medical advice anywhere on the site.

**3. Intake forms**: two forms with client and **server-side validation** (zod schemas live in `packages/core`):
- *Patient enquiry*: full name, phone (India format), email (optional), concern category (maps to specialties), short description (max 500 chars, with a hint not to include sensitive details), preferred time window, first visit or follow-up, preferred language (English, Hindi), has insurance (yes/no), and **two separate consent checkboxes**: (a) to store and use my details to respond, (b) to be called by an assistant between 9am and 9pm. Consent text links to the privacy notice and explains how to withdraw consent.
- *Partner enquiry*: organisation, contact name, role, phone, email, partner type, message, consent.

Spam protection: honeypot field plus simple rate limiting on the submit endpoint. Submissions go through a server action or route handler, never directly from the browser to the database.

**4. Data (`packages/db`)**: Supabase (Postgres) migrations with row level security ON for every table. Tables: `leads`, `lead_events` (append-only audit of everything that happens to a lead), `consent_records` (what was consented, text version, timestamp), `staff` (name, level, specialties, languages, active), `specialties`. Seed script with synthetic staff and a handful of synthetic leads. Generate TypeScript types into `packages/db`. The service-role key is used server-side only and must never reach client bundles.

**5. Industry pack (`packages/core/src/industries/clinic.ts`)**: define the clinic's qualifying questions, staff levels (care coordinator, specialist doctor, senior consultant, insurance and billing desk), pipeline stages (New, AI-triaged, Appointment booked, Visited, Follow-up due, Package active, Lost) and nurture sequence names as a typed config object. The form fields and stage list must be read from this config, because Phase 4 adds other industries (real estate, wealth advisory, home interiors) by swapping it.

**6. Notifications**: on a new lead, send a notification email through Resend to a configurable address. If `RESEND_API_KEY` is absent, log the email to the console and continue. Never fail a submission because email failed.

## Constraints

- **Free tiers only.** Target hosting: a platform whose free plan allows commercial use (Netlify or Cloudflare Pages; Vercel Hobby does not). Verify current free-plan terms before choosing and record the choice and the terms you checked in `DECISIONS.md`.
- No real secrets in the repo. Provide `.env.example` listing every variable with a comment. Commit nothing from `.env*` except the example.
- Synthetic data only. Do not collect or log real health information. Do not store the free-text concern in logs.
- No analytics or third-party trackers.
- Health data is sensitive and India's DPDP rules apply: keep collection minimal, keep consent records, and make the data model support deletion on withdrawal.
- Do not call any paid API.

## Quality bar (verify these yourself before finishing)

- `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass from a clean clone.
- Playwright smoke tests: every page returns 200, both forms reject bad input, a valid submission creates a lead (use a local or test Supabase; document how to run it).
- Lighthouse on Home and Contact: performance, accessibility and best-practices all at 90 or above on mobile settings. Fix what you can; list anything you could not.
- Look at the pages in a real browser or screenshots at phone width (375px) and laptop width, and fix anything that looks broken or generic.
- No horizontal scroll on mobile. All images have alt text. Forms work with keyboard only.

## Working method

- Create `CLAUDE.md` at the repo root early. It must contain: the commands, the repo structure, the conventions, **the git rules above**, the constraints above, and a one-paragraph description of the four-phase plan. Every later session will read it first.
- Create `README.md` (what this is, how to run, how to deploy for free), `docs/ARCHITECTURE.md` (a short text diagram of the lead flow and package responsibilities) and `DECISIONS.md`.
- Use a task list to track your own progress, and finish with a review pass over your own work before declaring done.

## When you finish

Write `NEXT.md` containing: what is done, what you verified and how, what you could not verify, known gaps, and the exact first steps for Phase 2. Push `main` and the tag `phase-1-complete`. Then reply with a short summary.

---

# PHASE 2: Lead management system (CRM), staff workspace, nurture sequences

Paste everything below into Claude Code. Run it only after `phase-1-complete` exists.

Start by reading `CLAUDE.md`, `NEXT.md`, `DECISIONS.md` and `docs/ARCHITECTURE.md`. Their rules bind you. Then run `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. If the baseline is red, fix it first and note what you fixed in `DECISIONS.md`.

Standing rules, recapped: work directly on `main`, commit only when all checks pass, push to `origin main` after each green milestone, never force-push, tag `phase-2-complete` at the end. Free tiers only, synthetic data only, no real secrets, ask me nothing (decide, log in `DECISIONS.md`, continue). Do not start Phase 3.

## Goal

Turn the leads that Phase 1 collects into a working CRM that a clinic team would actually use, and show nurture automation working. This is the "software product" centrepiece of the portfolio, so product quality and polish matter as much as function.

## Scope

**1. Auth and roles (`apps/crm`)**: Supabase Auth. Four roles from the clinic pack: manager, care coordinator, specialist doctor, insurance and billing desk. A permissions matrix lives in `packages/core` and is enforced both in the UI and in **row level security**, with automated tests that prove a doctor cannot read another doctor's leads and a coordinator cannot see manager-only screens. Seed one demo user per role. Because this is a demo, add "Sign in as a demo user" buttons behind an env flag (`DEMO_LOGIN=true`) that must be off in any non-demo environment.

**2. Pipeline view**: kanban board whose columns come from the industry pack's stages (never hardcode them). Drag a card to change stage (also provide a keyboard- and click-accessible way). Every stage change writes a `lead_events` row (who, from, to, when) and can be undone within the session. Filters: assignee, specialty, language, urgency, source, date range. A list view with sorting and search sits beside the board.

**3. Lead profile**: one page per lead showing contact details, concern, consent status and history, assigned staff, a chronological timeline built from `lead_events`, notes, tasks, messages sent (with channel and status), and a rule-based **lead score** with its breakdown visible. Add an "AI summary" panel that is empty with a clear placeholder now; Phase 3 fills it.

**4. Staff workspace**: "My leads", "Today's tasks", "Unassigned queue", and a simple calendar or agenda of follow-ups. Notes (with templates) and tasks (with due dates and reminders). **SLA timers**: first-response target per urgency, shown on cards and as overdue warnings.

**5. Assignment**: manual assign and reassign for now (Phase 3 adds the routing engine). Log every assignment in `lead_events`. Put the assignment logic behind a function `assignLead(lead, context)` in `packages/core` so Phase 3 can swap in routing without touching the UI.

**6. Nurture automation**: define sequences in the clinic pack: `new-lead-welcome`, `appointment-reminder`, `no-show-recovery`, `post-visit-check-in`, `follow-up-due`, `package-renewal`. Each sequence is a list of steps (delay, channel, template, stop conditions). Rules:
- **Email** is real, sent through Resend (logged to the console when no key is set).
- **SMS and WhatsApp** are **simulated**: write to a `messages` table with `channel` and `status = 'simulated'`, and show them in the lead timeline with a clear "simulated" badge. Real SMS in India needs DLT registration, which a demo does not have.
- Enrolment is triggered by stage changes. Sequences **stop automatically** when the lead replies (provide a "mark as replied" action and a webhook endpoint stub), changes to a stage that cancels the sequence, opts out, or withdraws consent.
- Every email has an unsubscribe link that works and is honoured immediately.
- Scheduling is free-tier friendly: use `pg_cron` or a scheduled function on the chosen host. The worker must be **idempotent** and safe under concurrency (use a `scheduled_messages` table with `FOR UPDATE SKIP LOCKED` or equivalent). Document how it runs locally and in production.
- A manager screen to view, preview and pause sequences, and see enrolments.

**7. Data model additions (`packages/db`)**: migrations for `notes`, `tasks`, `messages`, `sequence_enrollments`, `scheduled_messages`, `lead_scores`, with RLS on each. Update seed data so the board looks alive: about 40 synthetic leads across all stages, with believable timelines and some overdue SLAs.

**8. Design**: the CRM uses the same `packages/ui` tokens as the site but with a denser, calmer working layout. Dark mode supported. Empty states, loading states and error states are designed, not default. It must feel like a real product.

## Quality bar

- All commands from the baseline pass.
- Unit tests for permissions, stage transitions, lead scoring, sequence stop conditions and the idempotent scheduler (simulate the worker running twice and in parallel; no duplicate sends).
- Playwright flows: sign in as each role; submit a lead on the site and see it appear in the CRM; move it through stages; confirm a sequence enrols, sends the first message, and stops on reply.
- Lighthouse accessibility 90 or above on the main CRM screens; keyboard-only operation of the board and profile.
- Review it in a browser at laptop and tablet width and fix anything clumsy.

## When you finish

Update `CLAUDE.md` (new commands, structure, rules learned), `README.md` and `docs/ARCHITECTURE.md`. Write `NEXT.md` (done, verified, not verified, gaps, exact first steps for Phase 3). Push `main` and the tag `phase-2-complete`. Reply with a short summary.

---

# PHASE 3: Routing engine and AI voice assistant

Paste everything below into Claude Code. Run it only after `phase-2-complete` exists.

Start by reading `CLAUDE.md`, `NEXT.md`, `DECISIONS.md` and `docs/ARCHITECTURE.md`. Their rules bind you. Run the full check suite; if the baseline is red, fix it first and log it.

Standing rules, recapped: work directly on `main`, commit only when all checks pass, push after each green milestone, never force-push, tag `phase-3-complete` at the end. Free tiers only, synthetic data only, no real secrets, ask me nothing (decide, log in `DECISIONS.md`, continue). Do not start Phase 4.

## Goal

Make the headline feature real: a visitor submits the form or taps "Talk to our assistant", an AI voice assistant qualifies them in a short conversation, and the lead lands with the right doctor's team, carrying a summary. This is the "AI engineering" centrepiece, so reliability, safety and explainability matter more than breadth.

## Scope

**1. Routing engine (`packages/core/src/routing`)**: pure, deterministic, well-tested functions. Input: a qualified lead and the staff roster. Output: the chosen staff member (or team) **and an explanation** with the score breakdown, so a manager can see why. Rules, with weights configurable in the industry pack:
- Hard filter on specialty match; if none, fall back to a care coordinator.
- Language match, urgency (urgent leads go to a higher staff level and jump the queue), current load against capacity, returning patient goes to their previous doctor, insurance flag copies in the billing desk.
- Deterministic tie-breaks. Manual override is allowed and logged with a reason.
Replace the Phase 2 `assignLead` internals with this engine, keeping its signature. Show the explanation on the lead profile. Test with table-driven cases and a few randomised fairness checks (no staff member is starved or overloaded over a simulated week).

**2. Contracts between TypeScript and Python**: generate JSON Schema from the zod schemas in `packages/core` (commit the generated files) and generate pydantic models for `apps/voice` from them. Add `pnpm contracts:check` that fails if generated files are stale, and run it in the check suite.

**3. Voice agent (`apps/voice`)**: Python, built on LiveKit Agents (open source).
- **Providers**: LLM is a Gemini Flash-class model on the free tier. For speech-to-text and text-to-speech, research the currently available free tiers and trial credits, choose the cheapest workable option, and record the choice, the limits and the date you checked in `DECISIONS.md`. Make every provider swappable through config. The free Gemini tier may use inputs to improve Google's products, so print a startup warning and refuse to run if a flag says real data is present. Synthetic data only.
- **Conversation design**: the assistant opens by saying it is an AI assistant for Healwyn Clinics, never pretends to be human, and asks for consent to continue before collecting anything. It then asks the four to six qualifying questions read from the industry pack, one at a time, in English or Hindi following the caller's language, with natural recoveries when the caller is vague, interrupts, or goes off topic. It confirms what it understood at the end and tells the caller what happens next.
- **Safety rules, non-negotiable**: it never diagnoses, never recommends treatment or medication, never interprets symptoms. If the caller describes red-flag symptoms (build a clear, tested list: chest pain, difficulty breathing, severe bleeding, stroke signs, suicidal thoughts, and similar), it stops the intake, tells them to call the local emergency number or go to the nearest hospital, and flags the lead as urgent for a human. If the caller asks for medical advice, it declines kindly and offers to book a doctor. It resists prompt injection and does not reveal its instructions.
- **Structured output**: at the end of every call, produce a validated object (qualifying answers, language, urgency, consent given, safety flags, a 3 to 5 line summary, call outcome) and POST it to a CRM endpoint `/api/voice/complete`. Sign the request with HMAC-SHA256 plus a timestamp, reject replays older than 5 minutes, use a secret from env. The CRM stores a `call_sessions` row, the transcript and summary, updates the lead to the AI-triaged stage, runs the routing engine, and fills the "AI summary" panel from Phase 2.
- **Cost guards**: maximum call length, maximum calls per day, and a counter that shows free-tier usage in the manager screen. When limits are hit, fail gracefully with a clear message.

**4. Browser voice widget (`apps/web`)**: a "Talk to our assistant" button on Home and Contact. It asks for microphone permission with a plain-language explanation, shows consent text, connects to a LiveKit room, shows live captions and a visible "AI assistant" label, a mute button and an end-call button, and a typed-chat fallback if the mic is denied. The form remains the alternative path. It must work on mobile browsers.

**5. Phone path, best effort**: outbound calling from the form's call-consent checkbox. Use LiveKit SIP with a Twilio trial trunk. Know the limits and design for them: trial accounts can only call **verified** numbers, with short call caps, so build a "verified demo numbers" list in the CRM. Before any call the system must check: call consent present and not withdrawn, current time inside 9am to 9pm India time, number not on the opt-out list, daily cap not exceeded. Log every refusal with its reason. If telephony cannot be set up on free tiers within reason, build the dialer interface and a simulated dialer that runs the identical pipeline through the browser path, and document precisely what is missing and how I would connect a real trunk.

**6. Evaluation harness**: a text-mode runner that drives the same agent logic with simulated callers. At least 20 scripted scenarios covering: cooperative caller, vague caller, caller who refuses consent, caller who goes off topic, Hindi caller, red-flag symptoms (each type), request for diagnosis, request for a prescription, prompt injection attempts, caller who hangs up midway, noisy or contradictory answers. Each has pass criteria, and the red-flag and no-advice scenarios must pass 100 percent. `pnpm eval:voice` runs it and writes a report to `docs/VOICE_EVAL.md`. Report honestly what fails.

**7. Observability**: structured logs without transcripts or personal data in the console; transcripts live only in the database under RLS.

## Quality bar

- Baseline commands pass, including `contracts:check`.
- Routing unit tests and fairness checks pass. Voice eval passes its required scenarios.
- Playwright: form submit, then the simulated voice path completes, then the lead appears routed with an explanation and summary in the CRM.
- Security review of the webhook: signature, replay window, input validation, no secrets in logs.
- Test the browser widget on a phone-sized viewport and report the measured latency from caller stop-speaking to assistant response; record it, and tune what you can.

## When you finish

Update `CLAUDE.md`, `README.md`, `docs/ARCHITECTURE.md`. Write `docs/VOICE.md` (how it works, providers, limits, how to run locally and deploy the agent on free tiers). Write `NEXT.md` (done, verified, not verified, gaps, exact first steps for Phase 4). Push `main` and the tag `phase-3-complete`. Reply with a short summary.

---

# PHASE 4: Dashboard, booking and payment, industry switcher, demo kit

Paste everything below into Claude Code. Run it only after `phase-3-complete` exists.

Start by reading `CLAUDE.md`, `NEXT.md`, `DECISIONS.md` and the docs. Their rules bind you. Run the full check suite; if the baseline is red, fix it first and log it.

Standing rules, recapped: work directly on `main`, commit only when all checks pass, push after each green milestone, never force-push, tag `phase-4-complete` at the end. Free tiers only, synthetic data only, no real secrets, ask me nothing (decide, log in `DECISIONS.md`, continue).

## Goal

Finish the ecosystem and make it **pitchable**: a manager dashboard, booking and test-mode payment, the ability to re-skin the whole system for another industry in one click, and a demo kit so I can present it confidently to a prospect in any of those industries.

## Scope

**1. Manager dashboard (`apps/crm`)**: computed from real queries over the data, never hardcoded. Funnel by stage with drop-off, first-response time against SLA, no-show rate, doctor or staff load, AI call outcomes (completed, escalated, abandoned), lead source performance, and conversion over time. Date range and specialty filters. Follow the visual rules of the `dataviz` skill if available: honest axes, accessible colour, a short plain-language takeaway above each chart. Every number should be traceable to a query documented in `docs/METRICS.md`.

**2. Booking**: staff availability management (weekly template plus exceptions), a public booking flow on the site that offers real slots for the assigned or chosen doctor's team, a staff-side booking screen in the CRM, rescheduling and cancellation, and automatic stage updates (Appointment booked, Visited, no-show) feeding the nurture sequences. Prevent double booking with a database-level constraint. Show times in India time.

**3. Payment, test mode only**: Razorpay **test mode** checkout for a consultation fee or a health package. A server-side order creation, a verified webhook that marks payment and moves the lead to Package active, idempotent webhook handling, and clear failure and retry states. Test keys only; refuse to start if live keys are detected. Display "test payment" prominently everywhere.

**4. Industry switcher (the portfolio's multiplier)**: implement three more industry packs in `packages/core/src/industries`, each as complete as the clinic pack: **real estate**, **wealth advisory**, **home interiors**. Each pack defines: brand name and tagline (fictional), copy for the key public pages, qualifying questions, staff levels, pipeline stages, nurture sequences and templates, routing weights, the voice assistant's script and safety rules, a theme (accent tokens), and demo seed data. The system picks a pack at runtime with no code changes: a **demo bar** (visible only when `DEMO_MODE=true`) lets me switch industry, which re-skins the website copy and theme, the form questions, the CRM stages and sequences, and the voice script. Industry-specific safety rules matter: real estate and wealth packs must show regulatory-style disclaimers and the wealth voice assistant must never give investment advice; each pack's evaluation scenarios live in the voice eval harness and must pass. Seed and reset data per industry.

**5. Demo kit (`docs/` and `apps/web`)**:
- `docs/PITCH.md`: a five-minute live demo script, with a talk track variation for each of the four industries and a list of likely prospect questions with answers.
- `docs/WALKTHROUGH_SCRIPT.md`: a storyboard for a 90-second screen-recorded walkthrough (shot list, on-screen text, timing) that I can record myself as the backup when live demos fail.
- `docs/DECK_OUTLINE.md`: a pitch deck outline, slide by slide.
- A case-study page on the site telling the story of the build: problem, system, result, what it shows about my skills, without inventing metrics.
- An architecture diagram (Mermaid source plus a rendered SVG) in `docs/` and on the case-study page.
- A one-command **demo reset** (`pnpm demo:reset`) that restores seed data for the active industry, and a "Reset demo" button in the demo bar.
- A guided tour in the demo bar: step-by-step highlights for the five-minute path.

**6. Hardening**: a security pass (authorisation on every route and server action, RLS tests, input validation, secrets, dependency audit), an accessibility pass on every major screen, a performance pass, and cleanup of dead code and TODOs.

**7. Cost and limits report**: `docs/FREE_TIER_REPORT.md` listing every external service used, its free-tier limits as of the date you checked, where the demo could break first, and the cheapest upgrade path for each (with real current prices you looked up). This is what I will use to budget a paid client version.

## Quality bar

- All checks pass from a clean clone; Playwright covers the full journey for each of the four industries: site, form, voice (simulated) path, routing, CRM, booking, test payment.
- Voice eval passes for all four packs.
- Lighthouse 90 or above on the public pages in each industry theme.
- Run the five-minute demo script from `docs/PITCH.md` yourself in a browser, end to end, and fix anything that stumbles. Report any step that needed fixing.

## When you finish

Update `CLAUDE.md`, `README.md`, and write a `docs/DEPLOY.md` with the exact steps to deploy the whole system on free tiers. Write the final `NEXT.md` (done, verified, not verified, known limitations, and a prioritised list of what to improve before showing it to a real client). Push `main` and the tag `phase-4-complete`. Reply with a short summary.

---

# Recovery and maintenance prompts

Use these when a session stops early or you want a change after a phase.

**Continue after an interruption**

Read `CLAUDE.md`, `NEXT.md`, `DECISIONS.md`, then `git log --oneline -20` and `git status`. Work out which phase was in progress and what is unfinished. Run the full check suite. Finish the remaining scope of that phase following its original prompt in `docs/PROMPTS.md` if present, otherwise from `NEXT.md`. Same rules: work on `main`, commit only when green, tag the phase when done.

**Audit and fix (run any time, especially before a client pitch)**

Read `CLAUDE.md` and `NEXT.md`. Without adding features, audit the whole repo as a sceptical senior reviewer: failing or flaky tests, security issues (authorisation, RLS, secrets, webhook verification), accessibility, performance, broken links, dead code, misleading copy, anything that could embarrass me in a live demo. Fix everything you can, commit to `main` when green, and write `docs/AUDIT.md` listing what you found, what you fixed and what remains.

**Rename the brand**

Change `BRAND_NAME` and related values in `packages/core/src/brand.ts` to: <NEW NAME and TAGLINE>. Find and fix any remaining hardcoded occurrences of the old name across code, docs, seed data, tests and metadata. Run the full checks and commit to `main`.

**Save these prompts in the repo**

Copy this prompt book to `docs/PROMPTS.md` and commit it to `main`, so later sessions can refer to the original phase scopes.
