# Pitch deck outline

Twelve slides, about ten minutes with the live demo in the middle. Each slide has a headline, its points, speaker notes
and a suggested visual. Use the prospect's industry brand throughout (screenshots from that pack), and keep every number
to the ones below, which come from the project's own documents.

## 1. Title

- **Headline:** From enquiry to expert, without the gaps
- A lead-to-expert platform for businesses that sell expertise: clinics, property, wealth advice, interiors.
- Your name, the date, "working demo with fictional brands".
- **Notes:** Say up front that everything shown is a demo with synthetic data.
- **Visual:** the home page of the prospect's industry brand.

## 2. The problem

- Enquiries wait too long for a first reply.
- They land with whoever is free, not whoever fits.
- Follow-ups depend on memory; no-shows are not chased.
- Nobody can say where people dropped out.
- **Notes:** Ask which of these they recognise. Do not quote industry statistics you cannot source.
- **Visual:** four short lines, one icon each.

## 3. The journey

- Enquiry → AI assistant qualifies → routed to the right expert → staff see a summary → follow-ups → booking → test
  payment → dashboard.
- One record of every step.
- **Notes:** This is the map for the demo; point at each step as you show it.
- **Visual:** the seven-step strip from the case-study page.

## 4. Live demo

- Five minutes: `docs/PITCH.md`.
- **Notes:** If anything fails, switch to the 90-second recording and keep talking.
- **Visual:** a single "Live demo" slide; the backup video embedded on the next hidden slide.

## 5. An assistant that knows its limits

- Says it is an AI and asks permission first.
- Every line is written in advance; the AI model only maps an answer to an allowed option.
- Safety checks run first on every turn: emergencies (112), advice requests, manipulation attempts.
- English and Hindi.
- **Notes:** 233 scripted conversations across the four industries are tested before every release, and every safety
  conversation must pass (`docs/VOICE_EVAL.md`).
- **Visual:** a short chat screenshot with the advice refusal.

## 6. The right person, with reasons

- Routing by specialty, language, seniority, spare capacity and continuity.
- Every suggestion shows its reasons; overrides need a reason too.
- **Notes:** Deterministic rules, not a black box: the same lead always gets the same answer.
- **Visual:** the routing panel from the lead page.

## 7. Booking and payment

- Real slots from each expert's weekly hours and time off; the database refuses double booking.
- Reschedule or cancel from the person's own link or the CRM; no-shows are marked and followed up.
- Razorpay test mode (a simulated checkout without keys); live keys are refused.
- **Notes:** Payment moves the lead to the won stage automatically.
- **Visual:** the booking page and the test payment screen side by side.

## 8. A manager's view

- Funnel and drop-off, first response against the target, no-shows, team load, assistant call outcomes, lead sources,
  conversion over time.
- Every number is a documented query (`docs/METRICS.md`).
- **Visual:** the dashboard screenshot.

## 9. Built for sensitive data

- Separate, versioned consents; withdrawing the main one erases personal details (India's DPDP rules).
- Staff see only what their role allows, enforced in the database.
- Audit trail without names or free text; logs without personal data.
- Accessible: WCAG AA, keyboard use, contrast tested for every theme.
- **Visual:** the architecture diagram (`docs/architecture.svg`) with the database highlighted.

## 10. One platform, four industries

- Healwyn Clinics, Nestwyn Realty, Ledgerwyn Wealth, Loomwyn Interiors.
- One configuration file per industry: brand, questions, stages, messages, routing, assistant script, safety rules.
- Industry-specific safety: no medical or investment advice, fraud red flags for wealth, home hazards for interiors,
  regulatory notices for property and wealth.
- **Visual:** four home pages in a grid.

## 11. What is real, and what it costs

- Real: website, forms, CRM, permissions, routing, email, booking, assistant (typed and browser voice), test payments,
  dashboard.
- Simulated in the demo: SMS, WhatsApp, phone calls.
- A small client (about 500 leads and 200 assistant calls a month): about USD 123 a month for the core services
  (`docs/FREE_TIER_REPORT.md`), plus payment fees and any phone or messaging provider.
- **Notes:** Be clear that these are estimates from published prices on 11 October 2026.
- **Visual:** a two-column "real / simulated" table and one cost figure.

## 12. Next step

- A pilot for one team: your questions, your people, your wording, your safety review.
- What it takes: real phone and messaging providers, your domain and accounts, a third-party security review.
- **Call to action:** "Which part would save your team the most time? Let's start there."
- **Visual:** your contact details and the case-study page address.
